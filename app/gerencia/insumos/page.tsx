"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	query,
	where,
	doc,
	updateDoc,
	collectionGroup,
} from "firebase/firestore";
import { STOCK_LABELS, StoreId, STORE_NAMES, SupplyOrder, formatDate } from "@/types";
import {
	RefreshCw,
	Store,
	ChevronDown,
	ChevronUp,
	Check,
	AlertTriangle,
	AlertCircle,
	Hourglass,
	Package,
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	pendingOrders: SupplyOrder[];
	activeCount: number;
}

export default function InsumosPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({
		conjunto: true,
	});
	const [insumosSort, setInsumosSort] = useState<"default" | "urgency" | "date">("urgency");

	const toggleStore = (storeId: string) => {
		setExpandedStores((prev) => ({
			...prev,
			[storeId]: !prev[storeId],
		}));
	};

	const handleToggleCheck = async (storeId: string, orderId: string, currentChecked: boolean) => {
		try {
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			await updateDoc(orderRef, {
				checkedByGerencia: !currentChecked,
			});
		} catch (error) {
			console.error("Erro ao alternar check:", error);
		}
	};

	const normalizeUrgency = (
		urgency: string,
	): { label: string; type: "urgente" | "acabando" | "adiantando" } => {
		const u = urgency.toLowerCase();
		if (u.includes("urgente")) return { label: "Urgente", type: "urgente" };
		if (u.includes("acabando") || u.includes("normal"))
			return { label: "Acabando", type: "acabando" };
		return { label: "Adiantando", type: "adiantando" };
	};

	useEffect(() => {
		const storeIds = Object.keys(STORE_NAMES) as StoreId[];

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

			const newFullData = storeIds.map((id) => {
				const storeOrders = allOrders.filter((o) => o.storeId === id);
				return {
					id,
					name: STORE_NAMES[id],
					pendingOrders: storeOrders,
					activeCount: storeOrders.filter((o) => !o.checkedByGerencia).length,
				};
			});

			setAllData(newFullData);
			setLoading(false);
		});

		return () => unsubscribeOrders();
	}, []);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando insumos...</p>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{allData.map((store) => (
				<div
					key={store.id}
					className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
					<button
						onClick={() => toggleStore(store.id)}
						className="w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group">
						<div className="flex items-center gap-4 text-left">
							<div
								className={`${store.activeCount > 0 ? "bg-blue-600 shadow-blue-100 dark:shadow-none" : "bg-slate-300 dark:bg-slate-700 shadow-slate-100 dark:shadow-none"} text-white p-5 rounded-[24px] shadow-lg group-hover:scale-105 transition-all`}>
								<Store size={36} />
							</div>
							<div>
								<h3 className="text-3xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-none">
									{store.name}
								</h3>
								<p
									className={`font-bold uppercase tracking-[0.2em] mt-3 ${store.activeCount > 0 ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>
									<span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{store.activeCount}</span>{" "}
									{store.activeCount === 1 ? "Pedido Pendente" : "Pedidos Pendentes"}
								</p>
							</div>
						</div>
						<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-full border border-slate-100 dark:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-all">
							{expandedStores[store.id] ? (
								<ChevronUp size={24} className="text-blue-600 dark:text-blue-400" />
							) : (
								<ChevronDown size={24} className="text-slate-400 dark:text-slate-500" />
							)}
						</div>
					</button>

					{expandedStores[store.id] && (
						<div className="p-8 pt-0 border-t border-slate-50 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
							{store.pendingOrders.length > 0 ? (
								<>
									<div className="flex flex-wrap items-center gap-4 py-6 border-b border-slate-50 dark:border-slate-800 mb-3">
										<span className="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
											Ordenar:
										</span>
										<div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 w-fit max-w-full">
											{["default", "urgency", "date"].map((sort) => (
												<button
													key={sort}
													onClick={() => setInsumosSort(sort as any)}
													className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${insumosSort === sort ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>
													{sort === "default" ? "Padrão" : sort === "urgency" ? "Urgência" : "Data"}
												</button>
											))}
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
										{[...store.pendingOrders]
											.sort((a, b) => {
												if (a.checkedByGerencia && !b.checkedByGerencia) return 1;
												if (!a.checkedByGerencia && b.checkedByGerencia) return -1;

												if (insumosSort === "urgency") {
													const weight: Record<string, number> = {
														Urgente: 3,
														Acabando: 2,
														Adiantando: 1,
													};
													return (weight[b.urgency] || 0) - (weight[a.urgency] || 0);
												}
												if (insumosSort === "date") {
													return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
												}
												return 0;
											})
											.map((order) => {
												const norm = normalizeUrgency(order.urgency);
												const isChecked = order.checkedByGerencia || false;

												return (
													<div
														key={order.id}
														className={`p-6 rounded-[32px] border flex flex-col justify-between gap-4 transition-all ${
															isChecked
																? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-60"
																: "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-xl dark:hover:shadow-none"
														}`}>
														<div className="space-y-4">
															<div className="flex items-center justify-between gap-4">
																<p
																	className={`text-2xl font-black leading-tight ${
																		isChecked ? "text-slate-400 dark:text-slate-600 line-through" : "text-slate-800 dark:text-slate-200"
																	}`}>
																	{order.name}
																</p>
																<button
																	type="button"
																	onMouseDown={(e) => e.preventDefault()}
																	onClick={() => handleToggleCheck(store.id, order.id, isChecked)}
																	className={`p-3 rounded-2xl border transition-all shrink-0 cursor-pointer ${
																		isChecked
																			? "bg-green-600 border-green-600 text-white"
																			: "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-green-500 dark:hover:text-green-400"
																	}`}>
																	<Check size={24} strokeWidth={isChecked ? 5 : 3} />
																</button>
															</div>

															<div className="flex items-center justify-between gap-4 mt-8">
																<div className="flex items-center gap-2">
																	<div className="shrink-0 opacity-80">
																		{norm.type === "urgente" ? (
																			<span className="text-red-600 dark:text-red-500">
																				<AlertTriangle size={25} />
																			</span>
																		) : norm.type === "acabando" ? (
																			<span className="text-amber-600 dark:text-amber-500">
																				<AlertCircle size={25} />
																			</span>
																		) : (
																			<span className="text-blue-600 dark:text-blue-500">
																				<Hourglass size={35} />
																			</span>
																		)}
																	</div>
																	<span
																		className={`text-[14px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap ${
																			isChecked
																				? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
																				: norm.type === "urgente"
																					? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
																					: norm.type === "acabando"
																						? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
																						: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
																		}`}>
																		{norm.label}
																	</span>
																</div>
																<p className="text-lg font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
																	{formatDate(order.createdAt?.toDate())}
																</p>
															</div>
														</div>
													</div>
												);
											})}
									</div>
								</>
							) : (
								<div className="py-12 text-center">
									<Package className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={48} />
									<p className="text-slate-400 dark:text-slate-500 font-bold">
										Nenhum pedido de insumo pendente para esta loja.
									</p>
								</div>
							)}
						</div>
					)}
				</div>
			))}

			{allData.length === 0 && (
				<div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 border-dashed">
					<Package className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={64} />
					<p className="text-slate-400 dark:text-slate-500 font-bold">
						Nenhum pedido de insumo pendente em nenhuma loja.
					</p>
				</div>
			)}
		</div>
	);
}
