"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, limit, doc, setDoc } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, sortStockEntries } from "@/types";
import { RefreshCw, ArrowLeftRight, Printer, Search, Eye, EyeOff, ChevronDown, Save, FileText, Settings, Package, DollarSign, Calculator, ShoppingCart, Copy, Check, Plus, Minus } from "lucide-react";

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
	brookie: 288.0,
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
	const [activeSubTab, setActiveSubTab] = useState<"comparativo" | "valorPedido" | "desejavel" | "valoresPacote">("comparativo");
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [realCurrentData, setRealCurrentData] = useState<FullStoreData[]>([]);
	const [sessions, setSessions] = useState<RepositionSnapshotDoc[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string>("atual");
	const [searchTerm, setSearchTerm] = useState("");
	const [hideOpen, setHideOpen] = useState(false);

	// Desired Stock States
	const [desiredData, setDesiredData] = useState<Partial<StockData>>({});
	const [localDesired, setLocalDesired] = useState<Partial<StockData>>({});
	
	// Box Sizes (Pacotes por caixa)
	const [boxSizes, setBoxSizes] = useState<Partial<StockData>>({});
	const [localBoxSizes, setLocalBoxSizes] = useState<Partial<StockData>>({});

	// Package Prices (Valores por pacote por sabor)
	const [packagePrices, setPackagePrices] = useState<Partial<Record<keyof StockData, number>>>(DEFAULT_PACKAGE_PRICES);
	const [localPackagePrices, setLocalPackagePrices] = useState<Partial<Record<keyof StockData, number>>>(DEFAULT_PACKAGE_PRICES);

	// Custom Order Packages (para simulação e edição na sub-aba VALOR DO PEDIDO)
	const [customOrderPackages, setCustomOrderPackages] = useState<Partial<Record<keyof StockData, number>>>({});
	const [copiedSummary, setCopiedSummary] = useState(false);
	const [showSummary, setShowSummary] = useState(false);

	const [savingDesired, setSavingDesired] = useState(false);
	const [savingPackagePrices, setSavingPackagePrices] = useState(false);

	const formatHistoryLabel = (date: Date) => {
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
		const weekDay = weekDays[date.getDay()];
		
		const hours = String(date.getHours()).padStart(2, "0");
		const minutes = String(date.getMinutes()).padStart(2, "0");
		
		return `${day}/${month} (${weekDay}) - ${hours}:${minutes}`;
	};

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
					stock: storeDoc.stock || {},
					isUnits: storeDoc.isUnits || {},
				};
			});

			setRealCurrentData(newFullData);
			setLoading(false);
		});

		return () => unsubscribeStores();
	}, []);

	// 2. Fetch finalized reposition snapshots
	useEffect(() => {
		const fetchSessions = async () => {
			try {
				const snapshotsRef = collection(db, "repositionSnapshots");
				const q = query(
					snapshotsRef,
					limit(200)
				);
				const querySnapshot = await getDocs(q);
				const docs = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				})) as RepositionSnapshotDoc[];
				
				const finishedSessions = docs
					.filter((d) => d.type === "fim")
					.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
				setSessions(finishedSessions);
			} catch (error) {
				console.error("Erro ao buscar históricos para seleção:", error);
			}
		};

		fetchSessions();
	}, []);

	// 3. Fetch desired stocks, box sizes & package prices (Global doc logic with store fallback sum if needed)
	useEffect(() => {
		const unsubscribeDesired = onSnapshot(collection(db, "desiredStocks"), (snapshot) => {
			let aggregatedStock: Partial<StockData> = {};
			let aggregatedBoxSizes: Partial<StockData> = {};
			let fetchedPackagePrices: Partial<Record<keyof StockData, number>> = {};
			const globalDoc = snapshot.docs.find((d) => d.id === "global");
			
			if (globalDoc) {
				const data = globalDoc.data();
				aggregatedStock = data.stock || {};
				aggregatedBoxSizes = data.boxSizes || {};
				fetchedPackagePrices = data.packagePrices || {};
			} else {
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

	// Save Desired Stock & Box Sizes globally
	const saveDesiredStocks = async () => {
		setSavingDesired(true);
		try {
			const docRef = doc(db, "desiredStocks", "global");
			await setDoc(docRef, { stock: localDesired, boxSizes: localBoxSizes }, { merge: true });
			setActiveSubTab("comparativo");
		} catch (error) {
			console.error("Erro ao salvar metas e caixas:", error);
			alert("Erro ao salvar. Verifique o console.");
		} finally {
			setSavingDesired(false);
		}
	};

	// Save Package Prices globally
	const savePackagePrices = async () => {
		setSavingPackagePrices(true);
		try {
			const docRef = doc(db, "desiredStocks", "global");
			await setDoc(docRef, { packagePrices: localPackagePrices }, { merge: true });
			setActiveSubTab("comparativo");
		} catch (error) {
			console.error("Erro ao salvar valores por pacote:", error);
			alert("Erro ao salvar. Verifique o console.");
		} finally {
			setSavingPackagePrices(false);
		}
	};

	const handleLocalDesiredChange = (itemKey: keyof StockData, value: string) => {
		const numValue = value === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
		setLocalDesired((prev) => ({
			...prev,
			[itemKey]: numValue,
		}));
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

	// Helper para obter os pacotes sugeridos pelo comparativo (App)
	const getSuggestedOrderPackages = (itemKey: keyof StockData): number => {
		const totalQty = allData.reduce((sum, store) => sum + (store.stock[itemKey] || 0), 0);
		const desiredQty = desiredData[itemKey] || 0;
		const diff = totalQty - desiredQty;
		const boxSize = boxSizes[itemKey] || 0;

		if (desiredQty > 0 && boxSize > 0 && diff < 0) {
			const absDiff = Math.abs(diff);
			const boxesCount = Math.ceil(absDiff / boxSize);
			return boxesCount * boxSize;
		}
		return 0;
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
		const suggested = getSuggestedOrderPackages(itemKey);
		const current = customOrderPackages[itemKey] !== undefined ? (customOrderPackages[itemKey] || 0) : suggested;
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
						margin: 10mm;
					}
					* {
						-webkit-print-color-adjust: stroke !important;
						print-color-adjust: stroke !important;
						box-shadow: none !important;
						text-shadow: none !important;
					}
					body {
						background: white !important;
						color: black !important;
						font-family: Arial, sans-serif !important;
						padding: 0 !important;
						margin: 0 !important;
					}
					nav, header, footer, .print\\:hidden, button {
						display: none !important;
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
					span, div {
						background: transparent !important;
						border: none !important;
						border-radius: 0 !important;
						padding: 0 !important;
						margin: 0 !important;
						color: black !important;
						box-shadow: none !important;
						font-size: 10pt !important;
						font-weight: normal !important;
					}
					td span.font-black, td span.font-bold, td .font-black {
						font-weight: bold !important;
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
					COMPARATIVO DE ESTOQUE
				</button>
				<button
					onClick={() => setActiveSubTab("valorPedido")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "valorPedido"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<Calculator size={16} />
					VALOR DO PEDIDO
				</button>
				<button
					onClick={() => setActiveSubTab("desejavel")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "desejavel"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<Settings size={16} />
					ESTOQUE DESEJÁVEL (METAS)
				</button>
				<button
					onClick={() => setActiveSubTab("valoresPacote")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "valoresPacote"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<DollarSign size={16} />
					VALORES POR PACOTE
				</button>
			</div>

			{activeSubTab === "comparativo" ? (
				<>
					<div className="hidden print:block">
						<h1 className="text-2xl font-black uppercase">
							Relatório de Estoque (Pedidos) - {selectedSessionId === "atual" ? "Atual Real" : "Projetado"} - {new Date().toLocaleDateString("pt-BR")}
						</h1>
					</div>

					{/* Actions Bar: Filter, Select & Print */}
					<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 md:gap-4 print:hidden mb-6">
						<div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 md:gap-4 flex-1 min-w-0">
							{/* Dropdown Select */}
							<div className="flex flex-col gap-1 w-full sm:w-auto min-w-0 sm:min-w-[260px]">
								<span className="text-[0.75rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Estoque após Reposicionamento</span>
								<div className="relative group">
									<select
										value={selectedSessionId}
										onChange={(e) => setSelectedSessionId(e.target.value)}
										className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 md:py-3 pl-4 pr-10 text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm">
										<option value="atual">Estoque Atual Real</option>
										{sessions.map((s) => (
											<option key={s.id || s.sessionId} value={s.sessionId || s.id}>
												{formatHistoryLabel(s.timestamp.toDate())}
											</option>
										))}
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

						<div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
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
										<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											SABOR
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7rem] md:min-w-[9rem]">
											QUANTIDADE ATUAL
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[6.5rem] md:min-w-[8.5rem]">
											DESEJÁVEL
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7rem] md:min-w-[9.5rem]">
											DIFERENÇA
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[8rem] md:min-w-[11rem]">
											PACOTES A PEDIR
										</th>
									</tr>
								</thead>
								<tbody>
									{sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
										.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const totalQty = allData.reduce((sum, store) => sum + (store.stock[itemKey] || 0), 0);
											const totalOpen = allData.reduce((sum, store) => {
												const openVal = store.isUnits?.[itemKey];
												const count = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
												return sum + count;
											}, 0);
											const desiredQty = desiredData[itemKey] || 0;
											const diff = totalQty - desiredQty;
											const hasDesired = desiredQty > 0;

											const boxSize = boxSizes[itemKey] || 0;
											let boxMessageNode = null;

											if (hasDesired && boxSize > 0) {
												const absDiff = Math.abs(diff);
												// Sempre arredonda para cima o número de caixas inteiras necessárias
												const boxesCount = Math.ceil(absDiff / boxSize);
												const totalOrderedPackages = boxesCount * boxSize;
												const caixasLabel = boxesCount === 1 ? "Caixa" : "Caixas";
												const pacotesLabel = totalOrderedPackages === 1 ? "Pacote" : "Pacotes";
												
												if (diff < 0) {
													boxMessageNode = (
														<div className="flex flex-col items-center">
															<span className="text-base md:text-xl font-black text-slate-800 dark:text-slate-200">
																{" "}
																<span className="text-rose-600 dark:text-rose-400 font-black">
																	{totalOrderedPackages}
																</span>{" "}
																{pacotesLabel} ({boxesCount} {caixasLabel})
															</span>
														</div>
													);
												} else {
													boxMessageNode = (
														<div className="flex flex-col items-center">
															<span className="text-base md:text-xl font-black text-slate-800 dark:text-slate-200">
																{" "}
																<span className="text-blue-600 dark:text-blue-400 font-black">
																	0
																</span>{" "}
																Pacotes (acima da meta)
															</span>
														</div>
													);
												}
											} else if (hasDesired && diff >= 0) {
												boxMessageNode = (
													<div className="flex flex-col items-center">
														<span className="text-base md:text-xl font-black text-slate-800 dark:text-slate-200">
															{" "}
															<span className="text-blue-600 dark:text-blue-400 font-black">
																0
															</span>{" "}
															Pacotes (acima da meta)
														</span>
													</div>
												);
											}

											return (
												<tr
													key={key}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase">
														{label}
													</td>
													<td className="p-3 md:p-6 border-l border-r border-slate-100 dark:border-slate-800 text-center bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
														<div className="flex justify-center items-center gap-1">
															<span
																className={`text-base md:text-2xl font-black ${
																	totalQty === 0 && (totalOpen === 0 || hideOpen)
																		? "text-slate-300 dark:text-slate-400"
																		: "text-slate-900 dark:text-slate-100"
																}`}>
																{totalQty}
															</span>
															{!hideOpen && totalOpen > 0 && (
																<span className="text-xs md:text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
																	{totalQty > 0 ? `+ ${totalOpen} ab` : `${totalOpen} ab`}
																</span>
															)}
														</div>
													</td>
													<td className="p-3 md:p-6 text-center border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
														{hasDesired ? (
															<span className="text-base md:text-2xl font-black text-slate-800 dark:text-slate-200">
																{desiredQty}
															</span>
														) : (
															<span className="text-slate-300 dark:text-slate-600 font-black text-lg">-</span>
														)}
													</td>
													<td className="p-3 md:p-6 text-center border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
														{hasDesired ? (
															<div className="flex flex-col items-center justify-center">
																{diff < 0 ? (
																	<span className="px-2.5 md:px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-black whitespace-nowrap text-sm md:text-lg border border-rose-100 dark:border-rose-900/50 shadow-sm">
																		Faltando {Math.abs(diff)}
																	</span>
																) : diff > 0 ? (
																	<span className="px-2.5 md:px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-black whitespace-nowrap text-sm md:text-lg border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
																		Sobrando {diff}
																	</span>
																) : (
																	<span className="px-2.5 md:px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-black whitespace-nowrap text-sm md:text-lg border border-blue-100 dark:border-blue-900/50 shadow-sm">
																		Ideal
																	</span>
																)}
															</div>
														) : (
															<span className="text-slate-300 dark:text-slate-600 font-black text-lg">-</span>
														)}
													</td>
													<td className="p-3 md:p-6 text-center bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors">
														{boxMessageNode ? (
															boxMessageNode
														) : (
															<span className="text-slate-300 dark:text-slate-600 font-bold text-xs md:text-sm">
																{boxSize === 0 && hasDesired ? "(Configurar cx nas metas)" : "-"}
															</span>
														)}
													</td>
												</tr>
											);
										})}
								</tbody>
								{(() => {
									const filteredEntries = sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()));

									let totalBoxesToOrder = 0;
									let totalPackagesToOrder = 0;

									filteredEntries.forEach(([key]) => {
										const itemKey = key as keyof StockData;
										const totalQty = allData.reduce((sum, store) => sum + (store.stock[itemKey] || 0), 0);
										const desiredQty = desiredData[itemKey] || 0;
										const diff = totalQty - desiredQty;
										const boxSize = boxSizes[itemKey] || 0;

										if (desiredQty > 0 && boxSize > 0 && diff < 0) {
											const boxesCount = Math.ceil(Math.abs(diff) / boxSize);
											totalBoxesToOrder += boxesCount;
											totalPackagesToOrder += boxesCount * boxSize;
										}
									});

									const totalCaixasLabel = totalBoxesToOrder === 1 ? "Caixa" : "Caixas";
									const totalPacotesLabel = totalPackagesToOrder === 1 ? "pacote" : "pacotes";

									return (
										<tfoot>
											<tr className="bg-slate-100/80 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-600 font-black">
												<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-800 dark:text-slate-100 uppercase">
													TOTAL												</td>
												<td className="p-3 md:p-6 border-l border-r border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500">
													-
												</td>
												<td className="p-3 md:p-6 border-r border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500">
													-
												</td>
												<td className="p-3 md:p-6 border-r border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500">
													-
												</td>
												<td className="p-3 md:p-6 text-center">
													{totalBoxesToOrder > 0 ? (
														<div className="flex flex-col items-center">
															<span className="text-base md:text-xl font-black text-slate-800 dark:text-slate-200">
																{" "}
																<span className="text-rose-600 dark:text-rose-400 font-black">
																	{totalBoxesToOrder}
																</span>{" "}
																{totalCaixasLabel} ({totalPackagesToOrder} {totalPacotesLabel})
															</span>
														</div>
													) : (
														<div className="flex flex-col items-center">
															<span className="text-base md:text-xl font-black text-slate-800 dark:text-slate-200">
																{" "}
																<span className="text-blue-600 dark:text-blue-400 font-black">
																	0
																</span>{" "}
																caixas (acima da meta)
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
				</>
			) : activeSubTab === "valorPedido" ? (
				// Order Value Calculation View
				<div className="space-y-6">
					{(() => {
						// Lista de sabores sem sorvetes
						const cookieEntries = sortStockEntries(Object.entries(STOCK_LABELS))
							.filter(([key]) => key !== "sorveteCaixa" && key !== "sorvetePote");

						// Cálculos totais
						let totalPackages = 0;
						let baseTotalValue = 0;

						cookieEntries.forEach(([key]) => {
							const itemKey = key as keyof StockData;
							const suggested = getSuggestedOrderPackages(itemKey);
							const qty = customOrderPackages[itemKey] !== undefined ? (customOrderPackages[itemKey] || 0) : suggested;
							const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
							
							totalPackages += qty;
							baseTotalValue += qty * pricePerPkg;
						});

						const taxRate = 0.08;
						const taxValue = baseTotalValue * taxRate;
						const finalTotalValue = baseTotalValue * 1.08; // Multiplicado por 1.08 conforme solicitado

						const hasCustomModifications = cookieEntries.some(([key]) => {
							const itemKey = key as keyof StockData;
							const suggested = getSuggestedOrderPackages(itemKey);
							const current = customOrderPackages[itemKey] !== undefined ? (customOrderPackages[itemKey] || 0) : suggested;
							return current !== suggested;
						});

						const handleCopyOrderSummary = () => {
							let text = `*RESUMO DO PEDIDO DE ESTOQUE*\n`;
							text += `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n`;
							text += `*ITENS A PEDIR:*\n`;

							let itemsCount = 0;
							cookieEntries.forEach(([key, label]) => {
								const itemKey = key as keyof StockData;
								const suggested = getSuggestedOrderPackages(itemKey);
								const qty = customOrderPackages[itemKey] !== undefined ? (customOrderPackages[itemKey] || 0) : suggested;
								const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
								const totalItem = qty * pricePerPkg;

								if (qty > 0) {
									itemsCount++;
									text += `• ${label}: *${qty} ${qty === 1 ? "pacote" : "pacotes"}* (R$ ${totalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})\n`;
								}
							});

							if (itemsCount === 0) {
								text += `_Nenhum item adicionado ao pedido._\n`;
							}

							text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
							text += `*Total de Pacotes:* ${totalPackages} pacotes\n`;
							text += `*Subtotal:* R$ ${baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							text += `*Impostos Estimados (+8%):* R$ ${taxValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							text += `*VALOR TOTAL ESTIMADO:* R$ ${finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

							navigator.clipboard.writeText(text);
							setCopiedSummary(true);
							setTimeout(() => setCopiedSummary(false), 2500);
						};

						return (
							<>
								{/* Summary Cards */}
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
									<div className="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
										<div>
											<span className="text-[0.7rem] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
												Total de Pacotes
											</span>
											<span className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
												{totalPackages} <span className="text-xs font-bold text-slate-400">pacotes</span>
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
												R$ {baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
												+ R$ {taxValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
											</span>
										</div>
										<div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
											<Calculator size={22} />
										</div>
									</div>

									<div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 md:p-5 rounded-2xl md:rounded-3xl text-white shadow-lg shadow-emerald-600/20 flex items-center justify-between">
										<div>
											<span className="text-[0.7rem] md:text-xs font-black text-emerald-100 uppercase tracking-wider block">
												Valor Final Estimado (1.08x)
											</span>
											<span className="text-xl md:text-2xl font-black text-white mt-0.5 block">
												R$ {finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
											</span>
										</div>
										<div className="p-3 rounded-2xl bg-white/20 text-white">
											<ShoppingCart size={22} />
										</div>
									</div>
								</div>

								{/* Actions Bar & Botão Topo: Gerar Resumo */}
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

									{hasCustomModifications && (
										<div className="flex items-center gap-2 sm:gap-3 justify-end flex-wrap sm:flex-nowrap">
											<button
												onClick={resetCustomOrderToSuggested}
												className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-xs md:text-sm"
												title="Redefinir todas as quantidades para o sugerido pelo comparativo do app">
												<RefreshCw size={16} />
												RESTAURAR SUGERIDO
											</button>
										</div>
									)}
										{/* Botão Topo: Gerar Resumo Centralizado */}
									<div className="flex justify-center items-center py-1">
									<button
										onClick={() => setShowSummary(true)}
										className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-12 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-blue-500/20 dark:shadow-none hover:shadow-blue-500/30 hover:scale-[1.02] transition-all cursor-pointer uppercase tracking-widest">
										<FileText size={16} />
										Gerar Resumo
									</button>
								</div>
								</div>

								
								{/* Table */}
								<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
									<div className="overflow-x-auto">
										<table className="w-full border-collapse">
											<thead>
												<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
													<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
														SABOR / ITEM
													</th>
													<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[6.5rem] md:min-w-[9.5rem]">
														VALOR / PCT
													</th>
													<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
														PACOTES A PEDIR
													</th>
													<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
														SUBTOTAL (R$)
													</th>
													<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
														COM IMPOSTOS (1.08x)
													</th>
												</tr>
											</thead>
											<tbody>
												{cookieEntries
													.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
													.map(([key, label]) => {
														const itemKey = key as keyof StockData;
														const suggested = getSuggestedOrderPackages(itemKey);
														const qty = customOrderPackages[itemKey] !== undefined ? customOrderPackages[itemKey] : suggested;
														const currentQty = qty || 0;
														const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
														const subtotalItem = currentQty * pricePerPkg;
														const finalItem = subtotalItem * 1.08;
														const isModified = customOrderPackages[itemKey] !== undefined && customOrderPackages[itemKey] !== suggested;

														// Determina a estilização do input conforme sugerido / a mais / a menos
														let inputColorClasses = "border-emerald-500 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500/20";
														if (currentQty > suggested) {
															// A mais: azul
															inputColorClasses = "border-blue-500 dark:border-blue-500 text-blue-600 dark:text-blue-400 focus:ring-blue-500/20";
														} else if (currentQty < suggested) {
															// A menos: vermelho
															inputColorClasses = "border-rose-500 dark:border-rose-500 text-rose-600 dark:text-rose-400 focus:ring-rose-500/20";
														}

														return (
															<tr
																key={key}
																className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
																<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase">
																	{label}
																</td>
																<td className="p-3 md:p-6 text-center border-l border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs md:text-base">
																	R$ {pricePerPkg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																</td>
																<td className="p-3 md:p-6 text-center border-l border-r border-slate-100 dark:border-slate-800">
																	<div className="flex flex-col items-center justify-center gap-1">
																		<div className="flex items-center justify-center gap-1.5">
																			<button
																				type="button"
																				onClick={() => stepCustomPackage(itemKey, -1)}
																				disabled={currentQty <= 0}
																				className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm active:scale-95"
																				title={`Diminuir 1 caixa (-${boxSizes[itemKey] || 1} pcts)`}>
																				<Minus size={14} />
																			</button>

																			<input
																				type="number"
																				min="0"
																				step={boxSizes[itemKey] || 1}
																				value={currentQty === 0 ? "" : currentQty}
																				placeholder="0"
																				onChange={(e) => handleCustomPackageChange(itemKey, e.target.value)}
																				onFocus={(e) => e.target.select()}
																				onClick={(e) => e.currentTarget.select()}
																				className={`w-18 md:w-24 bg-white dark:bg-slate-800 border-2 rounded-xl py-1.5 md:py-2 px-2 md:px-3 text-center text-sm md:text-lg font-black transition-all cursor-pointer focus:outline-none focus:ring-2 ${inputColorClasses}`}
																			/>

																			<button
																				type="button"
																				onClick={() => stepCustomPackage(itemKey, 1)}
																				className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm active:scale-95"
																				title={`Aumentar 1 caixa (+${boxSizes[itemKey] || 1} pcts)`}>
																				<Plus size={14} />
																			</button>
																		</div>
																		<div className="flex items-center gap-1.5 text-[0.68rem] md:text-sm">
																			<span className="font-bold text-slate-400 dark:text-slate-500">
																				{boxSizes[itemKey] ? `${boxSizes[itemKey]} pacotes` : "pacote"}
																			</span>
																			{isModified && (
																				<span className={`font-bold ${currentQty > suggested ? "text-blue-500" : "text-rose-500"}`}>
																					• Sugerido: {suggested}
																				</span>
																			)}
																		</div>
																	</div>
																</td>
																<td className="p-3 md:p-6 text-center border-r border-slate-100 dark:border-slate-800">
																	<span className="text-sm md:text-lg font-black text-slate-700 dark:text-slate-300">
																		R$ {subtotalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																	</span>
																</td>
																<td className="p-3 md:p-6 text-center">
																	<span className={`text-base md:text-xl font-black ${
																		finalItem > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-600"
																	}`}>
																		R$ {finalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																	</span>
																</td>
															</tr>
														);
													})}
											</tbody>
											<tfoot>
												<tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-600 font-black">
													<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-800 dark:text-slate-100 uppercase">
														TOTAL DO PEDIDO
													</td>
													<td className="p-3 md:p-6 border-l border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500 text-xs md:text-sm">
														-
													</td>
													<td className="p-3 md:p-6 border-l border-r border-slate-200 dark:border-slate-700 text-center">
														<span className="text-base md:text-2xl font-black text-rose-600 dark:text-rose-400">
															{totalPackages}
														</span>{" "}
														<span className="text-xs md:text-sm font-bold text-slate-600 dark:text-slate-300">
															pacotes
														</span>
													</td>
													<td className="p-3 md:p-6 border-r border-slate-200 dark:border-slate-700 text-center">
														<span className="text-sm md:text-xl font-black text-slate-700 dark:text-slate-200">
															R$ {baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
														</span>
													</td>
													<td className="p-3 md:p-6 text-center">
														<span className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400">
															R$ {finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
														</span>
													</td>
												</tr>
											</tfoot>
										</table>
									</div>
								</div>

								{/* Botão Rodapé: Gerar Resumo Centralizado */}
								<div className="flex justify-center items-center py-3">
									<button
										onClick={() => setShowSummary(true)}
										className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white px-8 md:px-12 py-3.5 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-blue-500/20 dark:shadow-none hover:shadow-blue-500/30 hover:scale-[1.02] transition-all cursor-pointer uppercase tracking-widest">
										<FileText size={16} />
										Gerar Resumo
									</button>
								</div>
							</>
						);
					})()}
				</div>
			) : activeSubTab === "desejavel" ? (
				// Desired Stock Configuration View
				<div className="space-y-6">
					{/* Verificação de alterações nas metas ou caixas */}
					{(() => {
						const hasStockChanges = Object.keys(STOCK_LABELS).some((k) => {
							const key = k as keyof StockData;
							return (localDesired[key] ?? 0) !== (desiredData[key] ?? 0);
						});
						const hasBoxChanges = Object.keys(STOCK_LABELS).some((k) => {
							const key = k as keyof StockData;
							return (localBoxSizes[key] ?? 0) !== (boxSizes[key] ?? 0);
						});
						const hasChanges = hasStockChanges || hasBoxChanges;

						return (
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
								<div className="relative flex-1 max-w-full sm:max-w-md group">
									<Search
										size={18}
										className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
									/>
									<input
										type="text"
										placeholder="Filtrar por pacote/sabor..."
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
										SALVAR METAS
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
										<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											PACOTES
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											QUANTIDADE DESEJÁVEL (PACOTES)
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											PACOTES POR CAIXA
										</th>
									</tr>
								</thead>
								<tbody>
									{sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
										.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const desiredVal = localDesired[itemKey] ?? "";
											const boxVal = localBoxSizes[itemKey] ?? "";

											return (
												<tr
													key={key}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase">
														{label}
													</td>
													<td className="p-3 md:p-6 border-l border-r border-slate-100 dark:border-slate-800 text-center">
														<div className="flex justify-center">
															<input
																type="number"
																min="0"
																value={desiredVal}
																placeholder="0"
																onChange={(e) => handleLocalDesiredChange(itemKey, e.target.value)}
																onFocus={(e) => e.target.select()}
																onClick={(e) => e.currentTarget.select()}
																className="w-24 md:w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 md:py-2 px-2 md:px-3 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
															/>
														</div>
													</td>
													<td className="p-3 md:p-6 text-center">
														<div className="flex justify-center items-center gap-2">
															<div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 shrink-0">
																<Package size={18} />
															</div>
															<input
																type="number"
																min="0"
																value={boxVal}
																placeholder="Qtd/cx"
																onChange={(e) => handleLocalBoxSizeChange(itemKey, e.target.value)}
																onFocus={(e) => e.target.select()}
																onClick={(e) => e.currentTarget.select()}
																className="w-20 md:w-28 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 md:py-2 px-2 md:px-3 text-center text-sm md:text-base font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer"
																title="Quantidade de sacos/pacotes por caixa"
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
			) : (
				// Package Prices Configuration View
				<div className="space-y-6">
					{/* Verificação de alterações nos valores por pacote */}
					{(() => {
						const hasChanges = Object.keys(STOCK_LABELS)
							.filter((key) => key !== "sorveteCaixa" && key !== "sorvetePote")
							.some((k) => {
								const key = k as keyof StockData;
								return (localPackagePrices[key] ?? DEFAULT_PACKAGE_PRICES[key] ?? 0) !== (packagePrices[key] ?? DEFAULT_PACKAGE_PRICES[key] ?? 0);
							});

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

								<div className="relative" title={!hasChanges && !savingPackagePrices ? "Faça alterações para salvar" : ""}>
									<button
										onClick={savePackagePrices}
										disabled={!hasChanges || savingPackagePrices}
										className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black transition-all text-xs md:text-sm ${
											hasChanges && !savingPackagePrices
												? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-400/40 animate-pulse cursor-pointer scale-105"
												: "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70"
										}`}>
										{savingPackagePrices ? (
											<RefreshCw className="animate-spin" size={18} />
										) : (
											<Save size={18} />
										)}
										SALVAR VALORES
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
										<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											SABOR / ITEM
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											VALOR POR PACOTE (R$) <span className="text-[0.65rem] md:text-xs font-normal text-slate-400 dark:text-slate-500 block">(24 unidades)</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([key, label]) => key !== "sorveteCaixa" && key !== "sorvetePote" && label.toLowerCase().includes(searchTerm.toLowerCase()))
										.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const priceVal = localPackagePrices[itemKey] !== undefined ? localPackagePrices[itemKey] : (DEFAULT_PACKAGE_PRICES[itemKey] ?? "");

											return (
												<tr
													key={key}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase">
														{label}
													</td>
													<td className="p-3 md:p-6 text-center">
														<div className="flex justify-center items-center gap-2">
															<span className="text-sm md:text-lg font-black text-slate-400 dark:text-slate-500">
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
																className="w-28 md:w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 md:py-2 px-2 md:px-3 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
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
							.filter(([key]) => key !== "sorveteCaixa" && key !== "sorvetePote");

						let totalPackages = 0;
						let baseTotalValue = 0;
						const activeItems: { label: string; qty: number; boxesCount: number; boxSize: number; totalItem: number }[] = [];

						cookieEntries.forEach(([key, label]) => {
							const itemKey = key as keyof StockData;
							const suggested = getSuggestedOrderPackages(itemKey);
							const qty = customOrderPackages[itemKey] !== undefined ? (customOrderPackages[itemKey] || 0) : suggested;
							const pricePerPkg = packagePrices[itemKey] ?? DEFAULT_PACKAGE_PRICES[itemKey] ?? 0;
							const totalItem = qty * pricePerPkg;
							const boxSize = boxSizes[itemKey] || 1;
							const boxesCount = Math.ceil(qty / boxSize);

							if (qty > 0) {
								totalPackages += qty;
								baseTotalValue += totalItem;
								activeItems.push({
									label,
									qty,
									boxesCount,
									boxSize,
									totalItem,
								});
							}
						});

						const taxRate = 0.08;
						const taxValue = baseTotalValue * taxRate;
						const finalTotalValue = baseTotalValue * 1.08;

						const handleWhatsApp = async () => {
							if (activeItems.length === 0) return;

							let text = `*RESUMO DO PEDIDO DE ESTOQUE*\n`;
							text += `Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n\n`;
							text += `*ITENS A PEDIR:*\n`;

							activeItems.forEach((item) => {
								const caixasLabel = item.boxesCount === 1 ? "cx" : "cxs";
								text += `• ${item.label}: *${item.qty} ${item.qty === 1 ? "pacote" : "pacotes"}* (${item.boxesCount} ${caixasLabel}) - R$ ${item.totalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							});

							text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
							text += `*Total de Pacotes:* ${totalPackages} pacotes\n`;
							text += `*Subtotal:* R$ ${baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							text += `*Impostos Estimados (+8%):* R$ ${taxValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
							text += `*VALOR TOTAL ESTIMADO:* R$ ${finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

						return (
							<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
								<div className="p-3.5 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center print:hidden whitespace-nowrap">
									<div>
										<h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight text-center uppercase">
											Resumo do Pedido de Estoque - {new Date().toLocaleDateString("pt-BR")}
										</h2>
									</div>
								</div>

								<div className="p-3.5 md:p-6 overflow-y-auto custom-scrollbar flex-1 print:overflow-visible print:p-0">
									{activeItems.length > 0 ? (
										<div className="space-y-4 print:space-y-6 w-full flex flex-col items-stretch">
											{/* Visualização em tela: Cards com itens do pedido */}
											<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full print:hidden">
												{activeItems.map((item, idx) => (
													<div
														key={idx}
														className="p-3.5 md:p-4 bg-slate-50/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
														<div>
															<div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700">
																<span className="text-xs md:text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight truncate">
																	{item.label}
																</span>
																<span className="text-xs font-black text-blue-600 dark:text-blue-400 shrink-0">
																	{item.boxesCount} {item.boxesCount === 1 ? "cx" : "cxs"}
																</span>
															</div>
															<div className="flex items-center justify-between text-xs md:text-sm">
																<span className="text-slate-500 dark:text-slate-400 font-bold">
																	Quantidade:
																</span>
																<strong className="font-black text-slate-900 dark:text-white">
																	{item.qty} {item.qty === 1 ? "pct" : "pcts"}
																</strong>
															</div>
															<div className="flex items-center justify-between text-xs md:text-sm mt-1">
																<span className="text-slate-500 dark:text-slate-400 font-bold">
																	Subtotal:
																</span>
																<span className="font-black text-slate-700 dark:text-slate-300">
																	R$ {item.totalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																</span>
															</div>
														</div>
													</div>
												))}
											</div>

											{/* Resumo Financeiro no Modal */}
											<div className="bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 print:hidden">
												<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
													<div>
														<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
															Total de Pacotes
														</span>
														<span className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">
															{totalPackages} pacotes
														</span>
													</div>
													<div>
														<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
															Subtotal
														</span>
														<span className="text-lg md:text-xl font-black text-slate-700 dark:text-slate-300">
															R$ {baseTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
														</span>
													</div>
													<div>
														<span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
															Total Estimado (+8%)
														</span>
														<span className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400">
															R$ {finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
														</span>
													</div>
												</div>
											</div>

											{/* Visão de Impressão */}
											<div className="hidden print:block w-full text-black">
												<table className="w-full border-collapse">
													<thead>
														<tr className="border-b-2 border-black">
															<th className="p-2 text-left text-sm font-black uppercase">Sabor / Item</th>
															<th className="p-2 text-center text-sm font-black uppercase">Pacotes</th>
															<th className="p-2 text-center text-sm font-black uppercase">Caixas</th>
															<th className="p-2 text-right text-sm font-black uppercase">Subtotal (R$)</th>
														</tr>
													</thead>
													<tbody>
														{activeItems.map((item, i) => (
															<tr key={i} className="border-b border-slate-300">
																<td className="p-2 font-bold text-sm">{item.label}</td>
																<td className="p-2 text-center font-black text-sm">{item.qty}</td>
																<td className="p-2 text-center font-bold text-sm">{item.boxesCount} ({item.boxSize} p/ cx)</td>
																<td className="p-2 text-right font-black text-sm">
																	R$ {item.totalItem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
																</td>
															</tr>
														))}
													</tbody>
													<tfoot>
														<tr className="border-t-2 border-black font-black">
															<td className="p-2 text-left uppercase">TOTAL</td>
															<td className="p-2 text-center">{totalPackages} pcts</td>
															<td className="p-2 text-center">-</td>
															<td className="p-2 text-right">
																R$ {finalTotalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
															</td>
														</tr>
													</tfoot>
												</table>
											</div>
										</div>
									) : (
										<div className="text-center py-10">
											<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
												Nenhum item com quantidade a pedir selecionado.
											</p>
										</div>
									)}
								</div>

								<div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-3 transition-colors print:hidden">
									<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-lg">
										<button
											onClick={handleWhatsApp}
											disabled={activeItems.length === 0}
											className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest shadow-md shadow-emerald-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
											Enviar no WhatsApp
										</button>
										<button
											onClick={() => window.print()}
											disabled={activeItems.length === 0}
											className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest shadow-md shadow-blue-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
											Imprimir
										</button>
									</div>
									<button
										onClick={() => setShowSummary(false)}
										className="w-full sm:w-auto min-w-[140px] px-6 py-2.5 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
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


