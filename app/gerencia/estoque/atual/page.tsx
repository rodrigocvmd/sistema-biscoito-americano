"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, sortStockEntries } from "@/types";
import { RefreshCw, ArrowLeftRight, Printer, Search, Eye, EyeOff } from "lucide-react";

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
	const [hideOpen, setHideOpen] = useState(false);

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
		});

		return () => unsubscribeStores();
	}, []);

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
					.bg-blue-50, .dark\\:bg-blue-900\\/30, .bg-slate-50, .dark\\:bg-slate-800, .bg-white {
						background: transparent !important;
					}
					/* Layout adjustments to save space */
					.p-6 { padding: 2px 6px !important; }
					.gap-2, .gap-9 { gap: 2px !important; }
					th, td { min-width: 0 !important; width: auto !important; }
					th span, td span, td div, td th, .font-black, .font-extrabold, .font-bold { font-size: 8.5pt !important; font-weight: normal !important; }
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
							{sortStockEntries(Object.entries(STOCK_LABELS))
								.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
								.map(([key, label]) => {
									return (
										<tr
											key={key}
											className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
											<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 z-10 border-r border-slate-50 dark:border-slate-800 transition-colors uppercase">
												{label}
											</td>
											{allData.map((store) => {
												const qty = store.stock[key] || 0;
												const openVal = store.isUnits?.[key];
												const openCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
												return (
													<td
														key={store.id}
														className="p-3 md:p-6 text-center border-l border-slate-100 dark:border-slate-800">
														<div className="flex justify-center items-center">
															{qty > 0 || openCount === 0 || hideOpen ? (
																<span
																	className={`pr-1 md:pr-2 text-base md:text-2xl font-black ${
																		qty === 0 && (openCount === 0 || hideOpen)
																			? "text-slate-300 dark:text-slate-400"
																			: "text-slate-900 dark:text-slate-100"
																	}`}>
																	{qty}
																</span>
															) : null}
															{!hideOpen && openCount > 0 && (
																<span className="text-xs md:text-2xl font-black text-slate-400 dark:text-slate-500 whitespace-nowrap">
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
