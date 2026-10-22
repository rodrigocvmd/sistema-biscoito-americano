"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	doc,
	runTransaction,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	StockData,
	STORE_NAMES,
	StoreId,
	formatDate,
	sortStockEntries,
	normalizeSearchText,
	LatestRepositionState,
	RepositionMovementItem,
} from "@/types";
import {
	RefreshCw,
	ArrowLeftRight,
	Printer,
	Search,
	Eye,
	EyeOff,
	SlidersHorizontal,
	CheckCircle2,
	AlertTriangle,
	RotateCcw,
	X,
	Check,
	ArrowUpRight,
	ArrowDownLeft,
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, number>>;
}

const STORE_ORDER: StoreId[] = ["lago", "terraco", "conjunto", "noroeste"];

export default function EstoqueAtualPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [hideOpen, setHideOpen] = useState(true);
	const [boxSizes, setBoxSizes] = useState<Partial<StockData>>({});

	// Estados do Modal de Reposicionamento
	const [showReposModal, setShowReposModal] = useState(false);
	const [latestRepo, setLatestRepo] = useState<LatestRepositionState | null>(null);
	const [selectedStoreModal, setSelectedStoreModal] = useState<StoreId>("lago");
	const [isProcessingAction, setIsProcessingAction] = useState(false);
	const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
	};

	useEffect(() => {
		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			setAllData((currentData) => {
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

				if (currentData.length > 0) {
					const currentIdOrder = currentData.map((d) => d.id);
					return currentIdOrder.map((id) => newFullData.find((d) => d.id === id)!);
				}

				return newFullData;
			});
			setLoading(false);
			if (typeof window !== "undefined") {
				window.scrollTo(0, 0);
				document.documentElement.scrollTop = 0;
				document.body.scrollTop = 0;
			}
		});

		return () => unsubscribeStores();
	}, []);

	useEffect(() => {
		const unsubscribeDesired = onSnapshot(collection(db, "desiredStocks"), (snapshot) => {
			const globalDoc = snapshot.docs.find((d) => d.id === "global");
			if (globalDoc) {
				const data = globalDoc.data();
				if (data.boxSizes) {
					setBoxSizes(data.boxSizes);
				}
			}
		});

		return () => unsubscribeDesired();
	}, []);

	// Listener em tempo real do último reposicionamento salvo
	useEffect(() => {
		const unsubLatestRepo = onSnapshot(doc(db, "repositionState", "latest"), (docSnap) => {
			if (docSnap.exists()) {
				setLatestRepo(docSnap.data() as LatestRepositionState);
			} else {
				setLatestRepo(null);
			}
		});

		return () => unsubLatestRepo();
	}, []);

	// Movimentações agrupadas para o modal de reposicionamento
	const modalStoreMovements = useMemo(() => {
		if (!latestRepo || !latestRepo.movements) return { outgoings: [], incomings: [] };

		const outgoings = latestRepo.movements.filter((m) => m.from === selectedStoreModal);
		const incomings = latestRepo.movements.filter((m) => m.to === selectedStoreModal);

		return { outgoings, incomings };
	}, [latestRepo, selectedStoreModal]);

	// Total consolidado por item para a loja selecionada no reposicionamento
	const storeItemsSummary = useMemo(() => {
		const map: Record<string, { itemId: keyof StockData; name: string; qty: number; partners: { store: StoreId; qty: number }[] }> = {};

		if (selectedStoreModal === "lago") {
			// No lago: todas as saídas
			modalStoreMovements.outgoings.forEach((m) => {
				if (!map[m.itemId]) {
					map[m.itemId] = {
						itemId: m.itemId,
						name: STOCK_LABELS[m.itemId] || m.itemName,
						qty: 0,
						partners: [],
					};
				}
				map[m.itemId].qty += m.qty;
				map[m.itemId].partners.push({ store: m.to, qty: m.qty });
			});
		} else {
			// Nas demais lojas: todas as entradas/chegadas
			modalStoreMovements.incomings.forEach((m) => {
				if (!map[m.itemId]) {
					map[m.itemId] = {
						itemId: m.itemId,
						name: STOCK_LABELS[m.itemId] || m.itemName,
						qty: 0,
						partners: [],
					};
				}
				map[m.itemId].qty += m.qty;
				map[m.itemId].partners.push({ store: m.from, qty: m.qty });
			});
		}

		return Object.values(map);
	}, [modalStoreMovements, selectedStoreModal]);

	// Status da confirmação da loja selecionada
	const currentStoreConfirmation = useMemo(() => {
		return latestRepo?.confirmedStores?.[selectedStoreModal] || null;
	}, [latestRepo, selectedStoreModal]);

	// Executa a confirmação em lote do reposicionamento para a loja selecionada
	const handleConfirmStoreReposition = async () => {
		if (!latestRepo || isProcessingAction) return;

		const isLake = selectedStoreModal === "lago";
		const itemsToApply = storeItemsSummary;

		if (itemsToApply.length === 0) {
			setFeedbackMessage({
				type: "error",
				text: `Não há movimentações de ${isLake ? "saída" : "entrada"} registradas para ${STORE_NAMES[selectedStoreModal]}.`,
			});
			return;
		}

		setIsProcessingAction(true);
		setFeedbackMessage(null);

		try {
			const storeRef = doc(db, "stores", selectedStoreModal);
			const repoRef = doc(db, "repositionState", "latest");
			const movementsCollectionRef = collection(db, "stores", selectedStoreModal, "stockMovements");

			await runTransaction(db, async (transaction) => {
				const storeSnap = await transaction.get(storeRef);
				const repoSnap = await transaction.get(repoRef);

				if (!storeSnap.exists() || !repoSnap.exists()) {
					throw new Error("Dados da loja ou do reposicionamento não foram encontrados no servidor.");
				}

				const storeData = storeSnap.data();
				const storeStock = (storeData.stock || {}) as Partial<StockData>;
				const storeUnits = (storeData.isUnits || {}) as Partial<Record<keyof StockData, number>>;

				const appliedQuantities: Record<string, number> = {};
				const updates: Record<string, number> = {};
				const logItems: any[] = [];

				itemsToApply.forEach((item) => {
					const currentQty = storeStock[item.itemId] || 0;
					const delta = item.qty;
					// Se for Lago: subtrai do estoque. Se for outra loja: soma ao estoque.
					const newQty = isLake ? currentQty - delta : currentQty + delta;

					updates[`stock.${item.itemId}`] = newQty;
					appliedQuantities[item.itemId] = delta;

					const openUnits =
						typeof storeUnits[item.itemId] === "boolean"
							? storeUnits[item.itemId]
								? 1
								: 0
							: storeUnits[item.itemId] || 0;

					const partnerDesc = item.partners
						.map((p) => `${p.qty} un para ${STORE_NAMES[p.store]}`)
						.join(", ");

					logItems.push({
						ref: doc(movementsCollectionRef),
						data: {
							itemId: item.itemId,
							itemName: item.name,
							type: isLake ? "saida" : "recebido",
							quantity: delta,
							beforeStock: currentQty,
							afterStock: newQty,
							beforeOpen: openUnits,
							afterOpen: openUnits,
							obs: isLake
								? `Confirmação de saída de reposicionamento (${partnerDesc})`
								: `Confirmação de chegada de reposicionamento de ${STORE_NAMES["lago"]}`,
							timestamp: serverTimestamp(),
						},
					});
				});

				// Aplica alteração de estoque da loja
				transaction.update(storeRef, {
					...updates,
					lastStockUpdate: serverTimestamp(),
				});

				// Grava os logs de movimentação de estoque
				logItems.forEach((log) => {
					transaction.set(log.ref, log.data);
				});

				// Registra confirmação no documento latest
				transaction.update(repoRef, {
					[`confirmedStores.${selectedStoreModal}`]: {
						confirmed: true,
						confirmedAt: Timestamp.now(),
						type: isLake ? "saida" : "entrada",
						appliedQuantities,
					},
				});
			});

			setFeedbackMessage({
				type: "success",
				text: `Reposição de ${STORE_NAMES[selectedStoreModal]} confirmada com sucesso! Estoque real atualizado.`,
			});
		} catch (error: any) {
			console.error("Erro ao confirmar reposicionamento:", error);
			setFeedbackMessage({
				type: "error",
				text: error.message || "Erro ao confirmar reposicionamento no banco de dados.",
			});
		} finally {
			setIsProcessingAction(false);
		}
	};

	// Desfaz a confirmação de reposicionamento e reverte o estoque da loja
	const handleUndoStoreReposition = async () => {
		if (!latestRepo || isProcessingAction || !currentStoreConfirmation) return;

		setIsProcessingAction(true);
		setFeedbackMessage(null);

		try {
			const isLake = selectedStoreModal === "lago";
			const storeRef = doc(db, "stores", selectedStoreModal);
			const repoRef = doc(db, "repositionState", "latest");
			const movementsCollectionRef = collection(db, "stores", selectedStoreModal, "stockMovements");

			await runTransaction(db, async (transaction) => {
				const storeSnap = await transaction.get(storeRef);
				const repoSnap = await transaction.get(repoRef);

				if (!storeSnap.exists() || !repoSnap.exists()) {
					throw new Error("Dados da loja ou reposicionamento não encontrados.");
				}

				const storeData = storeSnap.data();
				const storeStock = (storeData.stock || {}) as Partial<StockData>;
				const storeUnits = (storeData.isUnits || {}) as Partial<Record<keyof StockData, number>>;

				const appliedQuantities = currentStoreConfirmation.appliedQuantities || {};
				const updates: Record<string, number> = {};
				const logItems: any[] = [];

				Object.entries(appliedQuantities).forEach(([itemId, qty]) => {
					const currentQty = storeStock[itemId as keyof StockData] || 0;
					// Reverter: se era saída (Lago), devolve somando. Se era chegada (outras), subtrai.
					const newQty = isLake ? currentQty + qty : currentQty - qty;

					updates[`stock.${itemId}`] = newQty;

					const openUnits =
						typeof storeUnits[itemId as keyof StockData] === "boolean"
							? storeUnits[itemId as keyof StockData]
								? 1
								: 0
							: storeUnits[itemId as keyof StockData] || 0;

					logItems.push({
						ref: doc(movementsCollectionRef),
						data: {
							itemId,
							itemName: STOCK_LABELS[itemId as keyof StockData] || itemId,
							type: isLake ? "recebido" : "saida",
							quantity: qty,
							beforeStock: currentQty,
							afterStock: newQty,
							beforeOpen: openUnits,
							afterOpen: openUnits,
							obs: isLake
								? "Estorno de confirmação de saída de reposicionamento"
								: "Estorno de confirmação de chegada de reposicionamento",
							timestamp: serverTimestamp(),
						},
					});
				});

				// Reverte o estoque da loja
				transaction.update(storeRef, {
					...updates,
					lastStockUpdate: serverTimestamp(),
				});

				// Registra os logs de estorno
				logItems.forEach((log) => {
					transaction.set(log.ref, log.data);
				});

				// Remove confirmação do documento latest
				transaction.update(repoRef, {
					[`confirmedStores.${selectedStoreModal}`]: {
						confirmed: false,
						confirmedAt: null,
						type: isLake ? "saida" : "entrada",
						appliedQuantities: {},
					},
				});
			});

			setFeedbackMessage({
				type: "success",
				text: `Confirmação de reposicionamento de ${STORE_NAMES[selectedStoreModal]} desfeita e estoque estornado com sucesso!`,
			});
		} catch (error: any) {
			console.error("Erro ao desfazer confirmação:", error);
			setFeedbackMessage({
				type: "error",
				text: error.message || "Erro ao desfazer confirmação no banco de dados.",
			});
		} finally {
			setIsProcessingAction(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando estoque...</p>
			</div>
		);
	}

	return (
		<>
			<style
				dangerouslySetInnerHTML={{
					__html: `
				@media print {
					@page {
						size: A4;
						margin: 25mm 25mm 15mm 25mm;
					}
					* {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						color-adjust: exact !important;
					}
					body {
						background: white !important;
						color: black !important;
						font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
						padding: 0 !important;
					}
					main {
						padding: 0 !important;
						margin: 0 !important;
					}
					nav, header, footer, .print\\:hidden, button {
						display: none !important;
					}
					.bg-white, .dark\\:bg-slate-900 {
						background: white !important;
						border: none !important;
						box-shadow: none !important;
					}
					table {
						width: max-content !important;
						max-width: 100% !important;
						border-collapse: collapse !important;
						table-layout: auto;
						margin: 0 auto !important;
						border: 0.5pt solid #ccc !important;
					}
					table, tr, th, td {
						border: 0.5pt solid #ccc !important;
					}
					th, td {
						padding: 2px 6px !important;
						font-size: 8.5pt !important;
						color: black !important;
						background: transparent !important;
						line-height: 1.1 !important;
						font-weight: normal !important;
					}
					th {
						text-transform: uppercase !important;
						background-color: white !important;
						font-weight: normal !important;
					}
					.text-2xl, .text-lg {
						font-size: 8.5pt !important;
						font-weight: normal !important;
					}
					h1 {
						font-size: 10pt !important;
						font-weight: bold !important;
						margin-top: 10mm !important;
						margin-bottom: 8px !important;
						text-align: center;
					}
					.sticky {
						position: static !important;
					}
					.whitespace-nowrap {
						white-space: nowrap !important;
					}
					/* Reset specific colors and backgrounds */
					.text-blue-700, .text-blue-600, .text-slate-600, .text-slate-400, .text-slate-300, .text-slate-900, .text-slate-100 {
						color: black !important;
					}
					.bg-blue-50, .dark\\:bg-blue-900\\/30, .bg-slate-50, .dark\\:bg-slate-800, .bg-white, .bg-slate-100\\/80, .dark\\:bg-slate-800\\/80, .bg-slate-100\\/90, .dark\\:bg-slate-800\\/90, .bg-blue-50\\/50 {
						background: transparent !important;
					}
					tr[class*="bg-slate-100"], tr[class*="bg-slate-100"] td, tr[class*="bg-slate-100"] th {
						background: transparent !important;
						background-color: transparent !important;
					}
					/* Layout adjustments to save space */
					.p-6 { padding: 2px 6px !important; }
					.gap-2, .gap-9 { gap: 2px !important; }
					th, td { min-width: 0 !important; width: auto !important; }
					th span, td span, td div, td th, .font-black, .font-extrabold, .font-bold { font-size: 8.5pt !important; font-weight: normal !important; }
					.print-box-size {
						font-size: 6.5pt !important;
						color: #444444 !important;
						font-weight: normal !important;
					}
					.print-qty-cell,
					.print-qty-span {
						font-size: 10.5pt !important;
						font-weight: bold !important;
						line-height: 1 !important;
					}
					tr {
						page-break-inside: avoid;
					}
				}
			`,
				}}
			/>

			<div className="hidden print:block">
				<h1 className="text-2xl font-black uppercase">
					Relatório de Estoque Atual - {new Date().toLocaleDateString("pt-BR")}
				</h1>
			</div>

			{/* Actions Bar: Filter & Print */}
			<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 md:gap-4 print:hidden">
				<div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto">
					<div className="relative flex-1 group">
						<Search
							size={18}
							className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
						/>
						<input
							type="text"
							placeholder="Filtrar por sabor..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 md:py-3 pl-12 pr-4 text-sm md:text-lg font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
						/>
					</div>
				</div>

				<div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
					<button
						onClick={() => {
							setShowReposModal(true);
							setFeedbackMessage(null);
						}}
						className="flex-1 sm:flex-none justify-center flex items-center gap-2 md:gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:border-blue-400 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-xs md:text-sm">
						<SlidersHorizontal size={18} />
						REPOSICIONAMENTO
						{latestRepo?.confirmedStores && Object.values(latestRepo.confirmedStores).some((cs) => cs.confirmed) && (
							<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
						)}
					</button>

					<button
						onClick={() => setHideOpen(!hideOpen)}
						className="flex-1 sm:flex-none justify-center flex items-center gap-2 md:gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-xs md:text-sm">
						{hideOpen ? <Eye size={18} /> : <EyeOff size={18} />}
						{hideOpen ? "MOSTRAR ABERTOS" : "OCULTAR ABERTOS"}
					</button>

					<button
						onClick={() => window.print()}
						className="flex-1 sm:flex-none justify-center flex items-center gap-2 md:gap-3 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black shadow-lg shadow-blue-100 dark:shadow-none transition-all cursor-pointer text-xs md:text-sm">
						<Printer size={18} />
						IMPRIMIR TABELA
					</button>
				</div>
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
								<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 min-w-[7.5rem] md:min-w-[11.25rem]">
									<div className="flex items-center gap-3 md:gap-9">
										ITEM
										<button
											onClick={rotateStores}
											className="cursor-pointer p-1.5 md:p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all shadow-sm print:hidden"
											title="Mover primeira loja para o final">
											<ArrowLeftRight size={18} className="md:w-[22px] md:h-[22px]" />
										</button>
									</div>
								</th>
								<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 min-w-[5.5rem] md:min-w-[7.5rem]">
									TOTAL
								</th>
								{allData.map((store) => (
									<th
										key={store.id}
										className="p-3 md:p-6 text-center text-[0.6rem] md:text-[0.6875rem] font-black text-blue-600 dark:text-blue-400 tracking-widest border-l border-slate-200 dark:border-slate-700 min-w-[6.5rem] md:min-w-[8.75rem]">
										<div className="flex flex-col items-center gap-1 md:gap-2">
											<span className="text-[0.7rem] md:text-[0.87rem] font-extrabold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-slate-100 dark:border-slate-700 whitespace-nowrap">
												{formatDate(store.lastStockUpdate)}
											</span>
											<span className="leading-tight text-lg md:text-2xl">{store.name}</span>
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{(() => {
								const filteredEntries = sortStockEntries(Object.entries(STOCK_LABELS)).filter(([_, label]) =>
									normalizeSearchText(label).includes(normalizeSearchText(searchTerm))
								);

								// Helper para extrair número de abertos de forma consistente
								const getOpenCount = (store: FullStoreData, key: keyof StockData) => {
									const openVal = store.isUnits?.[key];
									return typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
								};

								// Totais por loja (pacotes fechados e pacotes abertos)
								const storeTotals = allData.map((store) => {
									const closed = filteredEntries.reduce((sum, [key]) => sum + (store.stock[key] || 0), 0);
									const open = filteredEntries.reduce((sum, [key]) => sum + getOpenCount(store, key), 0);
									return { closed, open };
								});

								const overallClosed = storeTotals.reduce((sum, s) => sum + s.closed, 0);
								const overallOpen = storeTotals.reduce((sum, s) => sum + s.open, 0);

								// Helper para pluralização do termo aberto
								const formatOpenText = (count: number) => `${count} ${count > 1 ? "abertos" : "aberto"}`;

								const renderTotalRow = (isTop: boolean) => (
									<tr
										key={isTop ? "total-row-top" : "total-row-bottom"}
										className={`border-b border-slate-200 dark:border-slate-700 font-black ${
											isTop
												? "bg-slate-100/80 dark:bg-slate-800/80 border-b-2"
												: "bg-slate-100/80 dark:bg-slate-800/80 border-t-2"
										}`}>
										<td className="p-3 md:p-5 text-sm md:text-lg font-black text-slate-700 dark:text-slate-200 sticky left-0 bg-slate-100/90 dark:bg-slate-800/90 z-10 border-r border-slate-200 dark:border-slate-700 uppercase">
											TOTAL DE PACOTES
										</td>
										<td className="p-3 md:p-5 text-center border-l border-slate-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/30 print-qty-cell">
											<div className="flex justify-center items-center">
												{overallClosed > 0 || overallOpen === 0 || hideOpen ? (
													<span
														className={`pr-1 md:pr-2 text-base md:text-2xl font-black print-qty-span ${
															overallClosed === 0 && (overallOpen === 0 || hideOpen)
																? "text-slate-300 dark:text-slate-400"
																: "text-slate-900 dark:text-slate-100"
														}`}>
														{overallClosed}
													</span>
												) : null}
												{!hideOpen && overallOpen > 0 && (
													<span className="text-xs md:text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
														{overallClosed > 0 ? `+ ${formatOpenText(overallOpen)}` : formatOpenText(overallOpen)}
													</span>
												)}
											</div>
										</td>
										{allData.map((store, idx) => {
											const { closed, open } = storeTotals[idx];
											return (
												<td
													key={`total-${isTop ? "top" : "bottom"}-${store.id}`}
													className="p-3 md:p-5 text-center border-l border-slate-200 dark:border-slate-700 print-qty-cell">
													<div className="flex justify-center items-center">
														{closed > 0 || open === 0 || hideOpen ? (
															<span
																className={`pr-1 md:pr-2 text-base md:text-2xl font-black print-qty-span ${
																	closed === 0 && (open === 0 || hideOpen)
																		? "text-slate-300 dark:text-slate-400"
																		: "text-slate-900 dark:text-slate-100"
																}`}>
																{closed}
															</span>
														) : null}
														{!hideOpen && open > 0 && (
															<span className="text-xs md:text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
																{closed > 0 ? `+ ${formatOpenText(open)}` : formatOpenText(open)}
															</span>
														)}
													</div>
												</td>
											);
										})}
									</tr>
								);

								return (
									<>
										{renderTotalRow(true)}
										{filteredEntries.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const itemClosedTotal = allData.reduce((sum, store) => sum + (store.stock[key] || 0), 0);
											const itemOpenTotal = allData.reduce((sum, store) => sum + getOpenCount(store, key), 0);
											const boxSize = boxSizes[itemKey] || 0;

											return (
												<tr
													key={key}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 z-10 border-r border-slate-50 dark:border-slate-800 transition-colors uppercase">
														<div className="flex items-center gap-1.5">
															<span>{label}</span>
															{boxSize > 0 && (
																<span className="!text-xl md:text-base font-black text-slate-400 dark:text-slate-500 normal-case print-box-size">
																	({boxSize})
																</span>
															)}
														</div>
													</td>
													<td className="p-3 md:p-6 text-center border-l border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 print-qty-cell">
														<div className="flex justify-center items-center">
															{itemClosedTotal > 0 || itemOpenTotal === 0 || hideOpen ? (
																<span
																	className={`pr-1 md:pr-2 text-base md:text-2xl font-black print-qty-span ${
																		itemClosedTotal === 0 && (itemOpenTotal === 0 || hideOpen)
																			? "text-slate-300 dark:text-slate-400"
																			: "text-slate-900 dark:text-slate-100"
																	}`}>
																	{itemClosedTotal}
																</span>
															) : null}
															{!hideOpen && itemOpenTotal > 0 && (
																<span className="text-xs md:text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
																	{itemClosedTotal > 0 ? `+ ${formatOpenText(itemOpenTotal)}` : formatOpenText(itemOpenTotal)}
																</span>
															)}
														</div>
													</td>
													{allData.map((store) => {
														const qty = store.stock[key] || 0;
														const openCount = getOpenCount(store, key);
														return (
															<td
																key={store.id}
																className="p-3 md:p-6 text-center border-l border-slate-100 dark:border-slate-800 print-qty-cell">
																<div className="flex justify-center items-center">
																	{qty > 0 || openCount === 0 || hideOpen ? (
																		<span
																			className={`pr-1 md:pr-2 text-base md:text-2xl font-black print-qty-span ${
																				qty === 0 && (openCount === 0 || hideOpen)
																					? "text-slate-300 dark:text-slate-400"
																					: "text-slate-900 dark:text-slate-100"
																			}`}>
																			{qty}
																		</span>
																	) : null}
																	{!hideOpen && openCount > 0 && (
																		<span className="text-xs md:text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
																			{qty > 0 ? `+ ${formatOpenText(openCount)}` : formatOpenText(openCount)}
																		</span>
																	)}
																</div>
															</td>
														);
													})}
												</tr>
											);
										})}
										{renderTotalRow(false)}
									</>
								);
							})()}
						</tbody>
					</table>
				</div>
			</div>
			{/* Modal de Confirmação de Reposicionamento */}
			{showReposModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 print:hidden">
					<div
						onClick={(e) => e.stopPropagation()}
						className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
						{/* Cabeçalho do Modal */}
						<div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-200 dark:border-blue-800">
									<SlidersHorizontal size={24} />
								</div>
								<div>
									<h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
										Confirmação de Reposicionamento
									</h3>
									<p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
										{latestRepo?.formattedDate
											? `Último reposicionamento salvo em: ${latestRepo.formattedDate}`
											: "Nenhum reposicionamento recente encontrado."}
									</p>
								</div>
							</div>

							<button
								type="button"
								onClick={() => setShowReposModal(false)}
								className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-all cursor-pointer">
								<X size={20} />
							</button>
						</div>

						{/* Mensagem de Feedback Toast dentro do Modal */}
						{feedbackMessage && (
							<div
								className={`mx-6 mt-4 p-4 rounded-2xl font-bold text-xs md:text-sm flex items-center gap-3 transition-all ${
									feedbackMessage.type === "success"
										? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
										: "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
								}`}>
								{feedbackMessage.type === "success" ? (
									<CheckCircle2 className="shrink-0 text-emerald-600 dark:text-emerald-400" size={20} />
								) : (
									<AlertTriangle className="shrink-0 text-red-600 dark:text-red-400" size={20} />
								)}
								<span>{feedbackMessage.text}</span>
							</div>
						)}

						{/* Seletor das 4 Lojas */}
						<div className="px-6 md:px-8 pt-6">
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
								{STORE_ORDER.map((sId) => {
									const isSelected = selectedStoreModal === sId;
									const conf = latestRepo?.confirmedStores?.[sId];
									const isConfirmed = !!conf?.confirmed;

									return (
										<button
											key={sId}
											type="button"
											onClick={() => {
												setSelectedStoreModal(sId);
												setFeedbackMessage(null);
											}}
											className={`py-2.5 px-3 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
												isSelected
													? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
													: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
											}`}>
											<span>{STORE_NAMES[sId]}</span>
											{isConfirmed && (
												<span className="w-2 h-2 rounded-full bg-emerald-500" title="Confirmado" />
											)}
										</button>
									);
								})}
							</div>
						</div>

						{/* Conteúdo Principal do Modal: Lista de Itens */}
						<div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-4">
							{/* Faixa de Status da Loja */}
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
								<div className="flex items-center gap-3">
									<div
										className={`p-2.5 rounded-xl ${
											selectedStoreModal === "lago"
												? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
												: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
										}`}>
										{selectedStoreModal === "lago" ? (
											<ArrowUpRight size={20} strokeWidth={2.5} />
										) : (
											<ArrowDownLeft size={20} strokeWidth={2.5} />
										)}
									</div>
									<div>
										<h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
											{selectedStoreModal === "lago"
												? "Saídas do Lago (Para as demais lojas)"
												: `Chegadas / Entradas em ${STORE_NAMES[selectedStoreModal]}`}
										</h4>
										<p className="text-xs text-slate-500 dark:text-slate-400">
											{selectedStoreModal === "lago"
												? "Total de pacotes que saem do Lago para abastecer outras lojas."
												: `Total de pacotes a serem adicionados ao estoque de ${STORE_NAMES[selectedStoreModal]}.`}
										</p>
									</div>
								</div>

								{/* Badge de Status da Confirmação */}
								<div className="shrink-0">
									{currentStoreConfirmation?.confirmed ? (
										<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
											<Check size={14} className="stroke-[3]" />
											Confirmado e aplicado no estoque
										</span>
									) : (
										<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
											Pendente de confirmação
										</span>
									)}
								</div>
							</div>

							{/* Tabela / Lista de Pacotes */}
							{storeItemsSummary.length === 0 ? (
								<div className="py-12 text-center text-slate-400 dark:text-slate-500">
									<p className="text-sm font-bold uppercase tracking-wider">
										Nenhuma movimentação de {selectedStoreModal === "lago" ? "saída" : "entrada"} registrada para esta loja.
									</p>
								</div>
							) : (
								<div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
									<div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
										<span>Sabor / Item</span>
										<span>Quantidade Reposicionada</span>
									</div>

									<div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
										{storeItemsSummary.map((item) => (
											<div
												key={item.itemId}
												className="px-4 py-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
												<div className="flex flex-col min-w-0">
													<span className="text-sm md:text-base font-black text-slate-800 dark:text-slate-200 truncate uppercase">
														{item.name}
													</span>
													<span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
														{selectedStoreModal === "lago"
															? item.partners.map((p) => `${p.qty} un para ${STORE_NAMES[p.store]}`).join(" • ")
															: item.partners.map((p) => `${p.qty} un vindo de ${STORE_NAMES[p.store]}`).join(" • ")}
													</span>
												</div>

												<div className="shrink-0 flex items-center gap-2">
													<span
														className={`text-sm md:text-base font-black px-3 py-1 rounded-xl whitespace-nowrap ${
															selectedStoreModal === "lago"
																? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40"
																: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
														}`}>
														{selectedStoreModal === "lago" ? `-${item.qty}` : `+${item.qty}`}{" "}
														{item.qty === 1 ? "pacote" : "pacotes"}
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>

						{/* Rodapé do Modal com Ações */}
						<div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
							<div>
								<p className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
									A confirmação aplica as quantidades diretamente no estoque real da loja.
								</p>
							</div>

							<div className="flex items-center gap-3 w-full sm:w-auto">
								{/* Botão Desfazer Confirmação */}
								{currentStoreConfirmation?.confirmed && (
									<button
										type="button"
										disabled={isProcessingAction}
										onClick={handleUndoStoreReposition}
										className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs md:text-sm font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50">
										{isProcessingAction ? (
											<RefreshCw size={16} className="animate-spin" />
										) : (
											<RotateCcw size={16} />
										)}
										Desfazer Confirmação
									</button>
								)}

								{/* Botão de Confirmação Único */}
								<button
									type="button"
									disabled={isProcessingAction || storeItemsSummary.length === 0 || !!currentStoreConfirmation?.confirmed}
									onClick={handleConfirmStoreReposition}
									className={`flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-wider text-white transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
										currentStoreConfirmation?.confirmed
											? "bg-slate-400 dark:bg-slate-600 cursor-not-allowed"
											: selectedStoreModal === "lago"
											? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
											: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
									}`}>
									{isProcessingAction ? (
										<RefreshCw size={16} className="animate-spin" />
									) : (
										<Check size={18} strokeWidth={3} />
									)}
									{currentStoreConfirmation?.confirmed
										? "Já Confirmado"
										: selectedStoreModal === "lago"
										? "Confirmar Saídas do Lago"
										: `Confirmar Entradas em ${STORE_NAMES[selectedStoreModal]}`}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
