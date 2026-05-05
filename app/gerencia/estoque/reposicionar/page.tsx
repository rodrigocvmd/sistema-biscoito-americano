"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, orderBy, where, Timestamp, runTransaction, doc, serverTimestamp } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, RepositionHistory } from "@/types";
import { RefreshCw, ArrowRight, ArrowRightLeft, ChevronDown, ChevronUp, Save } from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, boolean>>;
}

export default function EstoqueReposicionarPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [storeA, setStoreA] = useState<StoreId>("conjunto");
	const [storeB, setStoreB] = useState<StoreId>("terraco");
	const [projectedStocks, setProjectedStocks] = useState<Record<StoreId, Partial<StockData>>>({
		conjunto: {},
		terraco: {},
		lago: {},
		noroeste: {},
	});
	const [repositionInputs, setRepositionInputs] = useState<Partial<Record<keyof StockData, number>>>({});
	const [savingRepos, setSavingRepos] = useState(false);
	const [expandedItem, setExpandedItem] = useState<keyof StockData | null>(null);
	const [lastRepoForItem, setLastRepoForItem] = useState<RepositionHistory | null>(null);
	const [loadingLastRepo, setLoadingLastRepo] = useState(false);
	const [showSummary, setShowSummary] = useState(false);

	useEffect(() => {
		const storeIds = Object.keys(STORE_NAMES) as StoreId[];
		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			const newFullData = storeIds.map((id) => {
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
		}
	}, [allData]);

	const resetProjectedStocks = () => {
		if (window.confirm("Deseja redefinir todas as quantidades baseadas no estoque atual?")) {
			const initialProjected: any = {};
			allData.forEach((store) => {
				initialProjected[store.id] = { ...store.stock };
			});
			setProjectedStocks(initialProjected);
			setRepositionInputs({});
		}
	};

	const applyMovement = (key: keyof StockData, direction: "AtoB" | "BtoA") => {
		const qty = repositionInputs[key] || 0;
		if (qty <= 0) return;

		setProjectedStocks((prev) => {
			const next = { ...prev };
			const stockA = { ...next[storeA] };
			const stockB = { ...next[storeB] };

			const vA = stockA[key] || 0;
			const vB = stockB[key] || 0;

			if (direction === "AtoB") {
				stockA[key] = vA - qty;
				stockB[key] = vB + qty;
			} else {
				stockA[key] = vA + qty;
				stockB[key] = vB - qty;
			}

			next[storeA] = stockA;
			next[storeB] = stockB;
			return next;
		});

		setRepositionInputs((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
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
			const q = query(collection(db, "stores", storeA, "repositions"), where("itemId", "==", itemId), orderBy("timestamp", "desc"), where("fromStore", "in", [storeA, storeB]));
			const snap = await getDocs(q);
			if (!snap.empty) setLastRepoForItem(snap.docs[0].data() as RepositionHistory);
		} catch (error) { console.error("Erro ao buscar último reposicionamento:", error); }
		finally { setLoadingLastRepo(false); }
	};

	useEffect(() => { if (expandedItem) fetchLastRepo(expandedItem); }, [expandedItem, storeA, storeB]);

	if (loading) return <div className="flex flex-col items-center justify-center p-12"><RefreshCw className="animate-spin text-blue-600 mb-4" size={48} /><p className="text-slate-500 font-bold">Carregando estoque...</p></div>;

	return (
		<div className="space-y-6">
			{/* Store Selectors & Reset */}
			<div className="flex flex-col gap-4 items-center justify-between">
				<div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap items-center justify-center gap-12 flex-1">
					<div className="flex flex-col items-center gap-2">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loja de Origem (A)</span>
						<select value={storeA} onChange={(e) => setStoreA(e.target.value as StoreId)} className="bg-slate-50 border border-slate-100 rounded-xl px-6 py-3 text-lg font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">{Object.entries(STORE_NAMES).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}</select>
					</div>
					<ArrowRightLeft className="text-slate-300 mt-6" size={32} />
					<div className="flex flex-col items-center gap-2">
						<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loja de Destino (B)</span>
						<select value={storeB} onChange={(e) => setStoreB(e.target.value as StoreId)} className="bg-slate-50 border border-slate-100 rounded-xl px-6 py-3 text-lg font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">{Object.entries(STORE_NAMES).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}</select>
					</div>
				</div>
				<button onClick={resetProjectedStocks} className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-[32px] font-black text-xs transition-all border border-slate-200 h-fit">REDEFINIR QUANTIDADES BASEADAS NO ESTOQUE ATUAL</button>
			</div>

			<div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-slate-50 border-b border-slate-200">
								<th className="p-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Item</th>
								<th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">{STORE_NAMES[storeA]} (Projetado)</th>
								<th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Movimentar</th>
								<th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">{STORE_NAMES[storeB]} (Projetado)</th>
							</tr>
						</thead>
						<tbody>
							{Object.entries(STOCK_LABELS).map(([key, label]) => {
								const itemKey = key as keyof StockData;
								const vA = projectedStocks[storeA][itemKey] || 0;
								const vB = projectedStocks[storeB][itemKey] || 0;
								const initialA = allData.find(d => d.id === storeA)?.stock[itemKey] || 0;
								const initialB = allData.find(d => d.id === storeB)?.stock[itemKey] || 0;
								const inputValue = repositionInputs[itemKey] || "";
								const isExpanded = expandedItem === itemKey;
								return (
									<>
										<tr key={itemKey} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}>
											<td className="p-6"><button onClick={() => setExpandedItem(isExpanded ? null : itemKey)} className="flex items-center gap-3 text-sm font-black text-slate-600 uppercase hover:text-blue-600 transition-colors cursor-pointer text-left">{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{label}</button></td>
											<td className="p-6 text-center"><div className="flex flex-col items-center"><span className={`text-xl font-black ${vA !== initialA ? "text-blue-600" : (allData.find(d => d.id === storeA)?.isUnits?.[itemKey] ? "text-orange-500" : (initialA === 0 ? "text-slate-400" : "text-slate-900"))}`}>{allData.find(d => d.id === storeA)?.isUnits?.[itemKey] && vA === 0 ? "< 1" : vA}</span>{vA !== initialA && (<span className="text-[10px] font-bold text-slate-400">Início: {allData.find(d => d.id === storeA)?.isUnits?.[itemKey] ? "< 1" : initialA}</span>)}</div></td>
											<td className="p-6 text-center">
												<div className="flex items-center justify-center gap-3">
													<button onClick={() => applyMovement(itemKey, "BtoA")} disabled={!inputValue || (allData.find(d => d.id === storeB)?.isUnits?.[itemKey] && vB === 0)} className={`p-2 rounded-xl border-2 transition-all ${!inputValue || (allData.find(d => d.id === storeB)?.isUnits?.[itemKey] && vB === 0) ? "border-slate-100 text-slate-200 cursor-not-allowed" : "border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white cursor-pointer"}`} title="Mover de B para A"><ArrowRight className="rotate-180" size={20} /></button>
													<input type="number" min="1" value={inputValue} onChange={(e) => setRepositionInputs(prev => ({ ...prev, [itemKey]: parseInt(e.target.value, 10) || 0 }))} placeholder="0" className="w-20 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-center font-black focus:outline-none focus:border-blue-500 transition-all" />
													<button onClick={() => applyMovement(itemKey, "AtoB")} disabled={!inputValue || (allData.find(d => d.id === storeA)?.isUnits?.[itemKey] && vA === 0)} className={`p-2 rounded-xl border-2 transition-all ${!inputValue || (allData.find(d => d.id === storeA)?.isUnits?.[itemKey] && vA === 0) ? "border-slate-100 text-slate-200 cursor-not-allowed" : "border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white cursor-pointer"}`} title="Mover de A para B"><ArrowRight size={20} /></button>
												</div>
											</td>
											<td className="p-6 text-center"><div className="flex flex-col items-center"><span className={`text-xl font-black ${vB !== initialB ? "text-blue-600" : (allData.find(d => d.id === storeB)?.isUnits?.[itemKey] ? "text-orange-500" : (initialB === 0 ? "text-slate-400" : "text-slate-900"))}`}>{allData.find(d => d.id === storeB)?.isUnits?.[itemKey] && vB === 0 ? "< 1" : vB}</span>{vB !== initialB && (<span className="text-[10px] font-bold text-slate-400">Início: {allData.find(d => d.id === storeB)?.isUnits?.[itemKey] ? "< 1" : initialB}</span>)}</div></td>
										</tr>
										{isExpanded && (<tr className="bg-blue-50/20"><td colSpan={4} className="p-6 border-b border-slate-200"><div className="bg-white rounded-2xl p-6 border border-blue-100 shadow-sm"><h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Último Reposicionamento Gerencial</h4>{loadingLastRepo ? (<div className="flex items-center gap-3 text-slate-400"><RefreshCw className="animate-spin" size={16} /><span className="text-sm font-bold">Buscando histórico...</span></div>) : lastRepoForItem ? (<div className="flex flex-wrap items-center gap-8"><div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">Data</span><span className="text-sm font-black text-slate-700">{formatDate(lastRepoForItem.timestamp.toDate())}</span></div><div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">Movimentação</span><span className="text-sm font-black text-blue-600">{STORE_NAMES[lastRepoForItem.fromStore]} → {STORE_NAMES[lastRepoForItem.toStore]}</span></div><div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">Quantidade</span><span className="text-sm font-black text-green-600">{lastRepoForItem.difference} itens</span></div><div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">Estado Anterior</span><span className="text-sm font-black text-slate-500">De: {lastRepoForItem.beforeFrom} | Para: {lastRepoForItem.beforeTo}</span></div><div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase">Estado Posterior</span><span className="text-sm font-black text-slate-700">De: {lastRepoForItem.afterFrom} | Para: {lastRepoForItem.afterTo}</span></div></div>) : (<p className="text-sm font-bold text-slate-400">Nenhum reposicionamento registrado para este item nas lojas selecionadas.</p>)}</div></td></tr>)}
									</>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex justify-end p-6"><button onClick={() => setShowSummary(true)} className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all cursor-pointer text-lg">RESUMO DE REPOSICIONAMENTO</button></div>
			{showSummary && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
						<div className="p-8 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Resumo de Reposicionamento</h2><p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Plano Otimizado de Movimentações</p></div><button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><RefreshCw className="rotate-45" size={24} /></button></div>
						<div className="p-8 overflow-y-auto flex-1">{calculateOptimizedSummary().length > 0 ? (<div className="space-y-4">{calculateOptimizedSummary().map((move, idx) => (<div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="flex-1"><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Item</span><span className="text-sm font-black text-slate-700">{STOCK_LABELS[move.item]}</span></div><div className="flex items-center gap-4 flex-1 justify-center"><div className="text-center"><span className="text-[9px] font-black text-red-400 uppercase block">De</span><span className="text-xs font-black text-slate-600">{STORE_NAMES[move.from]}</span></div><ArrowRight className="text-blue-400" size={16} /><div className="text-center"><span className="text-[9px] font-black text-green-400 uppercase block">Para</span><span className="text-xs font-black text-slate-600">{STORE_NAMES[move.to]}</span></div></div><div className="flex-1 text-right"><span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Quantidade</span><span className="text-lg font-black text-blue-600">{move.qty} un.</span></div></div>))}</div>) : (<div className="text-center py-10"><p className="text-slate-400 font-bold">Nenhuma movimentação pendente.</p></div>)}</div>
						<div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4"><button onClick={() => setShowSummary(false)} className="flex-1 px-8 py-4 rounded-2xl font-black text-slate-500 hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200">CANCELAR</button><button onClick={saveReposition} disabled={calculateOptimizedSummary().length === 0 || savingRepos} className="flex-1 flex items-center justify-center gap-3 bg-green-700 hover:bg-green-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-green-100 transition-all disabled:opacity-50 cursor-pointer">{savingRepos ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}CONCLUIR E SALVAR</button></div>
					</div>
				</div>
			)}
		</div>
	);
}
