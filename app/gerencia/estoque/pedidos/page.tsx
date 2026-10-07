"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, limit, doc, setDoc } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, sortStockEntries, isSorvete, normalizeStockData } from "@/types";
import { RefreshCw, ArrowLeftRight, Printer, Search, Eye, EyeOff, ChevronDown, Save, FileText, Settings, Package, DollarSign, Calculator, ShoppingCart, Copy, Check, Plus, Minus, Sparkles, RotateCcw, Edit3 } from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, number>>;
}

interface RepositionSnapshotDoc {
	id?: string;
	sessionId?: string;
	type: "inicio" | "fim";
	timestamp: any; // Firestore Timestamp
	stores: Record<
		StoreId,
		{
			stock: Partial<StockData>;
			isUnits: Partial<Record<keyof StockData, number>>;
		}
	>;
}

const STORE_ORDER: StoreId[] = ["lago", "terraco", "conjunto", "noroeste"];

const DEFAULT_PACKAGE_PRICES: Partial<Record<keyof StockData, number>> = {
	alpino: 184.8,
	americanCookie: 160.08,
	brigadeiro: 130.8,
	brownie: 124.8,
	classicoAoLeite: 124.8,
	cocoDourado: 180.0,
	eclipse: 158.4,
	kinderBueno: 253.2,
	lotus: 223.2,
	macadamia: 124.8,
	mms: 118.8,
	newYork: 124.8,
	nutella: 158.4,
	oreo: 165.6,
	ovomaltine: 158.4,
	pistache: 165.6,
	redVelvet: 124.8,
	redNinho: 148.8,
	redNutella: 158.4,
	triploChocolate: 124.8,
};

