"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, orderBy, where, Timestamp, runTransaction, doc, collectionGroup } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, RepositionHistory } from "@/types";
import { RefreshCw, ArrowRight, ArrowRightLeft, ChevronDown, ChevronUp, Save, Send } from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, boolean>>;
}

const STORE_ORDER: StoreId[] = ["lago", "conjunto", "terraco", "noroeste"];

export default function EstoqueReposicionarPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	
	// Transfer state per item
	const [itemTransfers, setItemTransfers] = useState<Record<string, { from: StoreId, to: StoreId, qty: number }>>({});
	
	const [projectedStocks, setProjectedStocks] = useState<Record<StoreId, Partial<StockData>>>({
		conjunto: {},
		terraco: {},
		lago: {},
		noroeste: {},
	});
	const [savingRepos, setSavingRepos] = useState(false);
	const [expandedItem, setExpandedItem] = useState<keyof StockData | null>(null);
	const [lastRepoForItem, setLastRepoForItem] = useState<RepositionHistory | null>(null);
	const [loadingLastRepo, setLoadingLastRepo] = useState(false);
	const [showSummary, setShowSummary] = useState(false);

	useEffect(() => {
		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			const newFullData = STORE_ORDER.map((id) => {
				const storeDoc = storesMap[id] || {};
				return {
					id,
					name: STORE_NAMES[id],
					lastStockUpdate: storeDoc.lastStockUpdate?.toDate() || null,
					stock: storeDoc.stock || {},
					isUnits: storeDoc.isUnits || {},
				};
			});
			setAllData(newFullData);
			setLoading(false);
		});
		return () => unsubscribeStores();
	}, []);

	useEffect(() => {
		if (allData.length > 0) {
			const initialProjected: any = {};
			allData.forEach((store) => {
				initialProjected[store.id] = { ...store.stock };
			});
			setProjectedStocks(initialProjected);
			
			// Initialize default transfers: Lago as source, Conjunto as target
			const initialTransfers: any = {};
			Object.keys(STOCK_LABELS).forEach(key => {
				initialTransfers[key] = { from: "lago", to: "conjunto", qty: 0 };
			});
			setItemTransfers(initialTransfers);
		}
	}, [allData]);

	const resetProjectedStocks = () => {
		if (window.confirm("Deseja redefinir todas as quantidades baseadas no estoque atual?")) {
			const initialProjected: any = {};
			allData.forEach((store) => {
				initialProjected[store.id] = { ...store.stock };
			});
			setProjectedStocks(initialProjected);
			
			const resetTransfers: any = {};
			Object.keys(STOCK_LABELS).forEach(key => {
				resetTransfers[key] = { from: "lago", to: "conjunto", qty: 0 };
			});
			setItemTransfers(resetTransfers);
		}
	};

	const applyMovement = (key: keyof StockData) => {
		const transfer = itemTransfers[key];
		if (!transfer || transfer.qty <= 0 || transfer.from === transfer.to) return;

		setProjectedStocks((prev) => {
			const next = { ...prev };
			const stockFrom = { ...next[transfer.from] };
			const stockTo = { ...next[transfer.to] };

			const vFrom = stockFrom[key] || 0;
			const vTo = stockTo[key] || 0;

			stockFrom[key] = vFrom - transfer.qty;
			stockTo[key] = vTo + transfer.qty;

			next[transfer.from] = stockFrom;
			next[transfer.to] = stockTo;
			return next;
		});

		// Reset quantity for this item after applying
		setItemTransfers(prev => ({
			...prev,
			[key]: { ...prev[key], qty: 0 }
		}));
	};

	const calculateOptimizedSummary = () => {
		const movements: { item: keyof StockData; from: StoreId; to: StoreId; qty: number }[] = [];
		(Object.keys(STOCK_LABELS) as (keyof StockData)[]).forEach((itemKey) => {
			const storeChanges: { storeId: StoreId; diff: number }[] = [];
			allData.forEach((store) => {
				const initial = store.stock[itemKey] || 0;
				const projected = projectedStocks[store.id][itemKey] || 0;
				const diff = projected - initial;
				if (diff !== 0) storeChanges.push({ storeId: store.id, diff });
			});
			const sources = storeChanges.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff);
			const sinks = storeChanges.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff);
			let sourceIdx = 0; let sinkIdx = 0;
			while (sourceIdx < sources.length && sinkIdx < sinks.length) {
				const source = sources[sourceIdx]; const sink = sinks[sinkIdx];
				const amountToMove = Math.min(Math.abs(source.diff), sink.diff);
				movements.push({ item: itemKey, from: source.storeId, to: sink.storeId, qty: amountToMove });
				source.diff += amountToMove; sink.diff -= amountToMove;
				if (source.diff === 0) sourceIdx++; if (sink.diff === 0) sinkIdx++;
			}
		});
		return movements;
	};

	const saveReposition = async () => {
		setSavingRepos(true);
		try {
			const optimizedMovements = calculateOptimizedSummary();
			if (optimizedMovements.length === 0) { alert("Não há movimentações para salvar."); setSavingRepos(false); return; }
			await runTransaction(db, async (transaction) => {
				for (const move of optimizedMovements) {
					const newId = doc(collection(db, "unused")).id;
					const historyEntry: RepositionHistory = {
						timestamp: Timestamp.now(), itemId: move.item, fromStore: move.from, toStore: move.to,
						beforeFrom: allData.find(d => d.id === move.from)?.stock[move.item] || 0,
						afterFrom: projectedStocks[move.from][move.item] || 0,
						beforeTo: allData.find(d => d.id === move.to)?.stock[move.item] || 0,
						afterTo: projectedStocks[move.to][move.item] || 0,
						difference: move.qty
					};
					transaction.set(doc(db, "stores", move.from, "repositions", newId), historyEntry);
					transaction.set(doc(db, "stores", move.to, "repositions", newId), historyEntry);
				}
			});
			alert("Plano de reposicionamento salvo com sucesso no histórico!");
			setShowSummary(false);
		} catch (error) { console.error("Erro ao salvar reposicionamento:", error); alert("Erro ao salvar. Verifique o console."); }
		finally { setSavingRepos(false); }
	};

	const fetchLastRepo = async (itemId: keyof StockData) => {
		setLoadingLastRepo(true); setLastRepoForItem(null);
		try {
			// Usando collectionGroup para buscar o histórico de qualquer loja
			const q = query(
				collectionGroup(db, "repositions"), 
				where("itemId", "==", itemId), 
				orderBy("timestamp", "desc")
			);
			const snap = await getDocs(q);
			if (!snap.empty) setLastRepoForItem(snap.docs[0].data() as RepositionHistory);
		} catch (error) { 
			console.error("Erro ao buscar último reposicionamento:", error); 
			// Fallback: se o collectionGroup falhar (falta de índice), tenta na loja Lago
			try {
				const qFallback = query(
					collection(db, "stores", "lago", "repositions"), 
					where("itemId", "==", itemId), 
					orderBy("timestamp", "desc")
				);
				const snapFallback = await getDocs(qFallback);
				if (!snapFallback.empty) setLastRepoForItem(snapFallback.docs[0].data() as RepositionHistory);
			} catch (err) {
				console.error("Erro no fallback de histórico:", err);
			}
		}
		finally { setLoadingLastRepo(false); }
	};

	useEffect(() => { if (expandedItem) fetchLastRepo(expandedItem); }, [expandedItem]);

	if (loading) return <div className="flex flex-col items-center justify-center p-12"><RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} /><p className="text-slate-500 dark:text-slate-400 font-bold">Carregando estoque...</p></div>;

	return (
		<div className="space-y-6">
			{/* Action Bar */}
			<div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
				<div className="flex flex-col gap-1">
					<h2 className="text-xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Reposicionamento Simultâneo</h2>
					<p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Movimente itens entre todas as unidades</p>
				</div>
				<button onClick={resetProjectedStocks} className="cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-6 py-4 rounded-2xl font-black text-[10px] transition-all border border-slate-200 dark:border-slate-700 uppercase tracking-widest">Redefinir Quantidades</button>
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
								<th className="p-4 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20">Item</th>
								{STORE_ORDER.map(id => (
									<th key={id} className="p-4 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[100px] border-l border-slate-100 dark:border-slate-700">
										{STORE_NAMES[id]}
									</th>
								))}
								<th className="p-4 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[280px] border-l border-slate-100 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10">Movimentar</th>
							</tr>
						</thead>
						<tbody>
							{Object.entries(STOCK_LABELS).map(([key, label]) => {
								const itemKey = key as keyof StockData;
								const transfers = itemTransfers[itemKey] || { from: "lago", to: "conjunto", qty: 0 };
								const isExpanded = expandedItem === itemKey;
								
								return (
									<>
										<tr key={itemKey} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/20" : ""}`}>
											<td className="p-4 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/50 z-10 border-r border-slate-50 dark:border-slate-800 transition-colors">
												<button onClick={() => setExpandedItem(isExpanded ? null : itemKey)} className="flex items-center gap-2 text-[13px] font-black text-slate-600 dark:text-slate-400 uppercase hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-left">
													{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
													{label}
												</button>
											</td>
											
											{STORE_ORDER.map(id => {
												const v = projectedStocks[id][itemKey] || 0;
												const initial = allData.find(d => d.id === id)?.stock[itemKey] || 0;
												const isUnit = allData.find(d => d.id === id)?.isUnits?.[itemKey] || false;
												const changed = v !== initial;
												
												return (
													<td key={id} className="p-4 text-center border-l border-slate-50 dark:border-slate-800">
														<div className="flex flex-col items-center">
															<span className={`text-lg font-black ${changed ? "text-blue-600 dark:text-blue-400" : (isUnit ? "text-orange-500 dark:text-orange-400" : (initial === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-200"))}`}>
																{isUnit && v === 0 ? "< 1" : v}
															</span>
															{changed && (
																<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Original: {isUnit ? "< 1" : initial}</span>
															)}
														</div>
													</td>
												);
											})}
											
											<td className="p-4 text-center border-l border-slate-50 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/5">
												<div className="flex items-center justify-center gap-2">
													<input 
														type="number" 
														min="0" 
														value={transfers.qty || ""} 
														onChange={(e) => setItemTransfers(prev => ({ 
															...prev, 
															[itemKey]: { ...transfers, qty: parseInt(e.target.value, 10) || 0 } 
														}))} 
														placeholder="0" 
														className="w-16 px-2 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center font-black focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all text-sm dark:text-slate-200" 
													/>
													
													<div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
														<select 
															value={transfers.from} 
															onChange={(e) => setItemTransfers(prev => ({ 
																...prev, 
																[itemKey]: { ...transfers, from: e.target.value as StoreId } 
															}))}
															className="bg-transparent text-[10px] font-black text-red-600 dark:text-red-400 focus:outline-none cursor-pointer p-1"
														>
															{STORE_ORDER.map(id => (
																<option key={id} value={id} className="dark:bg-slate-800">{STORE_NAMES[id]}</option>
															))}
														</select>
														
														<ArrowRight className="text-slate-300 dark:text-slate-600" size={12} />
														
														<select 
															value={transfers.to} 
															onChange={(e) => setItemTransfers(prev => ({ 
																...prev, 
																[itemKey]: { ...transfers, to: e.target.value as StoreId } 
															}))}
															className="bg-transparent text-[10px] font-black text-emerald-600 dark:text-emerald-400 focus:outline-none cursor-pointer p-1"
														>
															{STORE_ORDER.map(id => (
																<option key={id} value={id} className="dark:bg-slate-800">{STORE_NAMES[id]}</option>
															))}
														</select>
													</div>
													
													<button 
														onClick={() => applyMovement(itemKey)} 
														disabled={transfers.qty <= 0 || transfers.from === transfers.to}
														className={`p-2 rounded-xl transition-all ${transfers.qty <= 0 || transfers.from === transfers.to ? "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100 dark:shadow-none cursor-pointer"}`}
													>
														<Send size={16} />
													</button>
												</div>
											</td>
										</tr>
										{isExpanded && (
											<tr className="bg-blue-50/20 dark:bg-blue-900/10 transition-colors">
												<td colSpan={STORE_ORDER.length + 2} className="p-4 border-b border-slate-200 dark:border-slate-800">
													<div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-blue-100 dark:border-blue-900 shadow-sm transition-colors">
														<h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Último Reposicionamento Gerencial</h4>
														{loadingLastRepo ? (
															<div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
																<RefreshCw className="animate-spin" size={16} />
																<span className="text-xs font-bold">Buscando histórico...</span>
															</div>
														) : lastRepoForItem ? (
															<div className="flex flex-wrap items-center gap-8">
																<div className="flex flex-col gap-1">
																	<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Data</span>
																	<span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatDate(lastRepoForItem.timestamp.toDate())}</span>
																</div>
																<div className="flex flex-col gap-1">
																	<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Movimentação</span>
																	<span className="text-xs font-black text-blue-600 dark:text-blue-400">{STORE_NAMES[lastRepoForItem.fromStore]} → {STORE_NAMES[lastRepoForItem.toStore]}</span>
																</div>
																<div className="flex flex-col gap-1">
																	<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Quantidade</span>
																	<span className="text-xs font-black text-green-600 dark:text-green-400">{lastRepoForItem.difference} itens</span>
																</div>
																<div className="flex flex-col gap-1">
																	<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Origem</span>
																	<span className="text-xs font-black text-slate-500 dark:text-slate-400">De {lastRepoForItem.beforeFrom} para {lastRepoForItem.afterFrom}</span>
																</div>
																<div className="flex flex-col gap-1">
																	<span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Destino</span>
																	<span className="text-xs font-black text-slate-500 dark:text-slate-400">De {lastRepoForItem.beforeTo} para {lastRepoForItem.afterTo}</span>
																</div>
															</div>
														) : (
															<p className="text-xs font-bold text-slate-400 dark:text-slate-500">Nenhum reposicionamento registrado para este item nas lojas selecionadas.</p>
														)}
													</div>
												</td>
											</tr>
										)}
									</>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			
			<div className="flex justify-end p-6 print:hidden">
				<button onClick={() => setShowSummary(true)} className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-2xl font-black shadow-lg shadow-blue-100 dark:shadow-none transition-all cursor-pointer text-lg">
					RESUMO DE REPOSICIONAMENTO
				</button>
			</div>

			{showSummary && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
						<div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div>
								<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
									Reposicionamento - {new Date().toLocaleDateString('pt-BR')}
								</h2>
								<p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Plano Otimizado de Movimentações</p>
							</div>
							<button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
								<RefreshCw className="rotate-45" size={24} />
							</button>
						</div>
						
						<div className="p-8 overflow-y-auto flex-1">
							{calculateOptimizedSummary().length > 0 ? (
								<div className="space-y-6">
									{(() => {
										const grouped = new Map<string, { from: StoreId, to: StoreId, items: { label: string, qty: number }[] }>();
										
										calculateOptimizedSummary().forEach(move => {
											const key = `${move.from}-${move.to}`;
											if (!grouped.has(key)) {
												grouped.set(key, { from: move.from, to: move.to, items: [] });
											}
											grouped.get(key)!.items.push({ 
												label: STOCK_LABELS[move.item], 
												qty: move.qty 
											});
										});

										return Array.from(grouped.values()).map((group, idx) => (
											<div key={idx} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
												<div className="flex items-center gap-2 mb-3">
													<span className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">
														{STORE_NAMES[group.from]} para {STORE_NAMES[group.to]}:
													</span>
												</div>
												<p className="text-slate-600 dark:text-slate-300 font-bold text-sm leading-relaxed">
													{group.items.map((item, i) => (
														<span key={i}>
															{item.qty} {item.label}{i < group.items.length - 1 ? ", " : ""}
														</span>
													))}
												</p>
											</div>
										));
									})()}
								</div>
							) : (
								<div className="text-center py-10">
									<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Nenhuma movimentação pendente.</p>
								</div>
							)}
						</div>
						
						<div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-4 transition-colors">
							<button onClick={() => setShowSummary(false)} className="flex-1 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">CANCELAR</button>
							<button 
								onClick={saveReposition} 
								disabled={calculateOptimizedSummary().length === 0 || savingRepos} 
								className="flex-1 flex items-center justify-center gap-3 bg-green-700 hover:bg-green-800 dark:bg-green-600 dark:hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer"
							>
								{savingRepos ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
								CONCLUIR E SALVAR
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
