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
	Timestamp,
	orderBy,
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
	CheckCircle2,
	Trash2,
	ArrowLeftRight,
	Search,
	X,
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	pendingOrders: SupplyOrder[];
	historicalOrders: SupplyOrder[];
	activeCount: number;
	deliveringCount: number;
}

const STORE_ORDER: StoreId[] = ["lago", "terraco", "noroeste", "conjunto"];

export default function InsumosPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});
	const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
	const [insumosSort, setInsumosSort] = useState<"default" | "urgency" | "date">("urgency");
	const [searchTerm, setSearchTerm] = useState("");

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
	};

	// Persistir ordenação
	useEffect(() => {
		const savedSort = localStorage.getItem("biscoito_admin_insumos_sort");
		if (savedSort) setInsumosSort(savedSort as any);
	}, []);

	useEffect(() => {
		localStorage.setItem("biscoito_admin_insumos_sort", insumosSort);
	}, [insumosSort]);

	const toggleStore = (storeId: string) => {
		setExpandedStores((prev) => ({
			...prev,
			[storeId]: !prev[storeId],
		}));
	};

	const toggleHistory = (storeId: string) => {
		setShowHistory((prev) => ({
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

	const handleMarkAsDelivered = async (storeId: string, orderId: string) => {
		try {
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			const deliveredAt = new Date();
			const expireAt = new Date();
			expireAt.setDate(deliveredAt.getDate() + 14);

			await updateDoc(orderRef, {
				status: "delivered",
				deliveredAt: Timestamp.fromDate(deliveredAt),
				expireAt: Timestamp.fromDate(expireAt),
			});
		} catch (error) {
			console.error("Erro ao marcar como entregue:", error);
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
		const storeIds = STORE_ORDER;

		// Query for Pending - CollectionGroup is fine for single field
		const pendingQuery = query(
			collectionGroup(db, "supplyOrders"),
			where("status", "==", "pending"),
		);

		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

		const storePendingData: Record<string, SupplyOrder[]> = {};
		const storeHistoryData: Record<string, SupplyOrder[]> = {};

		const updateAllData = () => {
			setAllData((currentData) => {
				const newFullData = storeIds.map((id) => {
					const sPending = storePendingData[id] || [];
					const sHistory = storeHistoryData[id] || [];
					const activeCount = sPending.filter((o) => !o.checkedByGerencia).length;
					const deliveringCount = sPending.filter((o) => o.checkedByGerencia === true).length;
					return {
						id,
						name: STORE_NAMES[id],
						pendingOrders: sPending,
						historicalOrders: sHistory,
						activeCount,
						deliveringCount,
					};
				});

				if (currentData.length > 0) {
					const currentIdOrder = currentData.map((d) => d.id);
					return currentIdOrder.map((id) => newFullData.find((d) => d.id === id)!);
				}
				return newFullData;
			});
			setLoading(false);
		};

		// 1. Pending Listener (Per store for precise reference matching)
		const pendingUnsubs = storeIds.map((id) => {
			const pendingRef = collection(db, "stores", id, "supplyOrders");
			const qPending = query(pendingRef, where("status", "==", "pending"));

			return onSnapshot(
				qPending,
				(snapshot) => {
					storePendingData[id] = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					})) as SupplyOrder[];
					updateAllData();
				},
				(error) => console.error(`Error fetching pending orders for store ${id}:`, error),
			);
		});

		// 2. History Listeners (Per Store - for exact parity)
		const historyUnsubs = storeIds.map((id) => {
			const historyRef = collection(db, "stores", id, "supplyOrders");
			const qHistory = query(
				historyRef,
				where("status", "in", ["delivered", "cancelled"]),
				where("deliveredAt", ">=", Timestamp.fromDate(fourWeeksAgo)),
				orderBy("deliveredAt", "desc")
			);

			return onSnapshot(qHistory, (snapshot) => {
				storeHistoryData[id] = snapshot.docs.map(doc => ({
					id: doc.id,
					...doc.data()
				})) as SupplyOrder[];
				updateAllData();
			}, (error) => console.error(`Error fetching history for store ${id}:`, error));
		});

		return () => {
			pendingUnsubs.forEach(unsub => unsub());
			historyUnsubs.forEach(unsub => unsub());
		};
	}, []);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando insumos...</p>
			</div>
		);
	}

	// Cálculo dos resultados de busca de insumos em pedidos pendentes e a entregar
	const searchResults = (() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return [];

		// Mapeia por nome de insumo quais lojas pediram e seus status
		const resultsMap = new Map<string, { storeId: StoreId; storeName: string; count: number; hasPending: boolean; hasDelivering: boolean }[]>();

		allData.forEach((store) => {
			store.pendingOrders.forEach((order) => {
				if (order.name.toLowerCase().includes(term)) {
					const existing = resultsMap.get(order.name) || [];
					const storeEntry = existing.find((e) => e.storeId === store.id);
					if (storeEntry) {
						storeEntry.count += 1;
						if (order.checkedByGerencia) storeEntry.hasDelivering = true;
						else storeEntry.hasPending = true;
					} else {
						existing.push({
							storeId: store.id,
							storeName: store.name,
							count: 1,
							hasPending: !order.checkedByGerencia,
							hasDelivering: !!order.checkedByGerencia,
						});
					}
					resultsMap.set(order.name, existing);
				}
			});
		});

		return Array.from(resultsMap.entries()).map(([itemName, stores]) => ({
			itemName,
			stores,
		}));
	})();

	return (
		<div className="space-y-8">
			{/* Barra de Pesquisa de Insumos */}
			<div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-all">
				<div className="relative flex-1 group">
					<Search
						size={20}
						className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
					/>
					<input
						type="text"
						placeholder="Pesquisar insumo nos pedidos pendentes e a entregar..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-10 text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
							title="Limpar busca">
							<X size={16} />
						</button>
					)}
				</div>

				{/* Resultados da Busca */}
				{searchTerm.trim() && (
					<div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
						{searchResults.length > 0 ? (
							<div className="space-y-2.5">
								<p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
									Lojas com pedidos para &quot;{searchTerm}&quot;:
								</p>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{searchResults.map(({ itemName, stores }) => (
										<div
											key={itemName}
											className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
											<div className="flex items-center gap-2">
												<Package size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
												<span className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
													{itemName}
												</span>
											</div>
											<div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
												{stores.map((s) => (
													<button
														key={s.storeId}
														onClick={() => {
															setExpandedStores((prev) => ({ ...prev, [s.storeId]: true }));
														}}
														className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs md:text-sm font-black border border-slate-200 dark:border-slate-600 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all">
														<span className="text-slate-800 dark:text-slate-200">{s.storeName}:</span>
														{s.hasPending && (
															<span className="text-amber-600 dark:text-amber-400 font-black">
																{s.count} {s.hasDelivering ? "ped." : "pendente(s)"}
															</span>
														)}
														{s.hasDelivering && (
															<span className="text-blue-600 dark:text-blue-400 font-black">
																{s.hasPending ? "/ a entregar" : `${s.count} a entregar`}
															</span>
														)}
													</button>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="py-4 text-center">
								<p className="text-sm font-bold text-slate-400 dark:text-slate-500">
									Nenhum pedido pendente ou a entregar encontrado para &quot;{searchTerm}&quot;.
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			<div className="flex justify-center items-center pt-2">
				<button
					onClick={rotateStores}
					className="cursor-pointer flex items-center gap-3 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-800 px-6 py-3 rounded-2xl font-black shadow-sm transition-all text-xs uppercase tracking-widest"
					title="Alternar ordem das lojas">
					<ArrowLeftRight size={18} />
					Alternar Ordem das Lojas
				</button>
			</div>

			{allData.map((store) => {
				const activeCount = store.pendingOrders.filter((o) => !o.checkedByGerencia).length;
				const deliveringCount = store.pendingOrders.filter((o) => !!o.checkedByGerencia).length;

				return (
					<div
						key={store.id}
						className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
						<button
							onClick={() => toggleStore(store.id)}
							className="w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group">
							<div className="flex items-center gap-4 text-left">
								<div
									id="insumosStoreIcon"
									className={`${
										activeCount === 0 && deliveringCount === 0
											? "bg-green-600 shadow-green-100 dark:shadow-none"
											: activeCount > 0 || deliveringCount > 0
												? "bg-blue-600 shadow-blue-100 dark:shadow-none"
												: "bg-slate-300 dark:bg-slate-700 shadow-slate-100 dark:shadow-none"
									} text-white p-5 rounded-[24px] shadow-lg group-hover:scale-105 transition-all`}>
									<Store size={36} />
								</div>
								<div>
									<h3 className="text-3xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-none">
										{store.name}
									</h3>
									<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
										{activeCount === 0 && deliveringCount === 0 ? (
											<p className="font-bold uppercase tracking-[0.2em] text-green-600 dark:text-green-400">
												Nada pendente
											</p>
										) : (
											<>
												{activeCount > 0 && (
													<p className="font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
														<span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
															{activeCount}
														</span>{" "}
														{activeCount === 1 ? "Pedido Pendente" : "Pedidos Pendentes"}
													</p>
												)}
												{activeCount > 0 && deliveringCount > 0 && (
													<span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
												)}
												{deliveringCount > 0 && (
													<p className="font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
														<span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
															{deliveringCount}
														</span>{" "}
														{deliveringCount === 1 ? "Pedido a Entregar" : "Pedidos a Entregar"}
													</p>
												)}
											</>
										)}
									</div>
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
																? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-80"
																: "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-xl dark:hover:shadow-none"
														}`}>
														<div className="space-y-4">
															<div className="flex items-center justify-between gap-4">
																<p className="text-2xl font-black leading-tight text-slate-800 dark:text-slate-200">
																	{order.name}
																</p>
																<button
																	type="button"
																	id="checkBtn"
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

															{isChecked && (
																<div className="pt-2">
																	<button
																		type="button"
																		onClick={() => handleMarkAsDelivered(store.id, order.id)}
																		className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-md transition-all shadow-md shadow-emerald-100 dark:shadow-none cursor-pointer active:scale-95">
																		<CheckCircle2 size={18} />
																		Entregue
																	</button>
																</div>
															)}
														</div>
													</div>
												);
											})}
									</div>
								</>
							) : (
								<div className="py-12 text-center">
									<Package className="mx-auto text-slate-200 dark:text-slate-400 mb-4" size={48} />
									<p className="text-slate-400 dark:text-slate-400 font-bold">
										Nenhum pedido de insumo pendente para esta loja.
									</p>
								</div>
							)}

							{/* History Toggle Section */}
							<div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
								<button
									onClick={() => toggleHistory(store.id)}
									className="w-full flex items-center justify-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer group">
									<h4 className="text-lg font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
										<CheckCircle2
											className={`${showHistory[store.id] ? "text-emerald-500" : "text-slate-300 dark:text-slate-500"}`}
											size={32}
										/>
										({store.historicalOrders.length}) Insumos Finalizados (Últimas 4 Semanas)
									</h4>
									{/* <span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
										{showHistory[store.id] ? "Esconder" : "Mostrar"}
									</span> */}
								</button>

								{showHistory[store.id] && (
									<div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 opacity-70 dark:opacity-80 animate-in fade-in slide-in-from-top-2 duration-300">
										{store.historicalOrders
											.sort((a, b) => (b.deliveredAt?.toMillis() || 0) - (a.deliveredAt?.toMillis() || 0))
											.map((order) => (
											<div
												key={order.id}
												className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
													order.status === "cancelled"
														? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
														: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
												}`}>
												<div className="min-w-0 flex-1">
													<p
														className={`text-md font-bold truncate ${
															order.status === "cancelled"
																? "text-red-700 dark:text-red-400"
																: "text-slate-700 dark:text-slate-300 line-through decoration-slate-400 dark:decoration-slate-600"
														}`}>
														{order.name}
														{order.status === "cancelled" && " (CANCELADO)"}
													</p>
													<p className="text-sm text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">
														{order.status === "cancelled" ? "Cancelado em: " : "Entregue em: "}
														{formatDate(order.deliveredAt?.toDate())}
													</p>
												</div>
												<div className={`ml-3 shrink-0 ${order.status === "cancelled" ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-500"}`}>
													{order.status === "cancelled" ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
												</div>
											</div>
										))}
										{store.historicalOrders.length === 0 && (
											<div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
												<p className="text-sm text-slate-400 dark:text-slate-500 italic">
													Nenhum histórico recente para exibir.
												</p>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			);
		})}

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
