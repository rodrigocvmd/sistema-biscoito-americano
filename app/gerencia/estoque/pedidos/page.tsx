"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, orderBy, where, limit } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate } from "@/types";
import { RefreshCw, ArrowLeftRight, Printer, Search, Eye, EyeOff, ChevronDown } from "lucide-react";

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

export default function EstoquePedidosPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [realCurrentData, setRealCurrentData] = useState<FullStoreData[]>([]);
	const [sessions, setSessions] = useState<RepositionSnapshotDoc[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string>("atual");
	const [searchTerm, setSearchTerm] = useState("");
	const [hideOpen, setHideOpen] = useState(false);

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
	};

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
				
				// Filter and sort in-memory to avoid needing a composite Firebase index
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

	// 3. Update table data based on selection
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
				const storeIds = Object.keys(STORE_NAMES) as StoreId[];
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
						margin: 8mm;
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
						padding: 4mm !important;
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
						width: 100% !important;
						border-collapse: collapse !important;
						table-layout: auto;
						margin: 0 auto !important;
						border: 0.5pt solid #ccc !important;
					}
					table, tr, th, td {
						border: 0.5pt solid #ccc !important;
					}
					th, td {
						padding: 4px 8px !important;
						font-size: 11.5pt !important;
						color: black !important;
						background: transparent !important;
						line-height: 1.15 !important;
					}
					th {
						text-transform: uppercase !important;
						background-color: white !important;
						font-weight: bold !important;
					}
					.text-2xl, .text-lg, h1 {
						font-size: 13pt !important;
						font-weight: bold !important;
					}
					h1 {
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
					.bg-blue-50, .dark\\:bg-blue-900\\/30, .bg-slate-50, .dark\\:bg-slate-800, .bg-white {
						background: transparent !important;
					}
					/* Layout adjustments to save space */
					.p-6 { padding: 2px !important; }
					.gap-2, .gap-9 { gap: 2px !important; }
					tr {
						page-break-inside: avoid;
					}
				}
			`,
				}}
			/>

			<div className="hidden print:block">
				<h1 className="text-2xl font-black uppercase">
					Relatório de Estoque (Pedidos) - {selectedSessionId === "atual" ? "Atual Real" : "Projetado"} - {new Date().toLocaleDateString("pt-BR")}
				</h1>
			</div>

			{/* Actions Bar: Filter, Select & Print */}
			<div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
				<div className="flex flex-wrap items-center gap-4 flex-1 min-w-[18.75rem]">
					{/* Dropdown Select */}
					<div className="flex flex-col gap-1 min-w-[260px]">
						<span className="text-[0.75rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Estoque após Reposicionamento</span>
						<div className="relative group">
							<select
								value={selectedSessionId}
								onChange={(e) => setSelectedSessionId(e.target.value)}
								className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-4 pr-10 text-sm font-black text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm">
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
					<div className="flex flex-col gap-1 flex-1 min-w-[200px]">
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
								className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
							/>
						</div>
					</div>
				</div>

				<div className="flex items-end gap-3 self-end">
					<button
						onClick={() => setHideOpen(!hideOpen)}
						className="flex items-center gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 px-6 py-3 rounded-2xl font-black shadow-sm transition-all cursor-pointer text-sm">
						{hideOpen ? <Eye size={18} /> : <EyeOff size={18} />}
						{hideOpen ? "MOSTRAR ABERTOS" : "OCULTAR ABERTOS"}
					</button>

					<button
						onClick={() => window.print()}
						className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 dark:shadow-none transition-all cursor-pointer text-sm">
						<Printer size={18} />
						IMPRIMIR TABELA
					</button>
				</div>
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
								<th className="p-6 text-left text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 min-w-[11.25rem]">
									<div className="flex items-center gap-9">
										ITEM
										<button
											onClick={rotateStores}
											className="cursor-pointer p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all shadow-sm print:hidden"
											title="Mover primeira loja para o final">
											<ArrowLeftRight size={22} />
										</button>
									</div>
								</th>
								{allData.map((store) => (
									<th
										key={store.id}
										className="p-6 text-center text-[0.6875rem] font-black text-blue-600 dark:text-blue-400 tracking-widest border-l border-slate-200 dark:border-slate-700 min-w-[8.75rem]">
										<div className="flex flex-col items-center gap-2">
											<span className="text-[0.87rem] font-extrabold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 whitespace-nowrap">
												{formatDate(store.lastStockUpdate)}
											</span>
											<span className="leading-tight text-2xl">{store.name}</span>
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...(Object.entries(STOCK_LABELS) as [keyof StockData, string][])]
								.sort((a, b) => a[1].localeCompare(b[1]))
								.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
								.map(([key, label]) => {
									return (
										<tr
											key={key}
											className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
											<td className="p-6 text-xl font-black text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 z-10 border-r border-slate-50 dark:border-slate-800 transition-colors uppercase">
												{label}
											</td>
											{allData.map((store) => {
												const qty = store.stock[key] || 0;
												const openVal = store.isUnits?.[key];
												const openCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
												return (
													<td
														key={store.id}
														className="p-6 text-center border-l border-slate-100 dark:border-slate-800">
														<div className="flex justify-center items-center">
															{qty > 0 || openCount === 0 || hideOpen ? (
																<span
																	className={`pr-2 text-2xl font-black ${
																		qty === 0 && (openCount === 0 || hideOpen)
																			? "text-slate-300 dark:text-slate-400"
																			: "text-slate-900 dark:text-slate-100"
																	}`}>
																	{qty}
																	{qty > 0 && selectedSessionId !== "atual" && (
																		<span className="text-xs text-blue-500 font-bold ml-1 print:hidden" title="Estoque projetado">(proj)</span>
																	)}
																</span>
															) : null}
															{!hideOpen && openCount > 0 && (
																<span className="text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
																	{qty > 0 ? `+ ${openCount} aberto` : `${openCount} aberto`}
																</span>
															)}
														</div>
													</td>
												);
											})}
										</tr>
									);
								})}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