export default function EstoquePedidosPage() {
	const [activeSubTab, setActiveSubTab] = useState<"comparativo" | "configuracoes">("comparativo");
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [realCurrentData, setRealCurrentData] = useState<FullStoreData[]>([]);
	const [sessions, setSessions] = useState<RepositionSnapshotDoc[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string>("atual");
	const [searchTerm, setSearchTerm] = useState("");
	const [hideOpen, setHideOpen] = useState(true);

	// Desired Stock States
	const [desiredData, setDesiredData] = useState<Partial<StockData>>({});
	const [localDesired, setLocalDesired] = useState<Partial<StockData>>({});
	const [storeDesired, setStoreDesired] = useState<Record<StoreId, Partial<StockData>>>({
		lago: {},
		terraco: {},
		conjunto: {},
		noroeste: {},
	});
	const [localStoreDesired, setLocalStoreDesired] = useState<Record<StoreId, Partial<StockData>>>({
		lago: {},
		terraco: {},
		conjunto: {},
		noroeste: {},
	});
	
	// Box Sizes (Pacotes por caixa)
	const [boxSizes, setBoxSizes] = useState<Partial<StockData>>({});
	const [localBoxSizes, setLocalBoxSizes] = useState<Partial<StockData>>({});

	// Package Prices (Valores por pacote por sabor)
	const [packagePrices, setPackagePrices] = useState<Partial<Record<keyof StockData, number>>>(DEFAULT_PACKAGE_PRICES);
	const [localPackagePrices, setLocalPackagePrices] = useState<Partial<Record<keyof StockData, number>>>(DEFAULT_PACKAGE_PRICES);

	// Custom Order Packages (para simulação e edição na sub-aba VALOR DO PEDIDO)
	const [customOrderPackages, setCustomOrderPackages] = useState<Partial<Record<keyof StockData, number>>>({});
	// Pacotes a pedir por loja (preenchidos pelo usuário no Comparativo de Estoque)
	const [storeOrderPackages, setStoreOrderPackages] = useState<Record<StoreId, Partial<Record<keyof StockData, number>>>>({
		lago: {},
		terraco: {},
		conjunto: {},
		noroeste: {},
	});
	const [copiedSummary, setCopiedSummary] = useState(false);
	const [showSummary, setShowSummary] = useState(false);
	const [showPartialPreview, setShowPartialPreview] = useState(false);
	const [partialOnlyWithOrder, setPartialOnlyWithOrder] = useState(true);
	const [copiedPartialSummary, setCopiedPartialSummary] = useState(false);

	const [savingDesired, setSavingDesired] = useState(false);

	// Order Calculations across all non-ice-cream cookie flavors
	const cookieOrderEntries = sortStockEntries(Object.entries(STOCK_LABELS)).filter(([key]) => !isSorvete(key));
	let orderTotalPackages = 0;
	let orderBaseTotalValue = 0;

	cookieOrderEntries.forEach(([key]) => {
		const itemKey = key as keyof StockData;
		const qty = customOrderPackages[itemKey] || 0;
		const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
		orderTotalPackages += qty;
		orderBaseTotalValue += qty * pricePerPkg;
	});

	const orderTaxValue = orderBaseTotalValue * 0.08;
	const orderFinalTotalValue = orderBaseTotalValue * 1.08;


	// 1. Fetch current real stock data
	useEffect(() => {
		const storeIds = STORE_ORDER;

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
					stock: normalizeStockData(storeDoc.stock),
					isUnits: normalizeStockData(storeDoc.isUnits),
				};
			});

			setRealCurrentData(newFullData);
			setLoading(false);
		});

		return () => unsubscribeStores();
	}, []);

	// 2. Fetch finalized reposition snapshots (real-time listener)
	useEffect(() => {
		const snapshotsRef = collection(db, "repositionSnapshots");
		const q = query(snapshotsRef, limit(200));
		const unsubscribe = onSnapshot(
			q,
			(querySnapshot) => {
				const docs = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				})) as RepositionSnapshotDoc[];

				const finishedSessions = docs
					.filter((d) => d.type === "fim" && d.timestamp)
					.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
				setSessions(finishedSessions);
			},
			(error) => {
				console.error("Erro ao escutar históricos de reposicionamento:", error);
			}
		);

		return () => unsubscribe();
	}, []);

	// 3. Fetch desired stocks, box sizes & package prices (Global doc logic with store fallback sum if needed)
	useEffect(() => {
		const unsubscribeDesired = onSnapshot(collection(db, "desiredStocks"), (snapshot) => {
			let aggregatedStock: Partial<StockData> = {};
			let aggregatedBoxSizes: Partial<StockData> = {};
			let fetchedPackagePrices: Partial<Record<keyof StockData, number>> = {};
			const storeProps: Record<StoreId, Partial<StockData>> = {
				lago: {},
				terraco: {},
				conjunto: {},
				noroeste: {},
			};

			const globalDoc = snapshot.docs.find((d) => d.id === "global");

			if (globalDoc) {
				const data = globalDoc.data();
				aggregatedStock = data.stock || {};
				aggregatedBoxSizes = data.boxSizes || {};
				fetchedPackagePrices = data.packagePrices || {};
				if (data.storeProportions) {
					STORE_ORDER.forEach((sId) => {
						storeProps[sId] = data.storeProportions[sId] || {};
					});
				}
			}

			// Individual store doc fallback/override
			snapshot.docs.forEach((d) => {
				if (STORE_ORDER.includes(d.id as StoreId)) {
					const sId = d.id as StoreId;
					const storeStock = (d.data().stock || {}) as Partial<StockData>;
					if (Object.keys(storeStock).length > 0) {
						storeProps[sId] = { ...storeProps[sId], ...storeStock };
					}
				}
			});

			// If store proportions exist, compute aggregatedStock as the sum of all stores
			const hasStoreValues = STORE_ORDER.some((sId) => Object.keys(storeProps[sId]).length > 0);
			if (hasStoreValues) {
				const sumStock: Partial<StockData> = {};
				Object.keys(STOCK_LABELS).forEach((k) => {
					const key = k as keyof StockData;
					const sum = STORE_ORDER.reduce((acc, sId) => acc + (storeProps[sId]?.[key] || 0), 0);
					sumStock[key] = sum;
				});
				aggregatedStock = sumStock;
			} else if (!globalDoc) {
				snapshot.docs.forEach((d) => {
					const storeStock = (d.data().stock || {}) as Partial<StockData>;
					Object.entries(storeStock).forEach(([k, val]) => {
						const key = k as keyof StockData;
						aggregatedStock[key] = (aggregatedStock[key] || 0) + (val || 0);
					});
				});
			}

			setDesiredData(aggregatedStock);
			setLocalDesired({ ...aggregatedStock });
			setStoreDesired(storeProps);
			setLocalStoreDesired(JSON.parse(JSON.stringify(storeProps)));
			setBoxSizes(aggregatedBoxSizes);
			setLocalBoxSizes({ ...aggregatedBoxSizes });

			const mergedPrices = { ...DEFAULT_PACKAGE_PRICES, ...fetchedPackagePrices };
			setPackagePrices(mergedPrices);
			setLocalPackagePrices({ ...mergedPrices });
		});

		return () => unsubscribeDesired();
	}, []);

	// 4. Update table data based on selection
	useEffect(() => {
		if (selectedSessionId === "atual") {
			setAllData((currentData) => {
				if (currentData.length > 0) {
					const currentIdOrder = currentData.map((d) => d.id);
					return currentIdOrder.map((id) => realCurrentData.find((d) => d.id === id)!);
				}
				return realCurrentData;
			});
		} else if (selectedSessionId === "pos_reposicionamento") {
			// Procura o último reposicionamento finalizado salvo no banco
			const latestSession = sessions.length > 0 ? sessions[0] : null;
			// Procura projeção em andamento/salva localmente no navegador
			let localProjected: Record<StoreId, Partial<StockData>> | null = null;
			try {
				const saved = localStorage.getItem("repos_projected_stocks");
				if (saved) {
					localProjected = JSON.parse(saved);
				}
			} catch (e) {
				console.error("Erro ao ler repos_projected_stocks do localStorage:", e);
			}

			const storeIds = STORE_ORDER;
			const newFullData = storeIds.map((id) => {
				const realStore = realCurrentData.find((d) => d.id === id);
				let stockAfterRepo: Partial<StockData> = {};

				if (localProjected && localProjected[id] && Object.keys(localProjected[id]).length > 0) {
					stockAfterRepo = localProjected[id];
				} else if (latestSession && latestSession.stores[id]?.stock) {
					stockAfterRepo = latestSession.stores[id].stock;
				} else if (realStore) {
					stockAfterRepo = realStore.stock;
				}

				return {
					id,
					name: STORE_NAMES[id],
					lastStockUpdate: latestSession ? latestSession.timestamp.toDate() : (realStore?.lastStockUpdate || null),
					stock: stockAfterRepo,
					isUnits: realStore?.isUnits || (latestSession?.stores[id]?.isUnits || {}),
				};
			});

			setAllData((currentData) => {
				if (currentData.length > 0) {
					const currentIdOrder = currentData.map((d) => d.id);
					return currentIdOrder.map((id) => newFullData.find((d) => d.id === id)!);
				}
				return newFullData;
			});
		} else {
			const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId || s.id === selectedSessionId);
			if (selectedSession) {
				const storeIds = STORE_ORDER;
				const snapshotTime = selectedSession.timestamp.toDate();
				const newFullData = storeIds.map((id) => {
					const storeSnap = selectedSession.stores[id] || { stock: {}, isUnits: {} };
					return {
						id,
						name: STORE_NAMES[id],
						lastStockUpdate: snapshotTime,
						stock: storeSnap.stock || {},
						isUnits: storeSnap.isUnits || {},
					};
				});

				setAllData((currentData) => {
					if (currentData.length > 0) {
						const currentIdOrder = currentData.map((d) => d.id);
						return currentIdOrder.map((id) => newFullData.find((d) => d.id === id)!);
					}
					return newFullData;
				});
			}
		}
	}, [selectedSessionId, realCurrentData, sessions]);

	// Save Configurations (Desired Stock, Box Sizes & Package Prices) globally
	const saveDesiredStocks = async () => {
		setSavingDesired(true);
		try {
			// Calcula o total consolidado de todas as lojas para cada sabor
			const calculatedTotalStock: Partial<StockData> = {};
			Object.keys(STOCK_LABELS).forEach((k) => {
				const key = k as keyof StockData;
				const sum = STORE_ORDER.reduce((acc, sId) => acc + (localStoreDesired[sId]?.[key] || 0), 0);
				calculatedTotalStock[key] = sum;
			});

			const docRef = doc(db, "desiredStocks", "global");
			await setDoc(
				docRef,
				{
					stock: calculatedTotalStock,
					storeProportions: localStoreDesired,
					boxSizes: localBoxSizes,
					packagePrices: localPackagePrices,
				},
				{ merge: true }
			);

			for (const sId of STORE_ORDER) {
				const storeDocRef = doc(db, "desiredStocks", sId);
				await setDoc(storeDocRef, { stock: localStoreDesired[sId] || {} }, { merge: true });
			}

			setDesiredData(calculatedTotalStock);
			setStoreDesired(JSON.parse(JSON.stringify(localStoreDesired)));
			setBoxSizes({ ...localBoxSizes });
			setPackagePrices({ ...localPackagePrices });

			setActiveSubTab("comparativo");
		} catch (error) {
			console.error("Erro ao salvar configurações:", error);
			alert("Erro ao salvar. Verifique o console.");
		} finally {
			setSavingDesired(false);
		}
	};

	const handleLocalStoreDesiredChange = (storeId: StoreId, itemKey: keyof StockData, value: string) => {
		const numValue = value === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
		setLocalStoreDesired((prev) => {
			const updatedStore = {
				...prev[storeId],
				[itemKey]: numValue,
			};
			const nextState = {
				...prev,
				[storeId]: updatedStore,
			};
			const newTotal = STORE_ORDER.reduce((sum, sId) => sum + (nextState[sId]?.[itemKey] || 0), 0);
			setLocalDesired((dPrev) => ({
				...dPrev,
				[itemKey]: newTotal,
			}));
			return nextState;
		});
	};

	const handleLocalBoxSizeChange = (itemKey: keyof StockData, value: string) => {
		const numValue = value === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
		setLocalBoxSizes((prev) => ({
			...prev,
			[itemKey]: numValue,
		}));
	};

	const handleLocalPackagePriceChange = (itemKey: keyof StockData, value: string) => {
		const normalized = value.replace(",", ".");
		const numValue = normalized === "" ? 0 : Math.max(0, parseFloat(normalized) || 0);
		setLocalPackagePrices((prev) => ({
			...prev,
			[itemKey]: numValue,
		}));
	};

	// Helper para obter os pacotes sugeridos com arredondamento para baixo por múltiplos de caixa
	const getSuggestedOrderPackages = (itemKey: keyof StockData): number => {
		const totalQty = allData.reduce((sum, store) => sum + (store.stock[itemKey] || 0), 0);
		const desiredQty = desiredData[itemKey] || 0;
		const boxSize = boxSizes[itemKey] || 0;
		const deficit = Math.max(0, desiredQty - totalQty);

		if (deficit <= 0) return 0;

		if (boxSize > 0) {
			const boxesCount = Math.floor(deficit / boxSize);
			return boxesCount * boxSize;
		}

		return deficit;
	};

	const fillStoreOrderWithSuggested = () => {
		const newCustomOrder: Partial<Record<keyof StockData, number>> = {};

		Object.keys(STOCK_LABELS).forEach((k) => {
			const itemKey = k as keyof StockData;
			newCustomOrder[itemKey] = getSuggestedOrderPackages(itemKey);
		});

		setCustomOrderPackages(newCustomOrder);
	};

	const clearStoreOrder = () => {
		setStoreOrderPackages({
			lago: {},
			terraco: {},
			conjunto: {},
			noroeste: {},
		});
		setCustomOrderPackages({});
	};

	const handleCustomPackageChange = (itemKey: keyof StockData, value: string) => {
		if (value === "") {
			setCustomOrderPackages((prev) => ({
				...prev,
				[itemKey]: 0,
			}));
			return;
		}

		const parsed = Math.max(0, parseInt(value, 10) || 0);
		const boxSize = boxSizes[itemKey] || 1;
		
		// Arredonda para o múltiplo do tamanho da caixa mais próximo
		const rounded = Math.round(parsed / boxSize) * boxSize;

		setCustomOrderPackages((prev) => ({
			...prev,
			[itemKey]: rounded,
		}));
	};

	const stepCustomPackage = (itemKey: keyof StockData, deltaBoxes: number) => {
		const boxSize = boxSizes[itemKey] || 1;
		const current = customOrderPackages[itemKey] !== undefined ? (customOrderPackages[itemKey] || 0) : 0;
		const next = Math.max(0, current + deltaBoxes * boxSize);

		setCustomOrderPackages((prev) => ({
			...prev,
			[itemKey]: next,
		}));
	};

	const resetCustomOrderToSuggested = () => {
		const resetObj: Partial<Record<keyof StockData, number>> = {};
		Object.keys(STOCK_LABELS).forEach((k) => {
			const itemKey = k as keyof StockData;
			resetObj[itemKey] = getSuggestedOrderPackages(itemKey);
		});
		setCustomOrderPackages(resetObj);
	};

	const handleReviewOrder = () => {
		const el = document.getElementById("secao-resumo-pedido");
		if (el) {
			el.scrollIntoView({ behavior: "smooth" });
		} else {
			setShowSummary(true);
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
						size: A4 portrait;
						margin: 20mm;
					}
					* {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						box-shadow: none !important;
						text-shadow: none !important;
					}
					body {
						background: white !important;
						color: #111827 !important;
						font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
						padding: 0 !important;
						margin: 0 !important;
					}

					/* Ocultar cabeçalhos, navegação e botões */
					nav, header, footer, .print\\:hidden, button {
						display: none !important;
					}

					/* Quando o modal de resumo ou o modal de pedido parcial estiver aberto, ocultar todo o resto e exibir apenas o container de impressão */
					body:has(#modal-resumo-print),
					body:has(#modal-pedido-parcial-print) {
						visibility: hidden !important;
					}

					body:has(#modal-resumo-print) #modal-resumo-print,
					body:has(#modal-resumo-print) #modal-resumo-print *,
					body:has(#modal-pedido-parcial-print) #modal-pedido-parcial-print,
					body:has(#modal-pedido-parcial-print) #modal-pedido-parcial-print * {
						visibility: visible !important;
					}

					#modal-resumo-print,
					#modal-pedido-parcial-print {
						position: absolute !important;
						left: 0 !important;
						top: 0 !important;
						width: 100% !important;
						height: auto !important;
						min-height: auto !important;
						margin: 0 !important;
						padding: 4mm 6mm !important;
						background: transparent !important;
						backdrop-filter: none !important;
						display: block !important;
						z-index: 9999 !important;
						box-sizing: border-box !important;
					}

					#modal-resumo-print > div,
					#modal-pedido-parcial-print > div {
						width: 100% !important;
						max-width: 100% !important;
						border: none !important;
						box-shadow: none !important;
						background: transparent !important;
						padding: 0 !important;
						margin: 0 !important;
						max-height: none !important;
						overflow: visible !important;
					}

					.print-summary-card {
						border: 1px solid #1e293b !important;
						border-radius: 8px !important;
						padding: 16px 20px !important;
						margin: 0 auto !important;
						max-width: 550px !important;
						background: #ffffff !important;
					}

					.bg-white, .dark\\:bg-slate-900, .bg-slate-50, .dark\\:bg-slate-800 {
						background: transparent !important;
						border: none !important;
						box-shadow: none !important;
						border-radius: 0 !important;
					}
					table {
						width: 100% !important;
						border-collapse: collapse !important;
						margin-top: 10px !important;
					}
					th, td {
						border: 1px solid #333 !important;
						padding: 6px 10px !important;
						font-size: 10pt !important;
						color: black !important;
						background: transparent !important;
						text-align: center !important;
						border-radius: 0 !important;
						box-shadow: none !important;
					}
					th:first-child, td:first-child {
						text-align: left !important;
					}
					th {
						background-color: #f2f2f2 !important;
						font-weight: bold !important;
						text-transform: uppercase !important;
					}
					h1 {
						font-size: 14pt !important;
						font-weight: bold !important;
						margin-bottom: 12px !important;
						text-align: center !important;
						text-transform: uppercase !important;
					}
					tr {
						page-break-inside: avoid !important;
					}
				}
			`,
				}}
			/>

			{/* Sub-tabs Selector */}
			<div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-6 print:hidden max-w-full overflow-x-auto no-scrollbar">
				<button
					onClick={() => setActiveSubTab("comparativo")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "comparativo"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<FileText size={16} />
					PEDIDO
				</button>
				<button
					onClick={() => setActiveSubTab("configuracoes")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "configuracoes"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<Settings size={16} />
					CONFIGURAÇÕES
				</button>
			</div>

			{activeSubTab === "comparativo" ? (
				<>
					<div className="hidden print:block">
						<h1 className="text-2xl font-black uppercase">
							Relatório de Estoque (Pedidos) - {selectedSessionId === "atual" ? "Estoque Atual Real" : selectedSessionId === "pos_reposicionamento" ? "Estoque Pós Reposicionamento" : "Histórico Projetado"} - {new Date().toLocaleDateString("pt-BR")}
						</h1>
					</div>

					{/* Actions Bar: Filter, Select & Print */}
					{/* Actions Bar: Filter, Select, Actions & Print */}
					<div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center justify-between gap-3 md:gap-4 print:hidden mb-6">
						<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 md:gap-4 flex-1 min-w-0">
							{/* Dropdown Select */}
							<div className="flex flex-col gap-1 w-full sm:w-auto min-w-0 sm:min-w-[260px]">
								<span className="text-[0.75rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Comparativo de Estoque</span>
								<div className="relative group">
									<select
										value={selectedSessionId}
										onChange={(e) => setSelectedSessionId(e.target.value)}
										className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 md:py-3 pl-4 pr-10 text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm">
										<option value="atual">Estoque Real</option>
										<option value="pos_reposicionamento">Estoque Pós Reposicionamento</option>
									</select>
									<ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
								</div>
							</div>

							{/* Filter Sabor */}
							<div className="flex flex-col gap-1 flex-1 min-w-0">
								<span className="text-[0.75rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Filtrar Sabor</span>
								<div className="relative group">
									<Search
										size={18}
										className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
									/>
									<input
										type="text"
										placeholder="Filtrar por sabor..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 md:py-3 pl-12 pr-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
									/>
								</div>
							</div>
						</div>

						<div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-end">
							<button
								onClick={fillStoreOrderWithSuggested}
								className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 md:gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-xs md:text-sm"
								title="Preencher automaticamente as quantidades faltantes por loja">
								<Sparkles size={16} className="text-amber-500" />
								SUGERIR FALTANTES
							</button>

							{Object.values(customOrderPackages).some((v) => (v || 0) > 0) && (
								<button
									onClick={clearStoreOrder}
									className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-xs md:text-sm"
									title="Zerar pacotes a pedir">
									<RotateCcw size={16} />
									LIMPAR
								</button>
							)}

							<button
								onClick={() => setHideOpen(!hideOpen)}
								className="flex-1 sm:flex-none justify-center flex items-center gap-2 md:gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-xs md:text-sm">
								{hideOpen ? <Eye size={16} /> : <EyeOff size={16} />}
								{hideOpen ? "MOSTRAR ABERTOS" : "OCULTAR ABERTOS"}
							</button>
						</div>
					</div>

					<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
						<div className="overflow-x-auto">
							<table className="w-full border-collapse">
								<thead>
									<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
										<th className="p-3 md:p-5 text-left text-sm md:text-lg font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11rem] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">
											<div className="flex items-center gap-1.5 flex-wrap">
												<span>SABOR</span>
												<span className="text-[0.65rem] md:text-xs font-semibold normal-case tracking-normal opacity-75">
													(pacotes/caixa)
												</span>
											</div>
										</th>
										{STORE_ORDER.map((storeId) => (
											<th
												key={storeId}
												className="p-2 md:p-3 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider min-w-[6.5rem] md:min-w-[10rem] border-l border-slate-200/60 dark:border-slate-700/60">
												<div>{STORE_NAMES[storeId]}</div>
												<div className="text-xs md:text-sm font-bold text-slate-400 dark:text-slate-500 normal-case tracking-normal mt-0.5">
													Estoque
												</div>
												<div className="text-[0.65rem] md:text-xs font-semibold text-slate-400 dark:text-slate-500 normal-case tracking-normal">
													(Faltantes)
												</div>
											</th>
										))}
										<th className="p-3 md:p-5 text-center text-sm md:text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider min-w-[6.5rem] md:min-w-[9rem] border-l-2 border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/80">
											TOTAL
										</th>
										<th className="p-3 md:p-5 text-center text-sm md:text-lg font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[6rem] md:min-w-[8.5rem] border-l border-slate-200/60 dark:border-slate-700/60">
											<div>DESEJÁVEL</div>
											<div className="text-[0.65rem] md:text-xs font-semibold text-slate-400 dark:text-slate-500 normal-case tracking-normal mt-0.5">
												(Faltantes)
											</div>
										</th>
										<th className="p-3 md:p-5 text-center text-sm md:text-lg font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[7.5rem] md:min-w-[12rem] border-l border-slate-200/60 dark:border-slate-700/60">
											PACOTES A PEDIR
										</th>
									</tr>
								</thead>
								<tbody>
									{sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([key, label]) => !isSorvete(key) && label.toLowerCase().includes(searchTerm.toLowerCase()))
										.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const totalQty = allData.reduce((sum, store) => sum + (store.stock[itemKey] || 0), 0);
											const totalOpen = allData.reduce((sum, store) => {
												const openVal = store.isUnits?.[itemKey];
												const count = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
												return sum + count;
											}, 0);
											const desiredQty = desiredData[itemKey] || 0;
											const hasDesired = desiredQty > 0;
											const boxSize = boxSizes[itemKey] || 0;

											const sumStorePackages = STORE_ORDER.reduce(
												(sum, sId) => sum + (Number(storeOrderPackages[sId]?.[itemKey]) || 0),
												0
											);

											return (
												<tr
													key={key}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-5 text-base md:text-xl font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase sticky left-0 z-10">
														<div className="flex items-center gap-1.5">
															<span>{label}</span>
															{boxSize > 0 && (
																<span className="!text-xl md:text-base font-black text-slate-400 dark:text-slate-500 normal-case">
																	({boxSize})
																</span>
															)}
														</div>
													</td>

													{/* Quantidades por loja individual: estoque referente e faltante abaixo */}
													{STORE_ORDER.map((storeId) => {
														const store = allData.find((s) => s.id === storeId);
														const storeStockVal = store?.stock[itemKey] || 0;
														const storeOpenVal = store?.isUnits?.[itemKey];
														const storeOpenCount = typeof storeOpenVal === "boolean" ? (storeOpenVal ? 1 : 0) : storeOpenVal || 0;
														const storeDesiredVal = storeDesired[storeId]?.[itemKey] || 0;
														const storeDiff = storeStockVal - storeDesiredVal;

														return (
															<td
																key={storeId}
																className="p-2 md:p-3.5 text-center border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
																<div className="flex flex-col items-center justify-center py-1">
																	<div className="flex items-center justify-center gap-1 font-black px-0.5">
																		<span
																			className={`text-2xl md:text-3xl font-black leading-none ${
																				storeStockVal === 0 && (storeOpenCount === 0 || hideOpen)
																					? "text-slate-300 dark:text-slate-600"
																					: "text-slate-900 dark:text-slate-100"
																			}`}
																			title={`Estoque referente: ${storeStockVal} | Meta: ${storeDesiredVal || 0}`}>
																			{storeStockVal}
																		</span>
																		{!hideOpen && storeOpenCount > 0 && (
																			<span className="text-sm md:text-lg font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap leading-none ml-0.5">
																				+{storeOpenCount}ab
																			</span>
																		)}
																	</div>
																	{storeDesiredVal > 0 ? (
																		<span
																			className="text-lg md:text-xl font-bold mt-1 leading-none text-slate-700 dark:text-slate-200 opacity-80"
																			title={`Meta em ${STORE_NAMES[storeId]}: ${storeDesiredVal} (${storeDiff < 0 ? `faltam ${Math.abs(storeDiff)}` : storeDiff > 0 ? `sobram ${storeDiff}` : "na meta"})`}>
																			(
																			<span
																				className={
																					storeDiff < 0
																						? "text-rose-600 dark:text-rose-400"
																						: "text-blue-600 dark:text-blue-400"
																				}>
																				{storeDiff < 0 ? storeDiff : storeDiff > 0 ? `+${storeDiff}` : "0"}
																			</span>
																			)
																		</span>
																	) : (
																		<span className="text-lg md:text-xl font-bold mt-1 leading-none text-slate-300 dark:text-slate-600 opacity-80">
																			-
																		</span>
																	)}
																</div>
															</td>
														);
													})}

													{/* Quantidade Total: soma apenas dos estoques referentes das lojas */}
													<td className="p-3 md:p-5 border-l-2 border-slate-200 dark:border-slate-700 text-center bg-slate-50/40 dark:bg-slate-800/40 group-hover:bg-blue-50/40 dark:group-hover:bg-blue-900/30 transition-colors">
														<div className="flex flex-col items-center justify-center gap-0.5">
															<div className="flex justify-center items-center gap-1">
																<span
																	className={`text-2xl md:text-3xl font-black leading-none ${
																		totalQty === 0 && (totalOpen === 0 || hideOpen)
																			? "text-slate-300 dark:text-slate-400"
																			: "text-slate-900 dark:text-slate-100"
																	}`}
																	title={`Estoque consolidado de todas as lojas: ${totalQty}`}>
																	{totalQty}
																</span>
																{!hideOpen && totalOpen > 0 && (
																	<span className="text-sm md:text-lg font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
																		{totalQty > 0 ? `+ ${totalOpen} ab` : `${totalOpen} ab`}
																	</span>
																)}
															</div>
														</div>
													</td>

													{/* Desejável Total e Faltantes */}
													{(() => {
														const diff = totalQty - desiredQty;
														return (
															<td className="p-3 md:p-5 text-center border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
																<div className="flex flex-col items-center justify-center py-1">
																	{hasDesired ? (
																		<>
																			<span className="text-2xl md:text-3xl font-black leading-none text-slate-800 dark:text-slate-200">
																				{desiredQty}
																			</span>
																			<span className="text-lg md:text-xl font-bold mt-1 leading-none text-slate-700 dark:text-slate-200 opacity-80">
																				(
																				<span
																					className={
																						diff < 0
																							? "text-rose-600 dark:text-rose-400"
																							: "text-blue-600 dark:text-blue-400"
																					}>
																					{diff < 0 ? diff : diff > 0 ? `+${diff}` : "0"}
																				</span>
																				)
																			</span>
																		</>
																	) : (
																		<span className="text-slate-300 dark:text-slate-600 font-black text-2xl md:text-3xl leading-none">-</span>
																	)}
																</div>
															</td>
														);
													})()}

													{/* Pacotes a Pedir (alterado apenas com botões + e -, número solto sem input de digitação e sem informação de caixas) */}
													<td className="p-3 md:p-5 text-center border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
														{(() => {
															const currentOrderQty = customOrderPackages[itemKey] ?? 0;
															const stepSize = boxSize > 0 ? boxSize : 1;

															return (
																<div className="flex items-center justify-center gap-2 md:gap-3 py-1">
																	<button
																		type="button"
																		onClick={() => stepCustomPackage(itemKey, -1)}
																		disabled={currentOrderQty <= 0}
																		className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 print:hidden"
																		title={`Diminuir ${stepSize} pacotes (-1 caixa)`}>
																		<Minus size={14} className="stroke-[2.5]" />
																	</button>

																	<span
																		className={`text-2xl md:text-3xl font-black leading-none min-w-[2.5rem] text-center ${
																			currentOrderQty > 0
																				? "text-slate-900 dark:text-slate-100"
																				: "text-slate-300 dark:text-slate-600"
																		}`}>
																		{currentOrderQty}
																	</span>

																	<button
																		type="button"
																		onClick={() => stepCustomPackage(itemKey, 1)}
																		className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 print:hidden"
																		title={`Aumentar ${stepSize} pacotes (+1 caixa)`}>
																		<Plus size={14} className="stroke-[2.5]" />
																	</button>
																</div>
															);
														})()}
													</td>
												</tr>
											);
										})}
								</tbody>
								{(() => {
									const filteredEntries = sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([key, label]) => !isSorvete(key) && label.toLowerCase().includes(searchTerm.toLowerCase()));

									let totalBoxesToOrder = 0;
									let totalPackagesToOrder = 0;

									filteredEntries.forEach(([key]) => {
										const itemKey = key as keyof StockData;
										const qty = customOrderPackages[itemKey] || 0;
										const boxSize = boxSizes[itemKey] || 0;

										if (qty > 0) {
											totalPackagesToOrder += qty;
											if (boxSize > 0) {
												totalBoxesToOrder += Math.ceil(qty / boxSize);
											}
										}
									});

									const totalCaixasLabel = totalBoxesToOrder === 1 ? "Caixa" : "Caixas";
									const totalPacotesLabel = totalPackagesToOrder === 1 ? "pacote" : "pacotes";

									const grandTotalStock = filteredEntries.reduce((sum, [key]) => {
										const itemKey = key as keyof StockData;
										return sum + allData.reduce((acc, store) => acc + (store.stock[itemKey] || 0), 0);
									}, 0);

									const totalDesiredStock = filteredEntries.reduce((sum, [key]) => {
										const itemKey = key as keyof StockData;
										return sum + (desiredData[itemKey] || 0);
									}, 0);

									return (
										<tfoot>
											<tr className="bg-slate-100/80 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-600 font-black">
												<td className="p-3 md:p-5 text-base md:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">
													TOTAL
												</td>
												{STORE_ORDER.map((storeId) => {
													const store = allData.find((s) => s.id === storeId);
													const storeTotalStock = filteredEntries.reduce(
														(sum, [key]) => sum + (store?.stock[key as keyof StockData] || 0),
														0
													);
													return (
														<td key={storeId} className="p-2 md:p-3 border-l border-slate-200 dark:border-slate-700 text-center">
															<span className="text-base md:text-xl font-black text-slate-700 dark:text-slate-300">
																{storeTotalStock}
															</span>
														</td>
													);
												})}
												<td className="p-3 md:p-5 border-l-2 border-slate-300 dark:border-slate-600 text-center font-black text-base md:text-xl text-slate-800 dark:text-slate-200">
													{grandTotalStock > 0 ? `${grandTotalStock} pcts` : "-"}
												</td>
												<td className="p-3 md:p-5 border-l border-slate-200 dark:border-slate-700 text-center text-slate-600 dark:text-slate-400 font-black text-base md:text-xl">
													{totalDesiredStock > 0 ? `${totalDesiredStock} pcts` : "-"}
												</td>
												<td className="p-3 md:p-5 border-l border-slate-200 dark:border-slate-700 text-center">
													{totalPackagesToOrder > 0 ? (
														<div className="flex flex-col items-center">
															<span className="text-lg md:text-3xl font-black text-slate-800 dark:text-slate-200">
																<span className="text-rose-600 dark:text-rose-400 font-black">
																	{totalPackagesToOrder}
																</span>{" "}
																{totalPacotesLabel}
															</span>
														</div>
													) : (
														<div className="flex flex-col items-center">
															<span className="text-base md:text-2xl font-black text-slate-400 dark:text-slate-500">
																0 Pacotes
															</span>
														</div>
													)}
												</td>
											</tr>
										</tfoot>
									);
								})()}
							</table>
						</div>
					</div>

					{/* Seção de Totais e Gerar Resumo */}
					<div id="secao-resumo-pedido" className="mt-8 space-y-6 print:hidden">
						{/* Summary Cards */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
							<div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
								<div>
									<span className="text-[0.7rem] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
										Total de Pacotes
									</span>
									<span className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
										{orderTotalPackages} <span className="text-xs font-bold text-slate-400">pacotes</span>
									</span>
								</div>
								<div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
									<Package size={22} />
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
								<div>
									<span className="text-[0.7rem] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
										Subtotal (Base)
									</span>
									<span className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
										R$ {orderBaseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</span>
								</div>
								<div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
									<DollarSign size={22} />
								</div>
							</div>

							<div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
								<div>
									<span className="text-[0.7rem] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
										Impostos (+8%)
									</span>
									<span className="text-xl md:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
										+ R$ {orderTaxValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</span>
								</div>
								<div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
									<Calculator size={22} />
								</div>
							</div>

							<div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 md:p-5 rounded-2xl md:rounded-3xl text-white shadow-lg shadow-emerald-600/20 flex items-center justify-between">
								<div>
									<span className="text-[0.7rem] md:text-xs font-black text-emerald-100 uppercase tracking-wider block">
										Valor Final com Impostos (8%)
									</span>
									<span className="text-xl md:text-2xl font-black text-white mt-0.5 block">
										R$ {orderFinalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</span>
								</div>
								<div className="p-3 rounded-2xl bg-white/20 text-white">
									<ShoppingCart size={22} />
								</div>
							</div>
						</div>

						{/* Botões Inferiores: Revisar Pedido Parcial & Gerar Resumo do Pedido */}
						<div className="flex flex-col sm:flex-row justify-center items-center gap-3 md:gap-4 py-3">
							<button
								type="button"
								onClick={() => setShowPartialPreview(true)}
								className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 px-6 md:px-10 py-3.5 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer uppercase tracking-widest">
								<Eye size={18} />
								REVISAR PEDIDO PARCIAL
							</button>

							<button
								type="button"
								onClick={() => setShowSummary(true)}
								className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white px-8 md:px-12 py-3.5 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-emerald-500/20 dark:shadow-none hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer uppercase tracking-widest">
								<FileText size={18} />
								GERAR RESUMO DO PEDIDO
							</button>
						</div>
					</div>
				</>
			) : (
				// Configurations View (Desired Stock, Box Sizes & Package Prices)
				<div className="space-y-6">
					{/* Verificação de alterações nas metas, caixas ou valores */}
					{(() => {
						const hasStockChanges = STORE_ORDER.some((sId) => {
							return Object.keys(STOCK_LABELS)
								.filter((k) => !isSorvete(k))
								.some((k) => {
									const key = k as keyof StockData;
									return (localStoreDesired[sId]?.[key] ?? 0) !== (storeDesired[sId]?.[key] ?? 0);
								});
						});
						const hasBoxChanges = Object.keys(STOCK_LABELS)
							.filter((k) => !isSorvete(k))
							.some((k) => {
								const key = k as keyof StockData;
								return (localBoxSizes[key] ?? 0) !== (boxSizes[key] ?? 0);
							});
						const hasPriceChanges = Object.keys(STOCK_LABELS)
							.filter((k) => !isSorvete(k))
							.some((k) => {
								const key = k as keyof StockData;
								return (localPackagePrices[key] ?? DEFAULT_PACKAGE_PRICES[key] ?? 0) !== (packagePrices[key] ?? DEFAULT_PACKAGE_PRICES[key] ?? 0);
							});
						const hasChanges = hasStockChanges || hasBoxChanges || hasPriceChanges;

						return (
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
								<div className="relative flex-1 max-w-full sm:max-w-md group">
									<Search
										size={18}
										className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
									/>
									<input
										type="text"
										placeholder="Filtrar por sabor..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 md:py-3 pl-12 pr-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
									/>
								</div>

								<div className="relative" title={!hasChanges && !savingDesired ? "Faça alterações para salvar" : ""}>
									<button
										onClick={saveDesiredStocks}
										disabled={!hasChanges || savingDesired}
										className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black transition-all text-xs md:text-sm ${
											hasChanges && !savingDesired
												? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-400/40 animate-pulse cursor-pointer scale-105"
												: "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70"
										}`}>
										{savingDesired ? (
											<RefreshCw className="animate-spin" size={18} />
										) : (
											<Save size={18} />
										)}
										SALVAR CONFIGURAÇÕES
									</button>
								</div>
							</div>
						);
					})()}

					<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
						<div className="overflow-x-auto">
							<table className="w-full border-collapse">
								<thead>
									<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
										<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
											PACOTES
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest min-w-[5.5rem] md:min-w-[7rem] bg-blue-50/50 dark:bg-blue-950/20 border-x border-slate-200 dark:border-slate-700">
											TOTAL
										</th>
										{STORE_ORDER.map((storeId) => (
											<th
												key={storeId}
												className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest min-w-[5.5rem] md:min-w-[7rem] border-r border-slate-200 dark:border-slate-700">
												{STORE_NAMES[storeId] || storeId}
											</th>
										))}
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[10rem]">
											PACOTES POR CAIXA
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[8.5rem] md:min-w-[11rem] border-l border-slate-200 dark:border-slate-700">
											VALOR / PCT (R$) <span className="text-[0.65rem] md:text-xs font-normal text-slate-400 dark:text-slate-500 block">(24 unidades)</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([key, label]) => !isSorvete(key) && label.toLowerCase().includes(searchTerm.toLowerCase()))
										.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const totalVal = STORE_ORDER.reduce(
												(acc, sId) => acc + (localStoreDesired[sId]?.[itemKey] || 0),
												0
											);
											const boxVal = localBoxSizes[itemKey] ?? "";
											const priceVal = localPackagePrices[itemKey] !== undefined ? localPackagePrices[itemKey] : (DEFAULT_PACKAGE_PRICES[itemKey] ?? "");

											return (
												<tr
													key={key}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-6 text-sm md:text-base font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
														{label}
													</td>
													<td className="p-3 md:p-6 border-l border-r border-slate-100 dark:border-slate-800 text-center bg-blue-50/30 dark:bg-blue-950/10">
														<span className="text-sm md:text-lg font-black text-blue-600 dark:text-blue-400">
															{totalVal}
														</span>
													</td>
													{STORE_ORDER.map((sId) => {
														const val = localStoreDesired[sId]?.[itemKey] ?? "";
														return (
															<td
																key={sId}
																className="p-2 md:p-4 border-r border-slate-100 dark:border-slate-800 text-center">
																<div className="flex justify-center">
																	<input
																		type="number"
																		min="0"
																		value={val}
																		placeholder="0"
																		onChange={(e) =>
																			handleLocalStoreDesiredChange(sId, itemKey, e.target.value)
																		}
																		onFocus={(e) => e.target.select()}
																		onClick={(e) => e.currentTarget.select()}
																		className="w-16 md:w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1 md:py-1.5 px-1.5 md:px-2 text-center text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
																	/>
																</div>
															</td>
														);
													})}
													<td className="p-3 md:p-6 text-center">
														<div className="flex justify-center items-center gap-2">
															<div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 shrink-0">
																<Package size={16} />
															</div>
															<input
																type="number"
																min="0"
																value={boxVal}
																placeholder="Qtd/cx"
																onChange={(e) => handleLocalBoxSizeChange(itemKey, e.target.value)}
																onFocus={(e) => e.target.select()}
																onClick={(e) => e.currentTarget.select()}
																className="w-16 md:w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1 md:py-1.5 px-1.5 md:px-2 text-center text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
																title="Quantidade de sacos/pacotes por caixa"
															/>
														</div>
													</td>
													<td className="p-3 md:p-6 text-center border-l border-slate-100 dark:border-slate-800">
														<div className="flex justify-center items-center gap-1.5 md:gap-2">
															<span className="text-xs md:text-sm font-black text-slate-400 dark:text-slate-500">
																R$
															</span>
															<input
																type="number"
																step="0.01"
																min="0"
																value={priceVal}
																placeholder="0.00"
																onChange={(e) => handleLocalPackagePriceChange(itemKey, e.target.value)}
																onFocus={(e) => e.target.select()}
																onClick={(e) => e.currentTarget.select()}
																className="w-24 md:w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1 md:py-1.5 px-1.5 md:px-2 text-center text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
																title="Valor do pacote com 24 unidades"
															/>
														</div>
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{/* Modal de Resumo do Pedido */}
			{showSummary && (
				<div id="modal-resumo-print" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
					{(() => {
						const cookieEntries = sortStockEntries(Object.entries(STOCK_LABELS))
							.filter(([key]) => !isSorvete(key));

						let totalBoxes = 0;
						let baseTotalValue = 0;
						const activeItems: { label: string; qty: number; boxesCount: number; boxSize: number }[] = [];

						cookieEntries.forEach(([key, label]) => {
							const itemKey = key as keyof StockData;
							const qty = customOrderPackages[itemKey] || 0;
							const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
							const totalItem = qty * pricePerPkg;
							const boxSize = boxSizes[itemKey] || 1;
							const boxesCount = Math.ceil(qty / boxSize);

							if (qty > 0) {
								totalBoxes += boxesCount;
								baseTotalValue += totalItem;
								activeItems.push({
									label,
									qty,
									boxesCount,
									boxSize,
								});
							}
						});

						const finalTotalValue = baseTotalValue * 1.08;

						const generateSummaryText = () => {
							if (activeItems.length === 0) return "";
							let text = `*RESUMO DO PEDIDO DE ESTOQUE*\n`;
							text += `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n`;
							text += `*CAIXAS A PEDIR:*\n`;

							activeItems.forEach((item) => {
								const caixasLabel = item.boxesCount === 1 ? "cx" : "cxs";
								text += `• ${item.label}: *${item.boxesCount} ${caixasLabel}* (${item.qty} pcts)\n`;
							});

							text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
							text += `*Total de Caixas:* ${totalBoxes} ${totalBoxes === 1 ? "caixa" : "caixas"}\n`;
							text += `*Valor Final Base:* R$ ${baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							text += `*Valor Final com Impostos (8%):* R$ ${finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
							return text;
						};

						const handleWhatsApp = async () => {
							const text = generateSummaryText();
							if (!text) return;

							const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
							const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
							const isSmallScreen = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
							const isMobile = isMobileUserAgent || isSmallScreen;

							if (isMobile && typeof navigator !== "undefined" && typeof navigator.share === "function") {
								try {
									await navigator.share({
										title: `Resumo do Pedido de Estoque - ${new Date().toLocaleDateString("pt-BR")}`,
										text: text,
									});
									return;
								} catch (err: any) {
									if (err.name === "AbortError") return;
									console.warn("Navigator share falhou, tentando fallback:", err);
								}
							}

							const encodedText = encodeURIComponent(text);
							if (isMobile) {
								window.location.href = `whatsapp://send?text=${encodedText}`;
								setTimeout(() => {
									window.location.href = `https://api.whatsapp.com/send?text=${encodedText}`;
								}, 700);
							} else {
								window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
							}
						};

						const handleCopySummary = async () => {
							const text = generateSummaryText();
							if (!text) return;
							try {
								await navigator.clipboard.writeText(text);
								setCopiedSummary(true);
								setTimeout(() => setCopiedSummary(false), 2500);
							} catch (err) {
								console.error("Falha ao copiar:", err);
							}
						};

						const handlePrint = () => {
							if (activeItems.length === 0) return;

							const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
							const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
							const isSmallScreen = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
							const isMobile = isMobileUserAgent || isSmallScreen;

							if (isMobile) {
								const printWindow = window.open("", "_blank");
								if (printWindow) {
									const dateStr = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
									const itemsHtml = activeItems
										.map((item) => {
											const caixasLabel = item.boxesCount === 1 ? "cx" : "cxs";
											return `<li style="display:flex; justify-content:space-between; padding:3px 0; font-size:14px;">
												<span>• <strong>${item.label}</strong>: <strong>${item.boxesCount} ${caixasLabel}</strong> <span style="color:#666; font-size:12px;">(${item.qty} pcts)</span></span>
											</li>`;
										})
										.join("");

									printWindow.document.write(`<!DOCTYPE html>
									<html>
										<head>
											<meta charset="utf-8">
											<meta name="viewport" content="width=device-width, initial-scale=1.0">
											<title>Resumo do Pedido</title>
											<style>
												body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #111; margin: 0; }
												h2 { font-size: 18px; margin: 0 0 4px 0; text-transform: uppercase; }
												p.date { font-size: 12px; color: #666; margin: 0 0 16px 0; }
												h3 { font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; }
												ul { list-style: none; padding: 0; margin: 0 0 20px 0; }
												.totals { border-top: 1px solid #ddd; padding-top: 12px; font-size: 14px; }
												.totals div { display: flex; justify-content: space-between; margin-bottom: 6px; }
												.totals .final { font-weight: bold; font-size: 16px; border-top: 1px solid #ddd; padding-top: 6px; margin-top: 6px; }
											</style>
										</head>
										<body>
											<h2>Resumo do Pedido de Estoque</h2>
											<p class="date">${dateStr}</p>
											<h3>Caixas a Pedir:</h3>
											<ul>${itemsHtml}</ul>
											<div class="totals">
												<div><span>Total de Caixas:</span><strong>${totalBoxes} ${totalBoxes === 1 ? "caixa" : "caixas"}</strong></div>
												<div><span>Valor Final Base:</span><span>R$ ${baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
												<div class="final"><span>Valor Final com Impostos (8%):</span><strong>R$ ${finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
											</div>
											<script>
												window.onload = function() {
													setTimeout(function() {
														window.print();
													}, 300);
												};
											</script>
										</body>
									</html>`);
									printWindow.document.close();
									return;
								}
							}

							window.print();
						};

						return (
							<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-full sm:max-w-xl md:max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
								<div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between print:hidden">
									<div>
										<h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
											Resumo do Pedido (Caixas)
										</h2>
										<span className="text-xs font-bold text-slate-400">
											{new Date().toLocaleDateString("pt-BR")}
										</span>
									</div>
									<div className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs md:text-sm font-black">
										{totalBoxes} {totalBoxes === 1 ? "cx" : "cxs"}
									</div>
								</div>

								<div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 print:overflow-visible print:p-0">
									{activeItems.length > 0 ? (
										<div className="space-y-4 print:space-y-4 w-full">
											{/* Lista Minimalista para Conferência na Tela */}
											<div className="divide-y divide-slate-100 dark:divide-slate-800 print:hidden">
												{activeItems.map((item, idx) => (
													<div
														key={idx}
														className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition-colors">
														<div className="flex items-center gap-2 min-w-0">
															<span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
															<span className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 uppercase truncate">
																{item.label}
															</span>
															<span className="text-md font-bold text-slate-400 shrink-0">
																({item.qty} pcts)
															</span>
														</div>
														<div className="shrink-0 text-right">
															<span className="text-base md:text-xl font-black text-blue-600 dark:text-blue-400">
																{item.boxesCount} {item.boxesCount === 1 ? "caixa" : "caixas"}
															</span>
														</div>
													</div>
												))}
											</div>

											{/* Resumo Financeiro Minimalista */}
											<div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 print:hidden space-y-2 mt-4">
												<div className="flex items-center justify-between text-sm md:text-lg">
													<span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
														Valor Final Base
													</span>
													<span className="font-black text-slate-700 dark:text-slate-200 !text-lg md:!text-2xl">
														R$ {baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
													</span>
												</div>
												<div className="flex items-center justify-between text-sm md:text-lg pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
													<span className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
														Valor Final com Impostos
													</span>
													<span className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400">
														R$ {finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
													</span>
												</div>
											</div>

											{/* Visão de Impressão (Minimalista, Econômica de Tinta, Sem Divisões Excessivas) */}
											<div className="hidden print:block w-full text-black font-sans text-[9.5pt] leading-tight max-w-[180mm] mx-auto">
												<div className="mb-3 text-left">
													<h2 className="text-[11pt] font-black uppercase tracking-wide text-black">
														Resumo do Pedido de Estoque
													</h2>
													<p className="text-[8pt] text-neutral-600 mt-0.5">
														{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
													</p>
												</div>

												<div className="mb-3">
													<p className="text-[9pt] font-black uppercase tracking-wider mb-1.5 text-black">
														Caixas a Pedir:
													</p>
													<ul className="space-y-1">
														{activeItems.map((item, i) => {
															const caixasLabel = item.boxesCount === 1 ? "cx" : "cxs";
															return (
																<li key={i} className="flex items-baseline justify-between py-0.5">
																	<span>
																		• <strong className="font-black uppercase">{item.label}</strong>:{" "}
																		<strong className="font-black">{item.boxesCount} {caixasLabel}</strong>{" "}
																		<span className="text-[8.5pt] text-neutral-600">({item.qty} pcts)</span>
																	</span>
																</li>
															);
														})}
													</ul>
												</div>

												<div className="pt-2 space-y-1 mt-3">
													<div className="flex justify-between items-baseline">
														<span className="font-bold">Total de Caixas:</span>
														<strong className="font-black text-[10pt]">
															{totalBoxes} {totalBoxes === 1 ? "caixa" : "caixas"}
														</strong>
													</div>
													<div className="flex justify-between items-baseline">
														<span>Valor Final Base:</span>
														<span>
															R$ {baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
														</span>
													</div>
													<div className="flex justify-between items-baseline pt-1">
														<span className="font-black uppercase">Valor Final com Impostos (8%):</span>
														<strong className="font-black text-[10.5pt]">
															R$ {finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
														</strong>
													</div>
												</div>
											</div>
										</div>
									) : (
										<div className="text-center py-10">
											<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs md:text-sm">
												Nenhum item com quantidade a pedir selecionado.
											</p>
										</div>
									)}
								</div>

								<div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2.5 transition-colors print:hidden">
									<div className="grid grid-cols-1 sm:grid-cols-4 items-stretch gap-2.5 w-full max-w-2xl">
										<button
											onClick={() => {
												setShowSummary(false);
												setShowPartialPreview(true);
											}}
											className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
											title="Abrir tabela de conferência do pedido parcial">
											<Eye size={16} />
											<span>Revisar Parcial</span>
										</button>
										<button
											onClick={handleCopySummary}
											disabled={activeItems.length === 0}
											className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-3 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-50 cursor-pointer">
											{copiedSummary ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
											<span>{copiedSummary ? "Copiado!" : "Copiar Resumo"}</span>
										</button>
										<button
											onClick={handleWhatsApp}
											disabled={activeItems.length === 0}
											className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
											<span>Enviar WhatsApp</span>
										</button>
										<button
											onClick={handlePrint}
											disabled={activeItems.length === 0}
											className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
											<Printer size={16} />
											<span>Imprimir</span>
										</button>
									</div>
									<button
										onClick={() => setShowSummary(false)}
										className="w-full sm:w-auto min-w-[120px] px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
										Fechar
									</button>
								</div>
							</div>
						);
					})()}
				</div>
			)}

			{/* Modal de Revisão do Pedido Parcial (Tabela Simplificada para Impressão) */}
			{showPartialPreview && (
				<div id="modal-pedido-parcial-print" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
					{(() => {
						const allFlavors = sortStockEntries(Object.entries(STOCK_LABELS)).filter(([key]) => !isSorvete(key));
						const itemsWithOrder = allFlavors.filter(([key]) => (customOrderPackages[key as keyof StockData] || 0) > 0);
						const displayedFlavors = partialOnlyWithOrder && itemsWithOrder.length > 0 ? itemsWithOrder : allFlavors;

						let totalBoxes = 0;
						let totalPackages = 0;
						let baseTotalVal = 0;

						allFlavors.forEach(([key]) => {
							const itemKey = key as keyof StockData;
							const qty = customOrderPackages[itemKey] || 0;
							const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
							const boxSize = boxSizes[itemKey] || 1;
							const boxesCount = Math.ceil(qty / boxSize);

							if (qty > 0) {
								totalPackages += qty;
								totalBoxes += boxesCount;
								baseTotalVal += qty * pricePerPkg;
							}
						});

						const finalTotalVal = baseTotalVal * 1.08;

						const generatePartialText = () => {
							if (itemsWithOrder.length === 0) return "";
							let text = `*RESUMO DO PEDIDO PARCIAL*\n`;
							text += `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n`;
							text += `*ITENS A PEDIR:*\n`;

							itemsWithOrder.forEach(([key, label]) => {
								const itemKey = key as keyof StockData;
								const qty = customOrderPackages[itemKey] || 0;
								const boxSize = boxSizes[itemKey] || 1;
								const boxesCount = Math.ceil(qty / boxSize);
								const caixasLabel = boxesCount === 1 ? "cx" : "cxs";
								text += `• ${label}: *${boxesCount} ${caixasLabel}* (${qty} pcts)\n`;
							});

							text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
							text += `*Total de Caixas:* ${totalBoxes} ${totalBoxes === 1 ? "caixa" : "caixas"}\n`;
							text += `*Total de Pacotes:* ${totalPackages} pacotes\n`;
							text += `*Valor Final Base:* R$ ${baseTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							text += `*Valor Final com Impostos (8%):* R$ ${finalTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
							return text;
						};

						const handlePartialWhatsApp = async () => {
							const text = generatePartialText();
							if (!text) return;

							const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
							const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
							const isSmallScreen = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
							const isMobile = isMobileUserAgent || isSmallScreen;

							if (isMobile && typeof navigator !== "undefined" && typeof navigator.share === "function") {
								try {
									await navigator.share({
										title: `Pedido Parcial de Estoque - ${new Date().toLocaleDateString("pt-BR")}`,
										text: text,
									});
									return;
								} catch (err: any) {
									if (err.name === "AbortError") return;
									console.warn("Navigator share falhou, tentando fallback:", err);
								}
							}

							const encodedText = encodeURIComponent(text);
							if (isMobile) {
								window.location.href = `whatsapp://send?text=${encodedText}`;
								setTimeout(() => {
									window.location.href = `https://api.whatsapp.com/send?text=${encodedText}`;
								}, 700);
							} else {
								window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
							}
						};

						const handlePartialCopy = async () => {
							const text = generatePartialText();
							if (!text) return;
							try {
								await navigator.clipboard.writeText(text);
								setCopiedPartialSummary(true);
								setTimeout(() => setCopiedPartialSummary(false), 2500);
							} catch (err) {
								console.error("Falha ao copiar resumo parcial:", err);
							}
						};

						const handlePartialPrint = () => {
							const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
							const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
							const isSmallScreen = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
							const isMobile = isMobileUserAgent || isSmallScreen;

							if (isMobile) {
								const printWindow = window.open("", "_blank");
								if (printWindow) {
									const dateStr = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
									const storeHeadersHtml = STORE_ORDER.map((sId) => `<th style="border: 1px solid #333; padding: 4px; font-size: 8.5pt;">${STORE_NAMES[sId] || sId}</th>`).join("");
									
									const rowsHtml = displayedFlavors.map(([key, label]) => {
										const itemKey = key as keyof StockData;
										const boxSize = boxSizes[itemKey] || 1;
										const currentQty = customOrderPackages[itemKey] || 0;
										const boxes = currentQty > 0 ? Math.ceil(currentQty / boxSize) : 0;
										const totalStock = allData.reduce((sum, s) => sum + (s.stock[itemKey] || 0), 0);
										const desired = desiredData[itemKey] || 0;

										const storeCellsHtml = STORE_ORDER.map((sId) => {
											const store = allData.find((s) => s.id === sId);
											return `<td style="border: 1px solid #ccc; padding: 4px; text-align: center; font-size: 8.5pt;">${store?.stock[itemKey] || 0}</td>`;
										}).join("");

										return `<tr>
											<td style="border: 1px solid #ccc; padding: 4px; font-size: 8.5pt; text-align: left; font-weight: bold;">${label} <span style="font-size: 7.5pt; color: #666; font-weight: normal;">(${boxSize})</span></td>
											${storeCellsHtml}
											<td style="border: 1px solid #ccc; padding: 4px; text-align: center; font-size: 8.5pt; font-weight: bold;">${totalStock}</td>
											<td style="border: 1px solid #ccc; padding: 4px; text-align: center; font-size: 8.5pt;">${desired}</td>
											<td style="border: 1px solid #333; padding: 4px; text-align: center; font-size: 9pt; font-weight: bold;">${currentQty > 0 ? `${currentQty}` : "-"}</td>
										</tr>`;
									}).join("");

									printWindow.document.write(`<!DOCTYPE html>
									<html>
										<head>
											<meta charset="utf-8">
											<meta name="viewport" content="width=device-width, initial-scale=1.0">
											<title>Pedido Parcial de Estoque</title>
											<style>
												body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 15px; color: #111; margin: 0; }
												h2 { font-size: 16px; margin: 0 0 4px 0; text-transform: uppercase; text-align: center; }
												p.date { font-size: 11px; color: #666; margin: 0 0 12px 0; text-align: center; }
												table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
												th { background: transparent; text-transform: uppercase; }
												.totals { border-top: 2px solid #333; padding-top: 8px; font-size: 12px; }
												.totals div { display: flex; justify-content: space-between; margin-bottom: 4px; }
												.totals .final { font-weight: bold; font-size: 14px; border-top: 1px solid #ddd; padding-top: 4px; }
											</style>
										</head>
										<body>
											<h2>Relatório de Pedido Parcial de Estoque</h2>
											<p class="date">${dateStr}</p>
											<table>
												<thead>
													<tr>
														<th style="border: 1px solid #333; padding: 4px; text-align: left; font-size: 8.5pt;">Sabor (cx)</th>
														${storeHeadersHtml}
														<th style="border: 1px solid #333; padding: 4px; font-size: 8.5pt;">Total</th>
														<th style="border: 1px solid #333; padding: 4px; font-size: 8.5pt;">Meta</th>
														<th style="border: 1px solid #333; padding: 4px; font-size: 8.5pt;">A Pedir</th>
													</tr>
												</thead>
												<tbody>${rowsHtml}</tbody>
											</table>
											<div class="totals">
												<div><span>Total de Caixas a Pedir:</span><strong>${totalBoxes} ${totalBoxes === 1 ? "caixa" : "caixas"}</strong></div>
												<div><span>Total de Pacotes a Pedir:</span><strong>${totalPackages}</strong></div>
												<div><span>Valor Estimado Base:</span><span>R$ ${baseTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
												<div class="final"><span>Valor Final com Impostos (8%):</span><strong>R$ ${finalTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
											</div>
											<script>
												window.onload = function() {
													setTimeout(function() { window.print(); }, 300);
												};
											</script>
										</body>
									</html>`);
									printWindow.document.close();
									return;
								}
							}

							window.print();
						};

						return (
							<div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-full sm:max-w-4xl md:max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
								{/* Modal Header */}
								<div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
									<div>
										<div className="flex items-center gap-2">
											<Eye size={18} className="text-blue-600 dark:text-blue-400" />
											<h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
												Revisão do Pedido Parcial
											</h2>
										</div>
										<span className="text-xs font-bold text-slate-400 block mt-0.5">
											{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
										</span>
									</div>

									<div className="flex items-center gap-3">
										<label className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
											<input
												type="checkbox"
												checked={partialOnlyWithOrder}
												onChange={(e) => setPartialOnlyWithOrder(e.target.checked)}
												className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
											/>
											<span>Apenas sendo pedidos ({itemsWithOrder.length})</span>
										</label>

										<div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs md:text-sm font-black whitespace-nowrap">
											{totalPackages} pcts ({totalBoxes} {totalBoxes === 1 ? "cx" : "cxs"})
										</div>
									</div>
								</div>

								{/* Modal Content - Table Preview */}
								<div className="p-3 md:p-5 overflow-y-auto custom-scrollbar flex-1 print:overflow-visible print:p-0">
									{displayedFlavors.length > 0 ? (
										<div className="space-y-4">
											{/* Preview Table on Screen (sem botões, apenas informações) */}
											<div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 print:hidden">
												<table className="w-full border-collapse text-left">
													<thead>
														<tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase font-black">
															<th className="p-3">SABOR (CX)</th>
															{STORE_ORDER.map((sId) => (
																<th key={sId} className="p-3 text-center border-l border-slate-200 dark:border-slate-700">
																	{STORE_NAMES[sId] || sId}
																</th>
															))}
															<th className="p-3 text-center border-l border-slate-200 dark:border-slate-700">TOTAL ESTOQUE</th>
															<th className="p-3 text-center border-l border-slate-200 dark:border-slate-700">DESEJÁVEL</th>
															<th className="p-3 text-center border-l-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 font-black">
																PACOTES A PEDIR
															</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
														{displayedFlavors.map(([key, label]) => {
															const itemKey = key as keyof StockData;
															const boxSize = boxSizes[itemKey] || 1;
															const currentQty = customOrderPackages[itemKey] || 0;
															const boxes = currentQty > 0 ? Math.ceil(currentQty / boxSize) : 0;
															const totalStock = allData.reduce((sum, s) => sum + (s.stock[itemKey] || 0), 0);
															const desired = desiredData[itemKey] || 0;
															const isOrdered = currentQty > 0;

															return (
																<tr
																	key={key}
																	className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors ${
																		isOrdered ? "bg-white dark:bg-slate-900" : "opacity-60 bg-slate-50/30 dark:bg-slate-900/30"
																	}`}>
																	<td className="p-3 text-xs md:text-sm font-black text-slate-800 dark:text-slate-100 uppercase">
																		<div className="flex items-center gap-1.5">
																			<span>{label}</span>
																			<span className="text-[0.9rem] text-slate-600 dark:text-slate-300 font-semibold">
																				({boxSize})
																			</span>
																		</div>
																	</td>
																	{STORE_ORDER.map((sId) => {
																		const store = allData.find((s) => s.id === sId);
																		const storeStock = store?.stock[itemKey] || 0;
																		return (
																			<td key={sId} className="p-3 text-center border-l border-slate-100 dark:border-slate-800 text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300">
																				{storeStock}
																			</td>
																		);
																	})}
																	<td className="p-3 text-center border-l border-slate-100 dark:border-slate-800 text-xs md:text-sm font-black text-slate-700 dark:text-slate-200">
																		{totalStock}
																	</td>
																	<td className="p-3 text-center border-l border-slate-100 dark:border-slate-800 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">
																		{desired > 0 ? desired : "-"}
																	</td>
																	<td className="p-3 text-center border-l-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
																		{currentQty > 0 ? (
																			<span className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100">
																				{currentQty}
																			</span>
																		) : (
																			<span className="text-slate-300 dark:text-slate-600 text-xs font-bold">-</span>
																		)}
																	</td>
																</tr>
															);
														})}
													</tbody>
													<tfoot>
														<tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-600 font-black text-xs md:text-sm">
															<td className="p-3 uppercase text-slate-800 dark:text-slate-100">
																TOTAL
															</td>
															{STORE_ORDER.map((sId) => {
																const storeTotal = displayedFlavors.reduce((sum, [key]) => {
																	const store = allData.find((s) => s.id === sId);
																	return sum + (store?.stock[key as keyof StockData] || 0);
																}, 0);
																return (
																	<td key={sId} className="p-3 text-center border-l border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
																		{storeTotal}
																	</td>
																);
															})}
															<td className="p-3 text-center border-l border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
																{displayedFlavors.reduce((sum, [key]) => sum + allData.reduce((acc, s) => acc + (s.stock[key as keyof StockData] || 0), 0), 0)}
															</td>
															<td className="p-3 text-center border-l border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
																{displayedFlavors.reduce((sum, [key]) => sum + (desiredData[key as keyof StockData] || 0), 0)}
															</td>
															<td className="p-3 text-center border-l-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-50 font-black text-base">
																{totalPackages > 0 ? `${totalPackages}` : "0"}
															</td>
														</tr>
													</tfoot>
												</table>
											</div>

											{/* Mini Totais de Conferência */}
											<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 print:hidden">
												<div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
													<span className="text-[0.68rem] font-bold text-slate-400 uppercase block">Total de Pacotes</span>
													<span className="text-base md:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{totalPackages} pcts</span>
												</div>
												<div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
													<span className="text-[0.68rem] font-bold text-slate-400 uppercase block">Total de Caixas</span>
													<span className="text-base md:text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{totalBoxes} cxs</span>
												</div>
												<div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
													<span className="text-[0.68rem] font-bold text-slate-400 uppercase block">Subtotal (Base)</span>
													<span className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5 block">R$ {baseTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
												</div>
												<div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
													<span className="text-[0.68rem] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">Final (+8% imp.)</span>
													<span className="text-base md:text-lg font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">R$ {finalTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
												</div>
											</div>

											{/* Visão de Impressão da Tabela Simplificada */}
											<div className="hidden print:block w-full text-black font-sans text-[8pt] leading-tight max-w-[190mm] mx-auto">
												<div className="mb-2 text-center">
													<h2 className="text-[11pt] font-black uppercase tracking-wider text-black">
														Relatório de Pedido Parcial de Estoque
													</h2>
													<p className="text-[7.5pt] text-neutral-600 mt-0.5">
														{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
													</p>
												</div>

												<table className="w-full border-collapse border border-slate-600 text-[8pt]">
													<thead>
														<tr className="bg-transparent text-black font-black uppercase text-[7.5pt]">
															<th className="border border-slate-600 p-1 text-left">Sabor (cx)</th>
															{STORE_ORDER.map((sId) => (
																<th key={sId} className="border border-slate-600 p-1 text-center">
																	{STORE_NAMES[sId] || sId}
																</th>
															))}
															<th className="border border-slate-600 p-1 text-center">Estoque</th>
															<th className="border border-slate-600 p-1 text-center">Meta</th>
															<th className="border border-slate-600 p-1 text-center font-black">A Pedir</th>
														</tr>
													</thead>
													<tbody>
														{displayedFlavors.map(([key, label]) => {
															const itemKey = key as keyof StockData;
															const boxSize = boxSizes[itemKey] || 1;
															const currentQty = customOrderPackages[itemKey] || 0;
															const boxes = currentQty > 0 ? Math.ceil(currentQty / boxSize) : 0;
															const totalStock = allData.reduce((sum, s) => sum + (s.stock[itemKey] || 0), 0);
															const desired = desiredData[itemKey] || 0;

															return (
																<tr key={key} className="border-b border-slate-400">
																	<td className="border border-slate-400 p-1 font-bold text-left">
																		{label} <span className="font-normal text-[7pt] text-slate-600">({boxSize})</span>
																	</td>
																	{STORE_ORDER.map((sId) => {
																		const store = allData.find((s) => s.id === sId);
																		return (
																			<td key={sId} className="border border-slate-400 p-1 text-center">
																				{store?.stock[itemKey] || 0}
																			</td>
																		);
																	})}
																	<td className="border border-slate-400 p-1 text-center font-bold">
																		{totalStock}
																	</td>
																	<td className="border border-slate-400 p-1 text-center">
																		{desired > 0 ? desired : "-"}
																	</td>
																	<td className="border border-slate-600 p-1 text-center font-black">
																		{currentQty > 0 ? `${currentQty}` : "-"}
																	</td>
																</tr>
															);
														})}
													</tbody>
													<tfoot>
														<tr className="bg-transparent border-t-2 border-slate-800 font-black text-[8pt]">
															<td className="border border-slate-800 p-1 uppercase text-left">TOTAL</td>
															{STORE_ORDER.map((sId) => {
																const storeTotal = displayedFlavors.reduce((sum, [key]) => {
																	const store = allData.find((s) => s.id === sId);
																	return sum + (store?.stock[key as keyof StockData] || 0);
																}, 0);
																return (
																	<td key={sId} className="border border-slate-800 p-1 text-center">
																		{storeTotal}
																	</td>
																);
															})}
															<td className="border border-slate-800 p-1 text-center">
																{displayedFlavors.reduce((sum, [key]) => sum + allData.reduce((acc, s) => acc + (s.stock[key as keyof StockData] || 0), 0), 0)}
															</td>
															<td className="border border-slate-800 p-1 text-center">
																{displayedFlavors.reduce((sum, [key]) => sum + (desiredData[key as keyof StockData] || 0), 0)}
															</td>
															<td className="border border-slate-800 p-1 text-center font-black">
																{totalPackages}
															</td>
														</tr>
													</tfoot>
												</table>

												<div className="pt-2 text-[8pt] flex justify-between items-center border-t border-slate-400 mt-2">
													<div><strong>Total de Caixas:</strong> {totalBoxes} {totalBoxes === 1 ? "caixa" : "caixas"} ({totalPackages} pacotes)</div>
													<div><strong>Subtotal:</strong> R$ {baseTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
													<div><strong>Total com Impostos (8%):</strong> R$ {finalTotalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
												</div>
											</div>
										</div>
									) : (
										<div className="text-center py-12">
											<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs md:text-sm">
												Nenhum item adicionado ao pedido parcial até o momento.
											</p>
										</div>
									)}
								</div>

								{/* Modal Footer with Required Action Buttons */}
								<div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2.5 transition-colors print:hidden">
									<div className="grid grid-cols-1 sm:grid-cols-3 items-stretch gap-2.5 w-full max-w-2xl">
										<button
											onClick={handlePartialPrint}
											className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/20 dark:shadow-none transition-all cursor-pointer">
											<Printer size={16} />
											<span>Imprimir pedido parcial</span>
										</button>
										<button
											onClick={() => setShowPartialPreview(false)}
											className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer">
											<Edit3 size={16} />
											<span>Editar Pedido</span>
										</button>
										<button
											onClick={() => {
												setShowPartialPreview(false);
												setShowSummary(true);
											}}
											className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 dark:shadow-none transition-all cursor-pointer">
											<FileText size={16} />
											<span>Gerar Resumo do Pedido</span>
										</button>
									</div>
									<button
										onClick={() => setShowPartialPreview(false)}
										className="w-full sm:w-auto min-w-[120px] px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
										Fechar
									</button>
								</div>
							</div>
						);
					})()}
				</div>
			)}
		</>
	);
}


