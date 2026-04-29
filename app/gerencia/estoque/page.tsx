"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate } from "@/types";
import { RefreshCw, ArrowLeftRight } from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, boolean>>;
}

export default function EstoquePage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [tableSort, setTableSort] = useState<"default" | "name">("default");

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
				<RefreshCw className="animate-spin text-blue-600 mb-4" size={48} />
				<p className="text-slate-500 font-bold">Carregando estoque...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Actions Bar: Sorting */}
			<div className="flex items-center justify-between gap-4">
				<div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 w-fit">
					<span className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">
						Itens:
					</span>
					<div className="flex bg-slate-100 p-1 rounded-xl gap-1">
						<button
							onClick={() => setTableSort("default")}
							className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all ${tableSort === "default" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
							Padrão
						</button>
						<button
							onClick={() => setTableSort("name")}
							className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all ${tableSort === "name" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
							A-Z
						</button>
					</div>
				</div>
			</div>

			<div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse">
						<thead>
							<tr className="bg-slate-50 border-b border-slate-200">
								<th className="p-6 text-left text-[15px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-20 min-w-[180px]">
									<div className="flex items-center gap-9">
										ITEM
										<button
											onClick={rotateStores}
											className="cursor-pointer p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
											title="Mover primeira loja para o final">
											<ArrowLeftRight size={16} />
										</button>
									</div>
								</th>
								{allData.map((store) => (
									<th
										key={store.id}
										className="p-6 text-center text-[11px] font-black text-blue-600 uppercase tracking-widest border-l border-slate-200 min-w-[140px]">
										<div className="flex flex-col items-center gap-2">
											<span className="leading-tight text-lg">{store.name}</span>
											<span className="text-[13px] font-extrabold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-100 whitespace-nowrap">
												{formatDate(store.lastStockUpdate)}
											</span>
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...(Object.entries(STOCK_LABELS) as [keyof StockData, string][])]
								.sort((a, b) => (tableSort === "name" ? a[1].localeCompare(b[1]) : 0))
								.map(([key, label]) => {
									return (
										<tr
											key={key}
											className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
											<td className="p-6 text-sm font-black text-slate-600 uppercase sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-slate-50">
												{label}
											</td>
											{allData.map((store) => {
												const value = store.stock[key] || 0;
												const isUnit = store.isUnits?.[key] || false;
												return (
													<td
														key={store.id}
														className="p-6 text-center border-l border-slate-100">
														<div className="flex flex-col items-center">
															<span
																className={`text-2xl font-black ${
																	value === 0 
																		? "text-slate-400" 
																		: isUnit 
																			? "text-slate-500" 
																			: "text-slate-900"
																}`}>
																{value}
															</span>
															{value > 0 && isUnit && (
																<span className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1">
																	Unitários
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
		</div>
	);
}
