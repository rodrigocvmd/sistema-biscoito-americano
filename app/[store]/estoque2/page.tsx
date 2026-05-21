"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { STOCK_LABELS, StockData, formatDate } from "@/types";
import { RefreshCw, AlertCircle, Package } from "lucide-react";
import { use } from "react";
import Link from "next/link";

export default function StockPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
	const [stock, setStock] = useState<Partial<StockData>>({});
	const [isUnits, setIsUnits] = useState<Partial<Record<keyof StockData, boolean>>>({});
	const [sortBy, setSortBy] = useState<"default" | "name" | "quantity">("default");

	useEffect(() => {
		const savedSort = localStorage.getItem("biscoito_store_sort");
		if (savedSort) setSortBy(savedSort as any);
	}, []);

	useEffect(() => {
		localStorage.setItem("biscoito_store_sort", sortBy);
	}, [sortBy]);

	useEffect(() => {
		const docRef = doc(db, "stores", store);
		
		const unsubscribe = onSnapshot(docRef, (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setStock(data.stock || {});
				setIsUnits(data.isUnits || {});
				if (data.lastStockUpdate) {
					setLastUpdate(data.lastStockUpdate.toDate());
				}
			}
			setLoading(false);
		}, (error) => {
			console.error("Erro ao buscar estoque:", error);
			setLoading(false);
		});

		return () => unsubscribe();
	}, [store]);

	const sortedItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][]).sort((a, b) => {
		if (sortBy === "name") {
			return a[1].localeCompare(b[1]);
		}
		if (sortBy === "quantity") {
			const qtyA = stock[a[0]] || 0;
			const qtyB = stock[b[0]] || 0;
			return qtyB - qtyA;
		}
		return 0;
	});

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando contagem...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6 w-full overflow-hidden">
			{/* Tab Switcher */}
			<div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
				<Link
					href={`/${store}/estoque`}
					className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-sm font-black transition-all"
				>
					Estoque (Movimentação)
				</Link>
				<Link
					href={`/${store}/estoque2`}
					className="px-6 py-2.5 bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 rounded-xl text-sm font-black shadow-sm transition-all"
				>
					Contagem Atual
				</Link>
			</div>

			{/* Sorting Navbar */}
			<div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-colors">
				<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 sm:ml-3">
					Ordenar por:
				</span>
				<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1 overflow-x-auto no-scrollbar">
					<button
						onClick={() => setSortBy("default")}
						className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "default" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
						Padrão
					</button>
					<button
						onClick={() => setSortBy("name")}
						className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "name" ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
						Alfabética
					</button>
					<button
						onClick={() => setSortBy("quantity")}
						className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "quantity" ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
						Quantidade
					</button>
				</div>
			</div>

			<div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
					<div>
						<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
							<Package className="text-red-600" size={24} />
							Contagem de Estoque
						</h2>
						<p className="text-sm text-amber-600 dark:text-amber-500 font-bold flex items-center gap-1.5 mt-1">
							<AlertCircle size={16} />
							Apenas leitura. Use a aba de movimentações para alterações.
						</p>
					</div>
					<div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
						<span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 block mb-1">
							ÚLTIMA ATUALIZAÇÃO
						</span>
						<span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatDate(lastUpdate)}</span>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{sortedItems.map(([key, label]) => {
						const qty = stock[key] || 0;
						const hasOpen = isUnits[key] || false;
						
						return (
							<div
								key={key}
								className="flex flex-col p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group"
							>
								<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
									{label}
								</span>
								<div className="flex items-baseline gap-2">
									{qty > 0 || !hasOpen ? (
										<>
											<span className={`text-xl font-black ${qty === 0 && !hasOpen ? "text-slate-300 dark:text-slate-700" : "text-slate-900 dark:text-slate-100"}`}>
												{qty}
											</span>
											<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
												{qty === 1 ? "pacote" : "pacotes"}
											</span>
										</>
									) : null}
									{hasOpen && (
										<span className="text-xl font-black text-orange-500 whitespace-nowrap">
											{qty > 0 ? "+ 1 aberto" : "1 aberto"}
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
