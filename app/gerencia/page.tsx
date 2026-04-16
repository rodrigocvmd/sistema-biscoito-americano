"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	getDocs,
	onSnapshot,
	query,
	where,
	orderBy,
	doc,
	updateDoc,
	collectionGroup,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	StockData,
	STORE_NAMES,
	StoreId,
	SupplyOrder,
	formatDate,
	formatOnlyDate,
} from "@/types";
import {
	LayoutDashboard,
	Store,
	Package,
	RefreshCw,
	ChevronLeft,
	Calendar,
	AlertTriangle,
	AlertCircle,
	ChevronDown,
	ChevronUp,
	Hourglass,
	Coffee,
	Check,
} from "lucide-react";
import Link from "next/link";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	pendingOrders: SupplyOrder[];
}

export default function GerenciaPage() {
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<"general" | "byStore" | "insumos">("general");
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({
		conjunto: true,
	});
	const [insumosSort, setInsumosSort] = useState<"default" | "urgency" | "date">("urgency");
	const [tableSort, setTableSort] = useState<"default" | "name">("default");

	const toggleStore = (storeId: string) => {
		setExpandedStores((prev) => ({
			...prev,
			[storeId]: !prev[storeId],
		}));
	};

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
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

	// Função para normalizar urgências antigas para o novo padrão
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

		// 1. Ouvinte para as Lojas (Estoque)
		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			// 2. Ouvinte Global para TODOS os pedidos pendentes
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

				// Consolidar dados mantendo a ordem atual do estado se já existir (para não quebrar a rotação)
				setAllData((currentData) => {
					const newFullData = storeIds.map((id) => {
						const storeDoc = storesMap[id] || {};
						return {
							id,
							name: STORE_NAMES[id],
							lastStockUpdate: storeDoc.lastStockUpdate?.toDate() || null,
							stock: storeDoc.stock || {},
							pendingOrders: allOrders.filter((o) => o.storeId === id),
						};
					});

					// Se já temos dados e rodamos a lista, precisamos manter a ordem das lojas
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
			<div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
				<RefreshCw className="animate-spin text-blue-600 mb-4" size={48} />
				<p className="text-slate-500 font-bold">Carregando painel administrativo...</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-50 flex flex-col">
			{/* Header */}
			<header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
				<div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<Link
							href="/"
							className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
							<ChevronLeft size={24} />
						</Link>
						<div>
							<h1 className="text-xl font-black text-blue-700 uppercase tracking-tight">
								PAINEL DE GERÊNCIA
							</h1>
							<p className="text-[10px] font-bold text-slate-400 -mt-1 tracking-widest uppercase">
								Resumo Geral de Operações
							</p>
						</div>
					</div>

					<div className="flex bg-slate-100 p-1 rounded-xl">
						<button
							onClick={() => setView("insumos")}
							className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
								view === "insumos" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
							}`}>
							<LayoutDashboard size={16} /> Insumos
						</button>
						<button
							onClick={() => setView("general")}
							className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
								view === "general" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
							}`}>
							<Package size={16} /> Estoque
						</button>
						<button
							onClick={() => setView("byStore")}
							className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
								view === "byStore" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
							}`}>
							<Store size={16} /> Por Loja
						</button>
					</div>
				</div>
			</header>

			<main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
				{view === "general" ? (
					<div className="space-y-4">
						{/* Table Sorting Navbar */}
						<div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 w-fit">
							<span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">
								Itens:
							</span>
							<div className="flex bg-slate-100 p-1 rounded-lg gap-1">
								<button
									onClick={() => setTableSort("default")}
									className={`cursor-pointer px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${tableSort === "default" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
									Padrão
								</button>
								<button
									onClick={() => setTableSort("name")}
									className={`cursor-pointer px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${tableSort === "name" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
									A-Z
								</button>
							</div>
						</div>

						<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full border-collapse">
									<thead>
										<tr className="bg-slate-50 border-b border-slate-200">
											<th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-20 min-w-[150px]">
												<div className="flex items-center gap-2">
													ITEM
													<button
														onClick={rotateStores}
														className="cursor-pointer p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
														title="Mover primeira loja para o final">
														<RefreshCw size={12} />
													</button>
												</div>
											</th>
											{allData.map((store) => (
												<th
													key={store.id}
													className="p-4 text-center text-[10px] font-black text-blue-600 uppercase tracking-widest border-l border-slate-200 min-w-[120px]">
													<div className="flex flex-col items-center gap-1">
														<span className="leading-tight">{store.name}</span>
														<span className="text-[11px] font-bold text-slate-600 lowercase tracking-normal bg-white px-2 py-0.5 rounded-full border border-slate-100 whitespace-nowrap">
															{formatOnlyDate(store.lastStockUpdate)}
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
												// Encontrar o maior valor desta linha para o gradiente
												const rowValues = allData.map((store) => store.stock[key] || 0);
												const rowMax = Math.max(...rowValues);

												return (
													<tr
														key={key}
														className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
														<td className="p-4 text-xs font-black text-slate-600 uppercase sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 border-r border-slate-50">
															{label}
														</td>
														{allData.map((store) => {
															const value = store.stock[key] || 0;
															return (
																<td
																	key={store.id}
																	className="p-4 text-center border-l border-slate-100">
																	<span
																		className={`text-lg font-black ${value === 0 ? "text-slate-400" : "text-slate-900"}`}>
																		{value}
																	</span>
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
				) : view === "byStore" ? (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{allData.map((store) => (
							<div
								key={store.id}
								className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
								<div className="p-6 border-b border-slate-100 bg-slate-50/50">
									<h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
										{store.name}
									</h3>
									<div className="flex items-center gap-2 mt-1">
										<Calendar size={14} className="text-slate-400" />
										<span className="text-[10px] font-bold text-slate-400 uppercase">
											Último estoque: {formatDate(store.lastStockUpdate)}
										</span>
									</div>
								</div>

								<div className="p-6 flex-1 space-y-6">
									{/* Insumos Pendentes Resumo */}
									<div>
										<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
											<Package size={14} /> Insumos Pendentes ({store.pendingOrders.length})
										</h4>
										{store.pendingOrders.length > 0 ? (
											<div className="space-y-2">
												{store.pendingOrders.slice(0, 3).map((order) => (
													<div
														key={order.id}
														className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
														<div className="flex flex-col">
															<span className="text-xs font-bold text-slate-700">{order.name}</span>
															<span className="text-[8px] font-bold text-slate-400 uppercase">
																{formatOnlyDate(order.createdAt?.toDate())}
															</span>
														</div>
														{order.quantity && (
															<span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
																{order.quantity}
															</span>
														)}
													</div>
												))}
												{store.pendingOrders.length > 3 && (
													<p className="text-[10px] text-slate-400 font-bold text-center mt-2 italic">
														... e mais {store.pendingOrders.length - 3} pedidos
													</p>
												)}
											</div>
										) : (
											<p className="text-xs text-slate-400 italic">Nenhum pedido pendente.</p>
										)}
									</div>

									{/* Estoque Resumo (Top 5 baixos ou todos) */}
									<div>
										<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
											Resumo Estoque
										</h4>
										<div className="grid grid-cols-2 gap-2">
											{Object.entries(store.stock)
												.slice(0, 6)
												.map(([key, qty]) => (
													<div
														key={key}
														className="flex items-center justify-between p-2 bg-slate-50/50 rounded-lg text-[10px]">
														<span className="font-bold text-slate-500 uppercase truncate pr-2">
															{STOCK_LABELS[key as keyof StockData]}
														</span>
														<span className="font-black text-slate-800">{qty}</span>
													</div>
												))}
										</div>
										<Link
											href={`/${store.id}/estoque`}
											className="block text-center mt-4 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest">
											Ver Detalhes Completos
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="space-y-6">
						{allData.map(
							(store) =>
								store.pendingOrders.length > 0 && (
									<div
										key={store.id}
										className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
										<button
											onClick={() => toggleStore(store.id)}
											className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-all cursor-pointer group">
											<div className="flex items-center gap-5 text-left">
												<div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-100 group-hover:scale-105 transition-all">
													<Store size={28} />
												</div>
												<div>
													<h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none">
														{store.name}
													</h3>
													<p className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.2em] mt-2">
														{store.pendingOrders.length}{" "}
														{store.pendingOrders.length === 1
															? "Pedido Pendente"
															: "Pedidos Pendentes"}
													</p>
												</div>
											</div>
											<div className="bg-slate-50 p-2 rounded-full border border-slate-100 group-hover:bg-white group-hover:border-blue-200 transition-all">
												{expandedStores[store.id] ? (
													<ChevronUp size={24} className="text-blue-600" />
												) : (
													<ChevronDown size={24} className="text-slate-400" />
												)}
											</div>
										</button>

										{expandedStores[store.id] && (
											<div className="p-6 pt-0 border-t border-slate-50 animate-in slide-in-from-top-2 duration-300">
												{/* Store-specific Sorting Navbar */}
												<div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-slate-50 mb-6">
													<span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
														Ordenar:
													</span>
													<div className="flex bg-slate-100 p-1 rounded-lg gap-1 w-fit">
														<button
															onClick={() => setInsumosSort("default")}
															className={`cursor-pointer px-3 py-1 rounded-md text-[10px] font-black transition-all whitespace-nowrap ${insumosSort === "default" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
															Padrão
														</button>
														<button
															onClick={() => setInsumosSort("urgency")}
															className={`cursor-pointer px-3 py-1 rounded-md text-[10px] font-black transition-all whitespace-nowrap ${insumosSort === "urgency" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
															Urgência
														</button>
														<button
															onClick={() => setInsumosSort("date")}
															className={`cursor-pointer px-3 py-1 rounded-md text-[10px] font-black transition-all whitespace-nowrap ${insumosSort === "date" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
															Data
														</button>
													</div>
												</div>

												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
													{[...store.pendingOrders]
														.sort((a, b) => {
															// Prioridade 1: Itens com check administrativo vão para o fim
															if (a.checkedByGerencia && !b.checkedByGerencia) return 1;
															if (!a.checkedByGerencia && b.checkedByGerencia) return -1;

															// Prioridade 2: Ordenação escolhida
															if (insumosSort === "urgency") {
																const weight: Record<string, number> = {
																	Urgente: 3,
																	Acabando: 2,
																	Adiantando: 1,
																};
																return (weight[b.urgency] || 0) - (weight[a.urgency] || 0);
															}
															if (insumosSort === "date") {
																return (
																	(a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
																);
															}
															return 0;
														})
														.map((order) => {
															const norm = normalizeUrgency(order.urgency);
															const isChecked = order.checkedByGerencia || false;

															return (
																<div
																	key={order.id}
																	className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
																		isChecked
																			? "bg-slate-100 border-slate-200 opacity-60"
																			: "bg-slate-50 border-slate-100 hover:bg-white hover:border-blue-200 hover:shadow-md"
																	}`}>
																	<div className="flex items-start justify-between gap-3">
																		<div className="flex-1 min-w-0">
																			<p
																				className={`text-xl font-black leading-tight truncate ${
																					isChecked
																						? "text-slate-400 line-through"
																						: "text-slate-800"
																				}`}>
																				{order.name}
																			</p>
																			<p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
																				{formatDate(order.createdAt?.toDate())}
																			</p>
																		</div>
																		<div className="flex items-center gap-2 shrink-0">
																			<button
																				onClick={() =>
																					handleToggleCheck(store.id, order.id, isChecked)
																				}
																				className={`p-2 rounded-xl border transition-all cursor-pointer ${
																					isChecked
																						? "bg-blue-600 border-blue-600 text-white"
																						: "bg-white border-slate-200 text-slate-300 hover:border-blue-400 hover:text-blue-500"
																				}`}
																				title={isChecked ? "Desmarcar" : "Marcar como visualizado"}>
																				<Check size={16} strokeWidth={isChecked ? 4 : 2} />
																			</button>
																			<div className="shrink-0">
																				{norm.type === "urgente" ? (
																					<span className="bg-red-100 text-red-600 p-2.5 rounded-xl block">
																						<AlertTriangle size={20} />
																					</span>
																				) : norm.type === "acabando" ? (
																					<span className="bg-amber-100 text-amber-600 p-2.5 rounded-xl block">
																						<AlertCircle size={20} />
																					</span>
																				) : (
																					<span className="bg-blue-100 text-blue-600 p-2.5 rounded-xl block">
																						<Hourglass size={20} />
																					</span>
																				)}
																			</div>
																		</div>
																	</div>
																	<div className="flex items-center justify-between border-t border-slate-200/50 pt-4">
																		<span
																			className={`text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1.5 ${
																				isChecked
																					? "bg-slate-200 text-slate-500"
																					: norm.type === "urgente"
																						? "bg-red-50 text-red-700"
																						: norm.type === "acabando"
																							? "bg-amber-50 text-amber-700"
																							: "bg-blue-50 text-blue-700"
																			}`}>
																			{norm.label}
																		</span>
																		{order.quantity && (
																			<span
																				className={`text-lg font-extrabold ${isChecked ? "text-slate-400" : "text-slate-800"}`}>
																				<span className="text-md text-gray-600 font-medium">Qtd:</span> {order.quantity}
																			</span>
																		)}
																	</div>
																</div>
															);
														})}
												</div>
											</div>
										)}
									</div>
								),
						)}
						{allData.every((store) => store.pendingOrders.length === 0) && (
							<div className="bg-white rounded-3xl p-12 text-center border border-slate-200 border-dashed">
								<Package className="mx-auto text-slate-200 mb-4" size={64} />
								<p className="text-slate-400 font-bold">
									Nenhum pedido de insumo pendente em nenhuma loja.
								</p>
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
