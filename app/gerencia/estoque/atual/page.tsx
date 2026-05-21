"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate } from "@/types";
import { RefreshCw, ArrowLeftRight, Printer, Search } from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, boolean>>;
}

export default function EstoqueAtualPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [searchTerm, setSearchTerm] = useState("");

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
	};

	useEffect(() => {
		const storeIds = Object.keys(STORE_NAMES) as StoreId[];

		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			setAllData((currentData) => {
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
			<style dangerouslySetInnerHTML={{ __html: `
				@media print {
					@page {
						size: A4;
						margin: 10mm;
					}
					body {
						background: white !important;
						font-family: sans-serif;
					}
					main {
						padding: 0 !important;
						margin: 0 !important;
					}
					.bg-white {
						border: none !important;
						box-shadow: none !important;
					}
					table {
						width: 100% !important;
						border-collapse: collapse !important;
						table-layout: fixed;
					}
					th, td {
						border: 1px solid #e2e8f0 !important;
						padding: 4px 8px !important;
						font-size: 8px !important;
						word-break: break-word;
					}
					th {
						background-color: #f8fafc !important;
						-webkit-print-color-adjust: exact;
						color: #2563eb !important;
					}
					.text-2xl {
						font-size: 12px !important;
					}
					.p-6 {
						padding: 4px !important;
					}
					.gap-9 {
						gap: 0 !important;
					}
					.sticky {
						position: static !important;
					}
					.min-w-\[180px\], .min-w-\[140px\] {
						min-width: 0 !important;
					}
				}
			` }} />

			<div className="hidden print:block mb-6">
				<h1 className="text-2xl font-black text-blue-700 dark:text-blue-500 uppercase">Estoque Atual - {new Date().toLocaleDateString('pt-BR')}</h1>
			</div>

			{/* Actions Bar: Filter & Print */}
			<div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
				<div className="flex items-center gap-4 flex-1 min-w-[300px]">
					<div className="relative flex-1 group">
						<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
						<input
							type="text"
							placeholder="Filtrar por sabor..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
						/>
					</div>
				</div>

				<button
					onClick={() => window.print()}
					className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 dark:shadow-none transition-all cursor-pointer">
					<Printer size={20} />
					IMPRIMIR TABELA
				</button>
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
								<th className="p-6 text-left text-[15px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 min-w-[180px]">
									<div className="flex items-center gap-9">
										ITEM
										<button
											onClick={rotateStores}
											className="cursor-pointer p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white transition-all shadow-sm print:hidden"
											title="Mover primeira loja para o final">
											<ArrowLeftRight size={16} />
										</button>
									</div>
								</th>
								{allData.map((store) => (
									<th
										key={store.id}
										className="p-6 text-center text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 min-w-[140px]">
										<div className="flex flex-col items-center gap-2">
											<span className="leading-tight text-lg">{store.name}</span>
											<span className="text-[13px] font-extrabold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 whitespace-nowrap">
												{formatDate(store.lastStockUpdate)}
											</span>
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
											<td className="p-6 text-sm font-black text-slate-600 dark:text-slate-400 uppercase sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 z-10 border-r border-slate-50 dark:border-slate-800 transition-colors">
												{label}
											</td>
											{allData.map((store) => {
												const qty = store.stock[key] || 0;
												const hasOpen = store.isUnits?.[key] || false;
												return (
													<td
														key={store.id}
														className="p-6 text-center border-l border-slate-100 dark:border-slate-800">
														<div className="flex flex-col items-center">
															<span
																className={`text-2xl font-black ${
																	qty === 0 && !hasOpen
																		? "text-slate-300 dark:text-slate-700" 
																		: "text-slate-900 dark:text-slate-100"
																}`}>
																{qty}
															</span>
															{hasOpen && (
																<span className="text-[10px] font-black text-orange-500 uppercase whitespace-nowrap bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md mt-1">
																	+ 1 aberto
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
