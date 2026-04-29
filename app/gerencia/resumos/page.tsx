"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, collectionGroup } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, SupplyOrder, formatDate } from "@/types";
import { RefreshCw, Calendar, Package, Store } from "lucide-react";
import Link from "next/link";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, boolean>>;
	pendingOrders: SupplyOrder[];
}

export default function ResumosPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);

	useEffect(() => {
		const storeIds = Object.keys(STORE_NAMES) as StoreId[];

		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			const ordersQuery = query(
				collectionGroup(db, "supplyOrders"),
				where("status", "==", "pending"),
			);

			const unsubscribeOrders = onSnapshot(ordersQuery, (ordersSnapshot) => {
				const allOrders = ordersSnapshot.docs.map((doc) => ({
					id: doc.id,
					storeId: doc.ref.parent.parent?.id,
					...doc.data(),
				})) as (SupplyOrder & { storeId: string })[];

				setAllData((currentData) => {
					const newFullData = storeIds.map((id) => {
						const storeDoc = storesMap[id] || {};
						return {
							id,
							name: STORE_NAMES[id],
							lastStockUpdate: storeDoc.lastStockUpdate?.toDate() || null,
							stock: storeDoc.stock || {},
							isUnits: storeDoc.isUnits || {},
							pendingOrders: allOrders.filter((o) => o.storeId === id && !o.checkedByGerencia),
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

			return () => unsubscribeOrders();
		});

		return () => unsubscribeStores();
	}, []);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 mb-4" size={48} />
				<p className="text-slate-500 font-bold">Carregando resumos...</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
			{allData.map((store) => (
				<div
					key={store.id}
					className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
					<div className="p-8 border-b border-slate-100 bg-slate-50/50">
						<h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
							{store.name}
						</h3>
						<div className="flex items-center gap-2 mt-4">
							<Calendar size={18} className="text-slate-400" />
							<span className="text-md font-bold text-slate-400">
								Atualizado: {formatDate(store.lastStockUpdate)}
							</span>
						</div>
					</div>

					<div className="p-8 flex-1 space-y-8">
						{/* Insumos Pendentes Resumo */}
						<div>
							<h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-3">
								<Package size={18} /> Insumos Pendentes ({store.pendingOrders.length})
							</h4>
							{store.pendingOrders.length > 0 ? (
								<div className="space-y-3">
									{store.pendingOrders.map((order) => (
										<div
											key={order.id}
											className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
											<div className="flex flex-col">
												<span className="text-sm font-bold text-slate-700">
													{order.name}
												</span>
												<span className="text-xs font-bold text-slate-400 mt-0.5">
													{formatDate(order.createdAt?.toDate())}
												</span>
											</div>
										</div>
									))}
									<Link
										href="/gerencia/insumos"
										className="block w-full mt-6 text-xs font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest cursor-pointer text-center bg-emerald-50/50 py-3 rounded-xl hover:bg-emerald-50 transition-colors">
										Ir para Insumos do {store.name}
									</Link>
								</div>
							) : (
								<p className="text-sm text-slate-400 italic">Nenhum pedido pendente.</p>
							)}
						</div>

						{/* Estoque Resumo (Todos com Qtd > 0) */}
						<div>
							<h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
								Itens em Estoque
							</h4>
							<div className="grid grid-cols-2 gap-3">
								{Object.entries(store.stock)
									.filter(([_, qty]) => (qty as number) > 0)
									.map(([key, qty]) => (
										<div
											key={key}
											className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl text-xs">
											<span className="font-bold text-slate-500 uppercase truncate pr-3">
												{STOCK_LABELS[key as keyof StockData]}
											</span>
											<div className="flex items-center gap-1">
												<span className={`font-black ${
													(qty as number) === 0 
														? "text-slate-400" 
														: store.isUnits?.[key as keyof StockData] 
															? "text-slate-500" 
															: "text-slate-800"
												}`}>
													{qty as number}
												</span>
												{store.isUnits?.[key as keyof StockData] && (
													<span className="text-[8px] font-black text-red-600 uppercase">
														un.
													</span>
												)}
											</div>
										</div>
									))}
							</div>
							<Link
								href="/gerencia/estoque"
								className="block w-full text-center mt-8 text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest cursor-pointer bg-blue-50/50 py-4 rounded-xl hover:bg-blue-50 transition-colors">
								Ver Estoque Completo
							</Link>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
