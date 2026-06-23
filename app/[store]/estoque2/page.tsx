"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, writeBatch, collection, serverTimestamp } from "firebase/firestore";
import { STOCK_LABELS, StockData, formatDate } from "@/types";
import { RefreshCw, AlertCircle, Package, ClipboardCheck, ClipboardX, Check, X, Save } from "lucide-react";
import { use } from "react";
import Link from "next/link";

export default function StockPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
	const [stock, setStock] = useState<Partial<StockData>>({});
	const [isUnits, setIsUnits] = useState<Partial<Record<keyof StockData, number>>>({});
	const [sortBy, setSortBy] = useState<"name" | "quantity">("name");

	// Conference Mode States
	const [isConferenceMode, setIsConferenceMode] = useState(false);
	const [divergences, setDivergences] = useState<Record<string, { qty: number; openQty: number; obs: string }>>({});
	const [selectedDivergenceItem, setSelectedDivergenceItem] = useState<keyof StockData | null>(null);
	const [modalClosedQty, setModalClosedQty] = useState<string>("");
	const [modalOpenQty, setModalOpenQty] = useState<string>("");
	const [modalObs, setModalObs] = useState<string>("");
	const [isUpdating, setIsUpdating] = useState(false);
	const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	useEffect(() => {
		const savedSort = localStorage.getItem("biscoito_store_sort");
		if (savedSort && (savedSort === "name" || savedSort === "quantity")) {
			setSortBy(savedSort as any);
		}
	}, []);

	useEffect(() => {
		localStorage.setItem("biscoito_store_sort", sortBy);
	}, [sortBy]);

	useEffect(() => {
		const docRef = doc(db, "stores", store);
		
		const unsubscribe = onSnapshot(docRef, (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setStock(data.stock || {});
				setIsUnits(data.isUnits || {});
				if (data.lastStockUpdate) {
					setLastUpdate(data.lastStockUpdate.toDate());
				}
			}
			setLoading(false);
		}, (error) => {
			console.error("Erro ao buscar estoque:", error);
			setLoading(false);
		});

		return () => unsubscribe();
	}, [store]);

	const sortedItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][]).sort((a, b) => {
		if (sortBy === "name") {
			return a[1].localeCompare(b[1]);
		}
		if (sortBy === "quantity") {
			const qtyA = stock[a[0]] || 0;
			const qtyB = stock[b[0]] || 0;
			return qtyB - qtyA;
		}
		return 0;
	});

	// Open Divergence Modal
	const handleOpenDivergenceModal = (itemId: keyof StockData) => {
		const currentDivergence = divergences[itemId];
		const currentQty = stock[itemId] || 0;
		
		const openVal = isUnits[itemId];
		const currentOpenCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;

		setSelectedDivergenceItem(itemId);
		setModalClosedQty(currentDivergence ? String(currentDivergence.qty) : String(currentQty));
		setModalOpenQty(currentDivergence ? String(currentDivergence.openQty) : String(currentOpenCount));
		setModalObs(currentDivergence ? currentDivergence.obs : "");
	};

	// Save Divergence local state
	const handleSaveDivergence = () => {
		if (!selectedDivergenceItem) return;

		const closedQty = parseInt(modalClosedQty) || 0;
		const openQty = parseInt(modalOpenQty) || 0;

		setDivergences((prev) => ({
			...prev,
			[selectedDivergenceItem]: {
				qty: closedQty,
				openQty: openQty,
				obs: modalObs.trim(),
			},
		}));

		setSelectedDivergenceItem(null);
	};

	// Remove Divergence local state
	const handleRemoveDivergence = (itemId: string) => {
		setDivergences((prev) => {
			const newDivs = { ...prev };
			delete newDivs[itemId];
			return newDivs;
		});
	};

	// Save all divergences to Firestore
	const handleUpdateDivergentStock = async () => {
		const divergenceKeys = Object.keys(divergences);
		if (divergenceKeys.length === 0) return;

		setIsUpdating(true);
		setSaveMessage(null);

		try {
			const storeRef = doc(db, "stores", store);
			const movementsRef = collection(db, "stores", store, "stockMovements");
			const historyRef = collection(db, "stores", store, "stockHistory");

			const batch = writeBatch(db);

			const newStock = { ...stock };
			const newIsUnits = { ...isUnits };

			// Build update object and generate movements
			for (const itemId of divergenceKeys) {
				const beforeStock = stock[itemId as keyof StockData] || 0;
				const openVal = isUnits[itemId as keyof StockData];
				const beforeOpen = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;

				const { qty: afterStock, openQty: afterOpen, obs } = divergences[itemId];

				newStock[itemId as keyof StockData] = afterStock;
				newIsUnits[itemId as keyof StockData] = afterOpen;

				// Update store fields in batch
				batch.update(storeRef, {
					[`stock.${itemId}`]: afterStock,
					[`isUnits.${itemId}`]: afterOpen,
				});

				// Create stock movement reference and add to batch
				const movementDocRef = doc(movementsRef);
				batch.set(movementDocRef, {
					itemId: itemId,
					itemName: STOCK_LABELS[itemId as keyof StockData],
					type: "conferencia",
					quantity: afterStock - beforeStock, // Net change in packages
					beforeStock,
					afterStock,
					beforeOpen,
					afterOpen,
					obs: obs || "Conferência de estoque",
					timestamp: serverTimestamp(),
				});
			}

			// Add lastStockUpdate timestamp
			batch.update(storeRef, {
				lastStockUpdate: serverTimestamp(),
			});

			// Save full snapshot in history
			const historyDocRef = doc(historyRef);
			batch.set(historyDocRef, {
				stock: newStock,
				isUnits: newIsUnits,
				timestamp: serverTimestamp(),
			});

			await batch.commit();

			setSaveMessage({ type: "success", text: "Estoque divergente atualizado com sucesso!" });
			setDivergences({});
			setIsConferenceMode(false);
			setTimeout(() => setSaveMessage(null), 5000);
		} catch (error) {
			console.error("Erro ao atualizar divergências:", error);
			setSaveMessage({ type: "error", text: "Ocorreu um erro ao salvar as alterações no Firebase." });
		} finally {
			setIsUpdating(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando contagem...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6 w-full overflow-hidden">
			{/* Tab Switcher */}
			<div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
				<Link
					href={`/${store}/estoque`}
					className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-sm font-black transition-all"
				>
					Movimentações de Estoque
				</Link>
				<Link
					href={`/${store}/estoque2`}
					className="px-6 py-2.5 bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 rounded-xl text-sm font-black shadow-sm transition-all"
				>
					Estoque Atual
				</Link>
			</div>

			{/* Actions / Sorting Navbar */}
			<div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
				<div className="flex items-center gap-3 sm:gap-4">
					<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">
						Ordenar por:
					</span>
					<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1 overflow-x-auto no-scrollbar">
						<button
							onClick={() => setSortBy("name")}
							className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "name" ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
							Alfabética
						</button>
						<button
							onClick={() => setSortBy("quantity")}
							className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "quantity" ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
							Quantidade
						</button>
					</div>
				</div>

				<div className="flex flex-wrap gap-2 items-center">
					{/* Conference Mode Toggle */}
					<button
						onClick={() => {
							setIsConferenceMode(!isConferenceMode);
							if (isConferenceMode) {
								setDivergences({}); // reset if turned off
							}
						}}
						className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
							isConferenceMode
								? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700"
								: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
						}`}
					>
						{isConferenceMode ? <ClipboardX size={16} /> : <ClipboardCheck size={16} />}
						{isConferenceMode ? "Desativar Conferência" : "Modo de Conferência"}
					</button>

					{/* Update Divergent Button */}
					{isConferenceMode && Object.keys(divergences).length > 0 && (
						<button
							onClick={handleUpdateDivergentStock}
							disabled={isUpdating}
							className="cursor-pointer px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
						>
							{isUpdating ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
							Atualizar Estoque Divergente ({Object.keys(divergences).length})
						</button>
					)}
				</div>
			</div>

			{saveMessage && (
				<div
					className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold animate-in fade-in duration-200 ${
						saveMessage.type === "success"
							? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
							: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
					}`}
				>
					<AlertCircle size={18} />
					{saveMessage.text}
				</div>
			)}

			<div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
					<div>
						<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
							<Package className="text-red-600" size={24} />
							Contagem de Estoque (Pacotes)
						</h2>
						<p className="text-sm text-amber-600 dark:text-amber-500 font-bold flex items-center gap-1.5 mt-1">
							<AlertCircle size={16} />
							{isConferenceMode
								? "Modo de Conferência Ativo. Indique divergências nos itens correspondentes."
								: "Apenas leitura. Use a aba de movimentações para alterações."}
						</p>
					</div>
					<div className="bg-slate-50 dark:bg-slate-800 px-6 py-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
						<span className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 block mb-1">
							ÚLTIMA ATUALIZAÇÃO
						</span>
						<span className="text-base font-black text-blue-600 dark:text-blue-400">{formatDate(lastUpdate)}</span>
					</div>
				</div>

				<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
					{sortedItems.map(([key, label]) => {
						const qty = stock[key] || 0;
						const openVal = isUnits[key];
						const openCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;

						const hasDivergence = key in divergences;
						const divDetails = divergences[key];
						
						return (
							<div
								key={key}
								className={`flex flex-col p-4 rounded-2xl border transition-all group ${
									hasDivergence
										? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600"
										: "bg-slate-50 dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
								}`}
							>
								<span className="text-[1.1rem] font-black text-slate-500 dark:text-slate-200 uppercase tracking-tight mb-2 truncate text-center" title={label}>
									{label}
								</span>
								<div className="flex items-baseline gap-1.5 flex-wrap justify-center mb-4">
									{qty > 0 || openCount === 0 ? (
										<div className="flex items-baseline gap-1">
											<span className={`text-2xl font-black ${qty === 0 && openCount === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
												{qty}
											</span>
										</div>
									) : null}
									{openCount > 0 && (
										<span className="text-xl font-black text-orange-500 whitespace-nowrap">
											{qty > 0 ? `+${openCount} aberto${openCount > 1 ? "s" : ""}` : `${openCount} aberto${openCount > 1 ? "s" : ""}`}
										</span>
									)}
								</div>

								{/* Divergence actions / display */}
								{isConferenceMode && (
									<div className="mt-auto space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
										{hasDivergence ? (
											<div className="space-y-2">
												<div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-xl text-center text-xs text-amber-800 dark:text-amber-300 font-bold">
													<div className="font-black text-[13px] mb-0.5">Correto:</div>
													<div>
														{divDetails.qty} pac + {divDetails.openQty} ab
													</div>
													{divDetails.obs && (
														<div className="text-[10px] italic mt-1 text-amber-700 dark:text-amber-400 truncate max-w-full">
															Obs: {divDetails.obs}
														</div>
													)}
												</div>
												<div className="flex gap-1.5">
													<button
														onClick={() => handleOpenDivergenceModal(key)}
														className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-all"
													>
														Editar
													</button>
													<button
														onClick={() => handleRemoveDivergence(key)}
														className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-all"
														title="Remover Divergência"
													>
														<X size={12} />
													</button>
												</div>
											</div>
										) : (
											<button
												onClick={() => handleOpenDivergenceModal(key)}
												className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all"
											>
												Divergência
											</button>
										)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Divergence Entry Modal */}
			{selectedDivergenceItem && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
						<div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
							<h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
								Indicar Divergência
							</h3>
							<p className="text-xs text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider mt-1">
								{STOCK_LABELS[selectedDivergenceItem]}
							</p>
						</div>

						<div className="p-6 space-y-4">
							<div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500">
								<div>
									Estoque atual:
									<div className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">
										{stock[selectedDivergenceItem] || 0} pacotes
									</div>
								</div>
								<div>
									Abertos atual:
									<div className="text-lg font-black text-slate-800 dark:text-slate-200 mt-0.5">
										{typeof isUnits[selectedDivergenceItem] === "boolean"
											? (isUnits[selectedDivergenceItem] ? 1 : 0)
											: isUnits[selectedDivergenceItem] || 0}{" "}
										abertos
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-400 dark:text-slate-500 block pl-1">
										Qtd. Fechados Correta
									</label>
									<input
										type="number"
										min="0"
										value={modalClosedQty}
										onChange={(e) => setModalClosedQty(e.target.value)}
										className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800 dark:text-slate-200 font-black text-lg"
										placeholder="0"
									/>
								</div>
								<div className="space-y-1">
									<label className="text-xs font-bold text-slate-400 dark:text-slate-500 block pl-1">
										Qtd. Abertos Correta
									</label>
									<input
										type="number"
										min="0"
										value={modalOpenQty}
										onChange={(e) => setModalOpenQty(e.target.value)}
										className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800 dark:text-slate-200 font-black text-lg"
										placeholder="0"
									/>
								</div>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-bold text-slate-400 dark:text-slate-500 block pl-1">
									Observação / Apontamentos (Opcional)
								</label>
								<textarea
									value={modalObs}
									onChange={(e) => setModalObs(e.target.value)}
									placeholder="Indicar o motivo da divergência..."
									className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800 dark:text-slate-200 font-medium text-sm h-24 resize-none"
								/>
							</div>
						</div>

						<div className="flex border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
							<button
								onClick={() => setSelectedDivergenceItem(null)}
								className="flex-1 px-6 py-5 text-slate-500 dark:text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-100 dark:border-slate-800"
							>
								CANCELAR
							</button>
							<button
								onClick={handleSaveDivergence}
								className="flex-1 px-6 py-5 text-amber-600 dark:text-amber-400 font-black hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
							>
								CONFIRMAR
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
