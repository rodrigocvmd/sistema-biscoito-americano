"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, limit, doc, setDoc } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, sortStockEntries } from "@/types";
import { RefreshCw, ArrowLeftRight, Printer, Search, Eye, EyeOff, ChevronDown, Save, FileText, Settings, Package } from "lucide-react";

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

export default function EstoquePedidosPage() {
	const [activeSubTab, setActiveSubTab] = useState<"comparativo" | "desejavel">("comparativo");
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

	const [savingDesired, setSavingDesired] = useState(false);

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

	// 3. Fetch desired stocks & box sizes (Global doc logic with store fallback sum if needed)
	useEffect(() => {
		const unsubscribeDesired = onSnapshot(collection(db, "desiredStocks"), (snapshot) => {
			let aggregatedStock: Partial<StockData> = {};
			let aggregatedBoxSizes: Partial<StockData> = {};
			const globalDoc = snapshot.docs.find((d) => d.id === "global");
			
			if (globalDoc) {
				const data = globalDoc.data();
				aggregatedStock = data.stock || {};
				aggregatedBoxSizes = data.boxSizes || {};
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
					onClick={() => setActiveSubTab("desejavel")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "desejavel"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<Settings size={16} />
					ESTOQUE DESEJÁVEL (METAS)
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
			) : (
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
			)}
		</>
	);
}


