"use client";

import { useEffect, useState, Fragment, useRef } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	getDocs,
	query,
	orderBy,
	where,
	Timestamp,
	runTransaction,
	doc,
	collectionGroup,
	limit,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	StockData,
	STORE_NAMES,
	StoreId,
	formatDate,
	RepositionHistory,
} from "@/types";
import {
	RefreshCw,
	ArrowRight,
	ArrowRightLeft,
	ChevronDown,
	ChevronUp,
	Save,
	Send,
	Printer,
	MessageCircle,
	History,
	Search,
} from "lucide-react";


interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, number>>;
}

const STORE_ORDER: StoreId[] = ["lago", "conjunto", "terraco", "noroeste"];

export default function EstoqueReposicionarPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const isInitialized = useRef(false);

	// Transfer state per item
	const [itemTransfers, setItemTransfers] = useState<
		Record<string, { from: StoreId; to: StoreId; qty: number }>
	>({});

	const [projectedStocks, setProjectedStocks] = useState<Record<StoreId, Partial<StockData>>>({
		conjunto: {},
		terraco: {},
		lago: {},
		noroeste: {},
	});
	const [savingRepos, setSavingRepos] = useState(false);
	const [expandedItem, setExpandedItem] = useState<keyof StockData | null>(null);
	const [historyForItem, setHistoryForItem] = useState<RepositionHistory[]>([]);
	const [loadingLastRepo, setLoadingLastRepo] = useState(false);
	const [showAllHistory, setShowAllHistory] = useState(false);
	const [allHistory, setAllHistory] = useState<RepositionHistory[]>([]);
	const [loadingAllHistory, setLoadingAllHistory] = useState(false);
	const [showSummary, setShowSummary] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(false);
	const [negativeStockWarning, setNegativeStockWarning] = useState<{
		store: StoreId;
		item: keyof StockData;
		qty: number;
		onConfirm: () => void;
	} | null>(null);

	const [searchTerm, setSearchTerm] = useState("");
	const [isPrintingChecklist, setIsPrintingChecklist] = useState(false);

	// Load from localStorage on mount
	useEffect(() => {
		const savedProjected = localStorage.getItem("repos_projected_stocks");
		const savedTransfers = localStorage.getItem("repos_item_transfers");
		
		if (savedProjected) {
			setProjectedStocks(JSON.parse(savedProjected));
			// Se carregamos do localStorage, marcamos como inicializado para evitar sobreposição
			isInitialized.current = true;
		}
		if (savedTransfers) setItemTransfers(JSON.parse(savedTransfers));
	}, []);

	// Save to localStorage on change
	useEffect(() => {
		// Apenas salvamos se já foi inicializado (seja via localStorage ou via allData pela primeira vez)
		if (isInitialized.current && Object.keys(projectedStocks.lago).length > 0) {
			localStorage.setItem("repos_projected_stocks", JSON.stringify(projectedStocks));
		}
	}, [projectedStocks]);

	useEffect(() => {
		if (isInitialized.current && Object.keys(itemTransfers).length > 0) {
			localStorage.setItem("repos_item_transfers", JSON.stringify(itemTransfers));
		}
	}, [itemTransfers]);

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

	// Inicialização única baseada no allData (apenas se não houver dados no localStorage)
	useEffect(() => {
		if (allData.length > 0 && !isInitialized.current) {
			const initialProjected: any = {};
			allData.forEach((store) => {
				initialProjected[store.id] = { ...store.stock };
			});
			setProjectedStocks(initialProjected);

			// Initialize default transfers: Lago as source, Conjunto as target
			const initialTransfers: any = {};
			Object.keys(STOCK_LABELS).forEach((key) => {
				initialTransfers[key] = { from: "lago", to: "conjunto", qty: 0 };
			});
			setItemTransfers(initialTransfers);
			
			// Marcamos como inicializado IMEDIATAMENTE após a primeira carga do Firestore
			isInitialized.current = true;
		}
	}, [allData]);

	const resetProjectedStocks = () => {
		setShowResetConfirm(true);
	};

	const confirmResetProjectedStocks = () => {
		const initialProjected: any = {};
		allData.forEach((store) => {
			initialProjected[store.id] = { ...store.stock };
		});
		setProjectedStocks(initialProjected);

		const resetTransfers: any = {};
		Object.keys(STOCK_LABELS).forEach((key) => {
			resetTransfers[key] = { from: "lago", to: "conjunto", qty: 0 };
		});
		setItemTransfers(resetTransfers);
		setShowResetConfirm(false);
	};

	const applyMovement = (key: keyof StockData) => {
		const transfer = itemTransfers[key];
		if (!transfer || transfer.qty <= 0 || transfer.from === transfer.to) return;

		const currentFromStock = projectedStocks[transfer.from][key] || 0;
		const resultQty = currentFromStock - transfer.qty;

		const performUpdate = () => {
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
			setItemTransfers((prev) => ({
				...prev,
				[key]: { ...prev[key], qty: 0 },
			}));
			setNegativeStockWarning(null);
		};

		if (resultQty < 0) {
			setNegativeStockWarning({
				store: transfer.from,
				item: key,
				qty: resultQty,
				onConfirm: performUpdate,
			});
		} else {
			performUpdate();
		}
	};

	const sortedItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][])
		.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
		.sort((a, b) => a[1].localeCompare(b[1]));

	const calculateOptimizedSummary = () => {
		const movements: { item: keyof StockData; from: StoreId; to: StoreId; qty: number }[] = [];
		sortedItems.forEach(([itemKey, _]) => {
			const storeChanges: { storeId: StoreId; diff: number }[] = [];
			allData.forEach((store) => {
				const initial = store.stock[itemKey] || 0;
				const projected = projectedStocks[store.id][itemKey] || 0;
				const diff = projected - initial;
				if (diff !== 0) storeChanges.push({ storeId: store.id, diff });
			});
			const sources = storeChanges.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff);
			const sinks = storeChanges.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff);
			let sourceIdx = 0;
			let sinkIdx = 0;
			while (sourceIdx < sources.length && sinkIdx < sinks.length) {
				const source = sources[sourceIdx];
				const sink = sinks[sinkIdx];
				const amountToMove = Math.min(Math.abs(source.diff), sink.diff);
				movements.push({
					item: itemKey,
					from: source.storeId,
					to: sink.storeId,
					qty: amountToMove,
				});
				source.diff += amountToMove;
				sink.diff -= amountToMove;
				if (source.diff === 0) sourceIdx++;
				if (sink.diff === 0) sinkIdx++;
			}
		});
		return movements;
	};

	const saveReposition = async () => {
		setSavingRepos(true);
		try {
			const optimizedMovements = calculateOptimizedSummary();
			if (optimizedMovements.length === 0) {
				alert("Não há movimentações para salvar.");
				setSavingRepos(false);
				return false;
			}
			await runTransaction(db, async (transaction) => {
				for (const move of optimizedMovements) {
					const newId = doc(collection(db, "unused")).id;
					const historyEntry: RepositionHistory = {
						timestamp: Timestamp.now(),
						itemId: move.item,
						fromStore: move.from,
						toStore: move.to,
						beforeFrom: allData.find((d) => d.id === move.from)?.stock[move.item] || 0,
						afterFrom: projectedStocks[move.from][move.item] || 0,
						beforeTo: allData.find((d) => d.id === move.to)?.stock[move.item] || 0,
						afterTo: projectedStocks[move.to][move.item] || 0,
						difference: move.qty,
					};
					transaction.set(doc(db, "stores", move.from, "repositions", newId), historyEntry);
					transaction.set(doc(db, "stores", move.to, "repositions", newId), historyEntry);
				}
			});
			// Removido o alert de sucesso para não interromper o fluxo de WhatsApp/Impressão
			return true;
		} catch (error) {
			console.error("Erro ao salvar reposicionamento:", error);
			alert("Erro ao salvar no histórico. Verifique o console.");
			return false;
		} finally {
			setSavingRepos(false);
		}
	};

	const handlePrint = () => {
		window.print();
	};

	const handlePrintChecklist = () => {
		setIsPrintingChecklist(true);
		document.body.classList.add("checklist-print-active");
		setTimeout(() => {
			window.print();
			document.body.classList.remove("checklist-print-active");
			setIsPrintingChecklist(false);
		}, 150);
	};

	const handleWhatsApp = () => {
		const movements = calculateOptimizedSummary();
		if (movements.length === 0) return;

		const grouped = new Map<
			string,
			{ from: StoreId; to: StoreId; items: { label: string; qty: number }[] }
		>();
		movements.forEach((move) => {
			const key = `${move.from}-${move.to}`;
			if (!grouped.has(key)) {
				grouped.set(key, { from: move.from, to: move.to, items: [] });
			}
			grouped.get(key)!.items.push({
				label: STOCK_LABELS[move.item],
				qty: move.qty,
			});
		});

		let text = `*Resumo de Reposicionamento - ${new Date().toLocaleDateString("pt-BR")}*\n\n`;

		Array.from(grouped.values()).forEach((group) => {
			text += `*${STORE_NAMES[group.from]} → ${STORE_NAMES[group.to]}:*\n`;
			group.items.forEach((item) => {
				text += `• ${item.qty} ${item.label}\n`;
			});
			text += `\n`;
		});

		const encodedText = encodeURIComponent(text);
		window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
	};

	const fetchAllHistory = async () => {
		setLoadingAllHistory(true);
		try {
			const fourWeeksAgo = new Date();
			fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
			const tsLimit = Timestamp.fromDate(fourWeeksAgo);

			const q = query(
				collectionGroup(db, "repositions"),
				where("timestamp", ">=", tsLimit),
				orderBy("timestamp", "desc"),
				limit(200)
			);
			const snap = await getDocs(q);
			const seen = new Set();
			const history = snap.docs
				.map(doc => ({ id: doc.id, ...doc.data() } as RepositionHistory))
				.filter(item => {
					const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
					if (seen.has(uniqueKey)) return false;
					seen.add(uniqueKey);
					return true;
				});
			setAllHistory(history);
			setShowAllHistory(true);
		} catch (error) {
			console.error("Erro ao buscar histórico completo:", error);
			// Fallback: buscar das lojas principais sem orderBy (evita erro de índice)
			try {
				const fourWeeksAgo = new Date();
				fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
				const tsLimit = Timestamp.fromDate(fourWeeksAgo);

				const allRepos: RepositionHistory[] = [];
				for (const storeId of STORE_ORDER) {
					const qStore = query(
						collection(db, "stores", storeId, "repositions"),
						where("timestamp", ">=", tsLimit),
						limit(100)
					);
					const snapStore = await getDocs(qStore);
					snapStore.docs.forEach(doc => {
						allRepos.push({ id: doc.id, ...doc.data() } as RepositionHistory);
					});
				}
				const seen = new Set();
				const sortedUnique = allRepos
					.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
					.filter(item => {
						const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
						if (seen.has(uniqueKey)) return false;
						seen.add(uniqueKey);
						return true;
					});
				setAllHistory(sortedUnique);
				setShowAllHistory(true);
			} catch (err) {
				console.error("Erro no fallback de histórico completo:", err);
				alert("Não foi possível carregar o histórico. Verifique sua conexão.");
			}
		} finally {
			setLoadingAllHistory(false);
		}
	};

	const fetchItemHistory = async (itemId: keyof StockData) => {
		setLoadingLastRepo(true);
		setHistoryForItem([]);
		try {
			const fourWeeksAgo = new Date();
			fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
			const tsLimit = Timestamp.fromDate(fourWeeksAgo);

			// Esta query requer um índice de Collection Group (itemId ASC, timestamp DESC)
			// O link para criação aparece no console do navegador/terminal em caso de erro
			const q = query(
				collectionGroup(db, "repositions"),
				where("itemId", "==", itemId),
				where("timestamp", ">=", tsLimit),
				orderBy("timestamp", "desc"),
				limit(20)
			);
			const snap = await getDocs(q);
			const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepositionHistory));
			const seen = new Set();
			const uniqueHistory = history.filter(item => {
				const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
				if (seen.has(uniqueKey)) return false;
				seen.add(uniqueKey);
				return true;
			});
			setHistoryForItem(uniqueHistory);
		} catch (error) {
			console.error("Erro ao buscar histórico do item (tentando fallback):", error);
			// Fallback: buscar por loja e filtrar em memória para evitar erro de índice
			try {
				const fourWeeksAgo = new Date();
				fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
				const tsLimitMillis = fourWeeksAgo.getTime();

				const allRepos: RepositionHistory[] = [];
				for (const storeId of STORE_ORDER) {
					// Consultamos apenas pelo itemId (índice padrão)
					// Filtramos a data em memória para não exigir índice composto (itemId + timestamp)
					const qStore = query(
						collection(db, "stores", storeId, "repositions"),
						where("itemId", "==", itemId),
						limit(50)
					);
					const snapStore = await getDocs(qStore);
					snapStore.docs.forEach(doc => {
						const data = doc.data() as RepositionHistory;
						if (data.timestamp.toMillis() >= tsLimitMillis) {
							allRepos.push({ id: doc.id, ...data });
						}
					});
				}
				const seen = new Set();
				const sortedUnique = allRepos
					.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
					.filter(item => {
						const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
						if (seen.has(uniqueKey)) return false;
						seen.add(uniqueKey);
						return true;
					});
				setHistoryForItem(sortedUnique);
			} catch (err) {
				console.error("Erro no fallback de histórico por item:", err);
			}
		} finally {
			setLoadingLastRepo(false);
		}
	};

	useEffect(() => {
		if (expandedItem) fetchItemHistory(expandedItem);
	}, [expandedItem]);

	if (loading)
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando estoque...</p>
			</div>
		);

	return (
		<>
			<style
				dangerouslySetInnerHTML={{
					__html: `
				@media print {
					@page {
						size: A4;
						margin: 15mm;
					}
					* {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						color-adjust: exact !important;
						font-weight: normal !important;
					}
					body {
						background: white !important;
						color: black !important;
						font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
						overflow: visible !important;
						padding: 15mm !important; /* Força margem interna mesmo que a impressora esteja em 'sem margens' */
					}
					main {
						padding: 0 !important;
						margin: 0 !important;
					}
					nav, header, footer, .print\\:hidden, button {
						display: none !important;
					}
					/* Summary Modal Printing */
					#modal-resumo-print {
						position: static !important;
						display: block !important;
						width: 100% !important;
						height: auto !important;
						background: white !important;
						padding: 0 !important;
						border: none !important;
						box-shadow: none !important;
					}
					#modal-resumo-print > div {
						max-width: none !important;
						max-height: none !important;
						height: auto !important;
						overflow: visible !important;
						position: static !important;
						border: none !important;
						box-shadow: none !important;
						background: white !important;
						padding: 0 !important;
					}
					.p-8, .p-6 {
						padding: 4px !important;
					}
					.text-2xl {
						font-size: 10pt !important;
						text-align: center;
						margin-bottom: 10px !important;
						color: black !important;
					}
					.text-sm, .text-slate-600 {
						font-size: 8pt !important;
						color: black !important;
					}
					.font-black, .font-bold {
						font-weight: normal !important;
					}
					.border, .border-b, .border-t, .print\\:border-b-2, .print\\:border-black {
						border: none !important;
					}
					.bg-slate-50, .dark\\:bg-slate-800, .bg-white, .dark\\:bg-slate-900 {
						background: transparent !important;
					}
					.p-8, .p-6, .p-4 {
						padding: 2px 0 !important;
					}
					.mb-3, .mb-4, .mb-6, .mb-10 {
						margin-bottom: 4px !important;
					}
					.rounded-3xl, .rounded-\\[2rem\\] {
						border-radius: 0 !important;
					}
					.space-y-6 > * + * {
						margin-top: 4px !important;
					}
					.mb-3 {
						margin-bottom: 2px !important;
					}
					/* Hide other elements that might overlap */
					.fixed.inset-0:not(#modal-resumo-print) {
						display: none !important;
					}

					/* Checklist Print Styling */
					.checklist-container {
						display: none !important;
					}
					body.checklist-print-active .checklist-container {
						display: block !important;
					}
					body.checklist-print-active #modal-resumo-print {
						display: none !important;
					}
					body.checklist-print-active * {
						font-weight: revert !important;
					}
					body.checklist-print-active {
						padding: 0 !important;
					}
					body.checklist-print-active .checklist-page {
						page-break-after: always !important;
						break-after: page !important;
						padding: 10mm !important;
						box-sizing: border-box !important;
					}
					body.checklist-print-active .checklist-page:last-child {
						page-break-after: avoid !important;
						break-after: avoid !important;
					}
				}
			`,
				}}
			/>
			<div className="space-y-8 print:hidden">
			{/* Action Bar */}
			<div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors print:hidden">
				<div className="flex flex-col gap-1">
					<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
						Reposicionamento
					</h2>
					<p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
						Movimente itens entre as unidades
					</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						onClick={resetProjectedStocks}
						className="cursor-pointer flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-green-700 dark:text-green-500 px-5 py-2.5 rounded-xl font-black transition-all border border-slate-200 dark:border-slate-700 uppercase tracking-widest">
						<RefreshCw size={14} />
						Redefinir para Estoque Atual
					</button>
					<button
						onClick={() => setShowSummary(true)}
						className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black shadow-md shadow-blue-100 dark:shadow-none transition-all cursor-pointer uppercase tracking-widest">
						<Save size={14} />
						Gerar Resumo
					</button>
				</div>
			</div>

			{/* Filter Bar */}
			<div className="flex items-center justify-between gap-4 print:hidden">
				<div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 flex-1 transition-colors">
					<div className="relative flex-1 group">
						<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
						<input
							type="text"
							placeholder="Filtrar por sabor..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
						/>
					</div>
				</div>
				<button
					onClick={fetchAllHistory}
					disabled={loadingAllHistory}
					className="cursor-pointer flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 px-6 py-3.5 rounded-2xl font-black text-xs transition-all border border-slate-200 dark:border-slate-800 uppercase tracking-widest disabled:opacity-50 shadow-sm">
					{loadingAllHistory ? <RefreshCw className="animate-spin" size={14} /> : <History size={14} />}
					Histórico Completo
				</button>
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors print:hidden">
				<div className="overflow-x-auto overflow-y-visible">
					<table className="w-full border-separate border-spacing-0">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800">
								<th className="p-5 text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 border-b border-slate-200 dark:border-slate-700 text-center">
									Item
								</th>
								{STORE_ORDER.map((id) => (
									<th
										key={id}
										className="p-5 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] border-l border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
										{STORE_NAMES[id]}
									</th>
								))}
								<th className="p-5 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[20rem] border-l border-slate-100 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10 border-b border-slate-200 dark:border-slate-700">
									Movimentar
								</th>
							</tr>
						</thead>
						<tbody>
							{sortedItems.map(([key, label], index) => {
								const itemKey = key as keyof StockData;
								const transfers = itemTransfers[itemKey] || {
									from: "lago",
									to: "conjunto",
									qty: 0,
								};
								const isExpanded = expandedItem === itemKey;
								const showRepeatedHeader = index > 0 && index % 8 === 0;

								return (
									<Fragment key={itemKey}>
										{showRepeatedHeader && (
											<tr className="bg-slate-100 dark:bg-slate-800/80">
												<th className="p-3 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-100 dark:bg-slate-800/80 z-20 border-y border-slate-200 dark:border-slate-700">
													Item
												</th>
												{STORE_ORDER.map((id) => (
													<th
														key={`header-${id}-${index}`}
														className="p-3 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 border-y">
														{STORE_NAMES[id]}
													</th>
												))}
												<th className="p-3 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 bg-blue-100/30 dark:bg-blue-900/20 border-y">
													Movimentar
												</th>
											</tr>
										)}
										<tr
											className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/20" : ""}`}>
											<td className="p-5 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/50 z-10 border-r border-slate-50 dark:border-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors">
												<button
													onClick={() => setExpandedItem(isExpanded ? null : itemKey)}
													className="flex items-center gap-2 text-[0.9375rem] font-black text-slate-600 dark:text-slate-400 uppercase hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-left">
													{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
													{label}
												</button>
											</td>

											{STORE_ORDER.map((id) => {
												const v = projectedStocks[id][itemKey] || 0;
												const initial = allData.find((d) => d.id === id)?.stock[itemKey] || 0;
												const openVal = allData.find((d) => d.id === id)?.isUnits?.[itemKey];
												const initialOpenCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
												const receiving = v > initial;
												const sending = v < initial;

												return (
													<td
														key={id}
														className="p-5 text-center border-l border-slate-50 dark:border-slate-800 border-b border-slate-100 dark:border-slate-800">
														<div className="flex flex-col items-center">
															<div className="flex items-center gap-1">
																{(v > 0 || initialOpenCount === 0) && (
																	<span
																		className={`text-[1.7rem] font-black ${receiving ? "text-green-600 dark:text-green-400" : sending ? "text-red-600 dark:text-red-400" : initialOpenCount > 0 ? "text-orange-500 dark:text-orange-400" : initial === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-200"}`}>
																		{v}
																	</span>
																)}
																{initialOpenCount > 0 && (
																	<span className="text-[1.7rem] font-bold text-green-600 dark:text-slate-200 whitespace-nowrap">
																		{v > 0 ? `+ ${initialOpenCount} ab.` : `${initialOpenCount} ab.`}
																	</span>
																)}
															</div>
															{(receiving || sending) && (
																<span className="text-[1.3rem] font-bold text-slate-600 dark:text-slate-300 ">
																	(
																	<span className="text-[1.3rem] font-bold text-slate-700 dark:text-slate-200 ">
																		{initialOpenCount > 0 ? (initial > 0 ? `${initial} + ${initialOpenCount} ab.` : `${initialOpenCount} ab.`) : initial}
																	</span>
																	)
																</span>
															)}
														</div>
													</td>
												);
											})}

											<td className="p-5 text-center border-l border-slate-50 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/5 border-b border-slate-100 dark:border-slate-800">
												<div className="flex items-center justify-center gap-4">
													<div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
														<div className="relative group">
															<select
																value={transfers.from}
																onChange={(e) =>
																	setItemTransfers((prev) => ({
																		...prev,
																		[itemKey]: { ...transfers, from: e.target.value as StoreId },
																	}))
																}
																className="appearance-none bg-slate-50 dark:bg-slate-900/50 text-[1rem] font-black text-red-600 dark:text-red-400 focus:outline-none cursor-pointer pl-4 pr-10 py-2 rounded-xl border border-transparent focus:border-red-500/30 transition-all hover:bg-red-50 dark:hover:bg-red-900/20">
																{STORE_ORDER.map((id) => (
																	<option key={id} value={id} className="dark:bg-slate-800 cursor-pointer text-center">
																		{STORE_NAMES[id]}
																	</option>
																))}
															</select>
															<ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none transition-colors group-hover:text-red-600" />
														</div>

														<ArrowRight className="text-slate-300 dark:text-slate-600" size={16} />

														<div className="relative group">
															<select
																value={transfers.to}
																onChange={(e) =>
																	setItemTransfers((prev) => ({
																		...prev,
																		[itemKey]: { ...transfers, to: e.target.value as StoreId },
																	}))
																}
																className="appearance-none bg-slate-50 dark:bg-slate-900/50 text-[1rem] font-black text-emerald-600 dark:text-emerald-400 focus:outline-none cursor-pointer pl-4 pr-10 py-2 rounded-xl border border-transparent focus:border-emerald-500/30 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
																{STORE_ORDER.map((id) => (
																	<option key={id} value={id} className="dark:bg-slate-800 text-center">
																		{STORE_NAMES[id]}
																	</option>
																))}
															</select>
															<ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none transition-colors group-hover:text-emerald-600" />
														</div>
													</div>

													<input
														type="number"
														min="0"
														value={transfers.qty || ""}
														onChange={(e) =>
															setItemTransfers((prev) => ({
																...prev,
																[itemKey]: { ...transfers, qty: parseInt(e.target.value, 10) || 0 },
															}))
														}
														placeholder="0"
														className="w-20 px-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center font-black focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all text-lg dark:text-slate-200"
													/>

													<button
														onClick={() => applyMovement(itemKey)}
														disabled={transfers.qty <= 0 || transfers.from === transfers.to}
														className={`p-3 rounded-xl transition-all ${transfers.qty <= 0 || transfers.from === transfers.to ? "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 dark:shadow-none cursor-pointer scale-100 hover:scale-105 active:scale-95"}`}>
														<Send size={20} />
													</button>
												</div>
											</td>
										</tr>
										{isExpanded && (
											<tr className="bg-blue-50/20 dark:bg-blue-900/10 transition-colors">
												<td
													colSpan={STORE_ORDER.length + 2}
													className="p-4 border-b border-slate-200 dark:border-slate-800">
													<div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-blue-100 dark:border-blue-900 shadow-sm transition-colors">
														<h4 className="text-[1rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
															Histórico de Reposicionamento (últimas 5)
														</h4>
														{loadingLastRepo ? (
															<div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
																<RefreshCw className="animate-spin" size={16} />
																<span className="text-xs font-bold">Buscando histórico...</span>
															</div>
														) : historyForItem.length > 0 ? (
															<div className="space-y-4">
																{historyForItem.map((item, hIdx) => (
																	<div key={item.id || hIdx} className="flex flex-wrap items-center gap-8 pb-4 border-b border-slate-50 dark:border-slate-700 last:border-0 last:pb-0">
																		<div className="flex flex-col gap-1 min-w-[6.25rem]">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Data
																			</span>
																			<span className="text-lg font-black text-slate-700 dark:text-slate-300">
																				{formatDate(item.timestamp.toDate())}
																			</span>
																		</div>
																		<div className="flex flex-col gap-1 min-w-[9.375rem]">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Movimentação
																			</span>
																			<span className="text-lg font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
																				{STORE_NAMES[item.fromStore]}
																				<ArrowRight size={12} className="text-blue-400 dark:text-blue-500" />
																				{STORE_NAMES[item.toStore]}
																			</span>
																		</div>
																		<div className="flex flex-col gap-1">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Quantidade
																			</span>
																			<span className="text-lg font-black text-green-600 dark:text-green-400">
																				{item.difference} itens
																			</span>
																		</div>
																		<div className="flex flex-col gap-1">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Origem
																			</span>
																			<span className="text-lg font-black text-slate-500 dark:text-slate-400">
																				De {item.beforeFrom} → {item.afterFrom}
																			</span>
																		</div>
																		<div className="flex flex-col gap-1">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Destino
																			</span>
																			<span className="text-lg font-black text-slate-500 dark:text-slate-400">
																				De {item.beforeTo} → {item.afterTo}
																			</span>
																		</div>
																	</div>
																))}
															</div>
														) : (
															<p className="text-lg font-bold text-slate-400 dark:text-slate-500">
																Nenhum reposicionamento registrado para este item.
															</p>
														)}
													</div>
												</td>
											</tr>
										)}
									</Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			</div>

			{showSummary && (
				<div id="modal-resumo-print" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
						<div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center print:border-b-2 print:border-black">
							<div>
								<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight print:text-black">
									Reposicionamento - {new Date().toLocaleDateString("pt-BR")}
								</h2>
							</div>
						</div>

						<div className="p-8 overflow-y-auto flex-1 print:overflow-visible">
							{calculateOptimizedSummary().length > 0 ? (
								<div className="space-y-6">
									{(() => {
										const grouped = new Map<
											string,
											{ from: StoreId; to: StoreId; items: { label: string; qty: number }[] }
										>();

										calculateOptimizedSummary().forEach((move) => {
											const key = `${move.from}-${move.to}`;
											if (!grouped.has(key)) {
												grouped.set(key, { from: move.from, to: move.to, items: [] });
											}
											grouped.get(key)!.items.push({
												label: STOCK_LABELS[move.item],
												qty: move.qty,
											});
										});

										return Array.from(grouped.values()).map((group, idx) => (
											<div
												key={idx}
												className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 print:bg-white print:border-black print:p-4 print:rounded-none">
												<div className="flex items-center gap-2 mb-3">
													<span className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight print:text-black flex items-center gap-2">
														{STORE_NAMES[group.from]}
														<ArrowRight size={16} className="text-blue-400 dark:text-blue-500 print:text-black" />
														{STORE_NAMES[group.to]}:
													</span>
												</div>
												<p className="text-slate-600 dark:text-slate-300 font-bold text-sm leading-relaxed print:text-black">
													{group.items.map((item, i) => (
														<span key={i}>
															{item.qty} {item.label}
															{i < group.items.length - 1 ? ", " : ""}
														</span>
													))}
												</p>
											</div>
										));
									})()}
								</div>
							) : (
								<div className="text-center py-10">
									<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
										Nenhuma movimentação pendente.
									</p>
								</div>
							)}
						</div>

						<div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4 transition-colors print:hidden">
							<div className="flex flex-wrap gap-4 w-full">
								<button
									onClick={async () => {
										const success = await saveReposition();
										if (success) handleWhatsApp();
									}}
									disabled={calculateOptimizedSummary().length === 0 || savingRepos}
									className="flex-1 min-w-[11.25rem] flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
									
									Enviar no WhatsApp
								</button>
								<button
									onClick={async () => {
										const success = await saveReposition();
										if (success) handlePrint();
									}}
									disabled={calculateOptimizedSummary().length === 0 || savingRepos}
									className="flex-1 min-w-[11.25rem] flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
									
									IMPRIMIR RESUMO
								</button>
								<button
									onClick={async () => {
										const success = await saveReposition();
										if (success) handlePrintChecklist();
									}}
									disabled={calculateOptimizedSummary().length === 0 || savingRepos}
									className="flex-1 min-w-[11.25rem] flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
									
									Imprimir Checagem Vendedores
								</button>
							</div>
							<button
								onClick={() => setShowSummary(false)}
								className="w-full px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}
			{negativeStockWarning && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-red-200 dark:border-red-900/30">
						<div className="p-8 text-center space-y-4">
							<div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
								<Save className="text-red-600 dark:text-red-400" size={32} />
							</div>
							<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Atenção: Estoque Negativo</h3>
							<p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed">
								Esta movimentação resultará em <span className="text-red-600 dark:text-red-400 font-black">{negativeStockWarning.qty}</span> unidades de <span className="font-black">{STOCK_LABELS[negativeStockWarning.item]}</span> na unidade <span className="font-black">{STORE_NAMES[negativeStockWarning.store]}</span>.
							</p>
							<p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Deseja prosseguir mesmo assim?</p>
						</div>
						<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
							<button onClick={() => setNegativeStockWarning(null)} className="flex-1 px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">Desfazer</button>
							<button onClick={negativeStockWarning.onConfirm} className="flex-1 px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 dark:shadow-none transition-all">Confirmar</button>
						</div>
					</div>
				</div>
			)}
			{showResetConfirm && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-blue-200 dark:border-blue-900/30">
						<div className="p-8 text-center space-y-4">
							<div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
								<RefreshCw className="text-blue-600 dark:text-blue-400" size={32} />
							</div>
							<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Redefinir Estoque</h3>
							<p className="text-slate-500 dark:text-slate-400 font-bold text-md leading-relaxed">
								Deseja redefinir todas as quantidades baseadas no estoque atual? Todas as movimentações pendentes serão zeradas e as quantidades refletirão o estoque atual informado pelas lojas.
							</p>
						</div>
						<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
							<button onClick={() => setShowResetConfirm(false)} className="flex-1 px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">Cancelar</button>
							<button onClick={confirmResetProjectedStocks} className="flex-1 px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 dark:shadow-none transition-all">Confirmar</button>
						</div>
					</div>
				</div>
			)}
			{showAllHistory && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
						<div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<History className="text-blue-600 dark:text-blue-400" size={24} />
								<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight uppercase">
									Histórico Completo de Reposicionamento
								</h2>
							</div>
							<button onClick={() => setShowAllHistory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
								<ChevronUp size={24} className="rotate-180" />
							</button>
						</div>

						<div className="p-8 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
							{allHistory.length > 0 ? (
								<div className="space-y-4">
									{allHistory.map((item, hIdx) => (
										<div key={item.id || hIdx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-6 transition-all hover:shadow-md">
											<div className="flex flex-col gap-1 min-w-[7.5rem]">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Data</span>
												<span className="text-sm font-black text-slate-700 dark:text-slate-300">{formatDate(item.timestamp.toDate())}</span>
											</div>
											<div className="flex flex-col gap-1 min-w-[11.25rem]">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item</span>
												<span className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase">{STOCK_LABELS[item.itemId]}</span>
											</div>
											<div className="flex flex-col gap-1 min-w-[11.25rem]">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Movimentação</span>
												<div className="flex items-center gap-2">
													<span className="text-sm font-black text-slate-700 dark:text-slate-200">{STORE_NAMES[item.fromStore]}</span>
													<ArrowRight size={14} className="text-slate-400" />
													<span className="text-sm font-black text-slate-700 dark:text-slate-200">{STORE_NAMES[item.toStore]}</span>
												</div>
											</div>
											<div className="flex flex-col gap-1 items-center">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Qtd</span>
												<span className="text-lg font-black text-green-600 dark:text-green-400">{item.difference}</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="flex flex-col items-center justify-center p-12 text-slate-400">
									<History size={48} className="mb-4 opacity-20" />
									<p className="font-black uppercase tracking-widest">Nenhum histórico encontrado</p>
								</div>
							)}
						</div>

						<div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center">
							<button
								onClick={() => setShowAllHistory(false)}
								className="px-12 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer">
								Fechar Histórico
							</button>
						</div>
					</div>
				</div>
			)}

			{isPrintingChecklist && (
				<div className="checklist-container hidden print:block bg-white text-black min-h-screen p-4 font-sans">
					{STORE_ORDER.map((storeId) => {
						const storeName = STORE_NAMES[storeId];
						const movements = calculateOptimizedSummary();
						
						// Entradas: toStore === storeId, sorted alphabetically
						const incoming = movements
							.filter(m => m.to === storeId)
							.sort((a, b) => STOCK_LABELS[a.item].localeCompare(STOCK_LABELS[b.item]));
						// Saídas: fromStore === storeId, sorted alphabetically
						const outgoing = movements
							.filter(m => m.from === storeId)
							.sort((a, b) => STOCK_LABELS[a.item].localeCompare(STOCK_LABELS[b.item]));

						if (incoming.length === 0 && outgoing.length === 0) {
							return null; // Skip stores with no repositioning
						}

						return (
							<div key={storeId} className="checklist-page mb-10 pb-10 border-b border-dashed border-slate-300 print:mb-0 print:pb-0 print:border-0 print:min-h-screen">
								<div>
									{/* Header */}
									<div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
										<div>
											<h1 className="text-2xl font-bold uppercase tracking-tight">Folha de Conferência de Reposição</h1>
											<h2 className="text-3xl font-black uppercase text-blue-800 print:text-black mt-1">{storeName}</h2>
										</div>
										<div className="text-right">
											<p className="text-sm font-semibold">Data: {new Date().toLocaleDateString("pt-BR")}</p>
											<p className="text-xs text-slate-500">Sistema Biscoito Americano</p>
										</div>
									</div>

									{/* Outgoing Section (Saídas) */}
									{outgoing.length > 0 && (
										<div className="mb-8">
											<h3 className="text-lg font-bold uppercase bg-white px-3 py-1.5 rounded-lg mb-4 text-slate-800 print:text-black border-l-4 border-slate-600 print:border-black">
												Saídas (Enviando para outras lojas)
											</h3>
											<table className="w-full border-collapse">
												<thead>
													<tr className="border-b-2 border-slate-300 text-left text-xs font-bold uppercase text-slate-500">
														<th className="py-2 w-12 text-center">Conf.</th>
														<th className="py-2">Sabor / Item</th>
														<th className="py-2 w-24 text-center">Qtd (Pacotes)</th>
														<th className="py-2 text-center pl-12">Divergências e Observações</th>
													</tr>
												</thead>
												<tbody>
													{outgoing.map((m, idx) => (
														<tr key={idx} className="border-b border-slate-200">
															<td className="py-3 text-center">
																<div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto"></div>
															</td>
															<td className="py-3 font-bold uppercase text-sm">
																{STOCK_LABELS[m.item]}
															</td>
															<td className="py-3 text-center font-extrabold text-lg text-slate-900 print:text-black">
																{m.qty}
															</td>
															<td className="py-3 pl-12">
																<div className="w-[85%] mx-auto border-b border-slate-300 h-6"></div>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}

									{/* Incoming Section (Entradas) */}
									{incoming.length > 0 && (
										<div className="mb-8">
											<h3 className="text-lg font-bold uppercase bg-white px-3 py-1.5 rounded-lg mb-4 text-slate-800 print:text-black border-l-4 border-slate-600 print:border-black">
												Entradas (Recebendo no estoque)
											</h3>
											<table className="w-full border-collapse">
												<thead>
													<tr className="border-b-2 border-slate-300 text-left text-xs font-bold uppercase text-slate-500">
														<th className="py-2 w-12 text-center">Conf.</th>
														<th className="py-2">Sabor / Item</th>
														<th className="py-2 w-24 text-center">Qtd (Pacotes)</th>
														<th className="py-2 text-center pl-12">Divergências e Observações</th>
													</tr>
												</thead>
												<tbody>
													{incoming.map((m, idx) => (
														<tr key={idx} className="border-b border-slate-200">
															<td className="py-3 text-center">
																<div className="w-5 h-5 border-2 border-slate-400 rounded mx-auto"></div>
															</td>
															<td className="py-3 font-bold uppercase text-sm">
																{STOCK_LABELS[m.item]}
															</td>
															<td className="py-3 text-center font-extrabold text-lg text-slate-900 print:text-black">
																{m.qty}
															</td>
															<td className="py-3 pl-12">
																<div className="w-[85%] mx-auto border-b border-slate-300 h-6"></div>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</>
	);
}
