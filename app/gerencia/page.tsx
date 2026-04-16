"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, SupplyOrder } from "@/types";
import { LayoutDashboard, Store, Package, RefreshCw, ChevronLeft, Calendar } from "lucide-react";
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
	const [view, setView] = useState<"general" | "byStore">("general");
	const [allData, setAllData] = useState<FullStoreData[]>([]);

	useEffect(() => {
		const storeIds = Object.keys(STORE_NAMES) as StoreId[];

		// Listener para as lojas (estoque)
		const unsubscribeStores = onSnapshot(collection(db, "stores"), (snapshot) => {
			const storesMap: Record<string, any> = {};
			snapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			// Para cada loja, vamos buscar também os insumos pendentes
			const fetchData = async () => {
				const fullData: FullStoreData[] = [];

				for (const id of storeIds) {
					const storeDoc = storesMap[id] || {};
					
					// Buscar insumos pendentes desta loja
					const ordersRef = collection(db, "stores", id, "supplyOrders");
					const q = query(ordersRef, where("status", "==", "pending"), orderBy("createdAt", "desc"));
					const ordersSnap = await getDocs(q);
					const pendingOrders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SupplyOrder[];

					fullData.push({
						id,
						name: STORE_NAMES[id],
						lastStockUpdate: storeDoc.lastStockUpdate?.toDate() || null,
						stock: storeDoc.stock || {},
						pendingOrders: pendingOrders
					});
				}
				setAllData(fullData);
				setLoading(false);
			};

			fetchData();
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
						<Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
							<ChevronLeft size={24} />
						</Link>
						<div>
							<h1 className="text-xl font-black text-blue-700 uppercase tracking-tight">PAINEL DE GERÊNCIA</h1>
							<p className="text-[10px] font-bold text-slate-400 -mt-1 tracking-widest uppercase">Resumo Geral de Operações</p>
						</div>
					</div>

					<div className="flex bg-slate-100 p-1 rounded-xl">
						<button
							onClick={() => setView("general")}
							className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
								view === "general" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
							}`}>
							<LayoutDashboard size={16} /> Visão Geral
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
					<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full border-collapse">
								<thead>
									<tr className="bg-slate-50 border-b border-slate-200">
										<th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50">Item</th>
										{allData.map(store => (
											<th key={store.id} className="p-4 text-center text-[10px] font-black text-blue-600 uppercase tracking-widest border-l border-slate-200">
												{store.name}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{(Object.entries(STOCK_LABELS) as [keyof StockData, string][]).map(([key, label]) => (
										<tr key={key} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
											<td className="p-4 text-xs font-black text-slate-600 uppercase sticky left-0 bg-white group-hover:bg-blue-50/30">
												{label}
											</td>
											{allData.map(store => (
												<td key={store.id} className="p-4 text-center border-l border-slate-100">
													<span className={`text-lg font-black ${ (store.stock[key] || 0) < 5 ? 'text-red-600' : 'text-slate-800'}`}>
														{store.stock[key] || 0}
													</span>
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{allData.map(store => (
							<div key={store.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
								<div className="p-6 border-b border-slate-100 bg-slate-50/50">
									<h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{store.name}</h3>
									<div className="flex items-center gap-2 mt-1">
										<Calendar size={14} className="text-slate-400" />
										<span className="text-[10px] font-bold text-slate-400 uppercase">
											Último estoque: {store.lastStockUpdate ? store.lastStockUpdate.toLocaleString('pt-BR') : 'Nunca'}
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
												{store.pendingOrders.slice(0, 3).map(order => (
													<div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
														<span className="text-xs font-bold text-slate-700">{order.name}</span>
														{order.quantity && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{order.quantity}</span>}
													</div>
												))}
												{store.pendingOrders.length > 3 && (
													<p className="text-[10px] text-slate-400 font-bold text-center mt-2 italic">... e mais {store.pendingOrders.length - 3} pedidos</p>
												)}
											</div>
										) : (
											<p className="text-xs text-slate-400 italic">Nenhum pedido pendente.</p>
										)}
									</div>

									{/* Estoque Resumo (Top 5 baixos ou todos) */}
									<div>
										<h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumo Estoque</h4>
										<div className="grid grid-cols-2 gap-2">
											{Object.entries(store.stock).slice(0, 6).map(([key, qty]) => (
												<div key={key} className="flex items-center justify-between p-2 bg-slate-50/50 rounded-lg text-[10px]">
													<span className="font-bold text-slate-500 uppercase truncate pr-2">{STOCK_LABELS[key as keyof StockData]}</span>
													<span className="font-black text-slate-800">{qty}</span>
												</div>
											))}
										</div>
										<Link href={`/${store.id}/estoque`} className="block text-center mt-4 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest">
											Ver Detalhes Completos
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
