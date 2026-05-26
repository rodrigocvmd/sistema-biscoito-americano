"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, StockSnapshot } from "@/types";
import { RefreshCw, ArrowRight, TrendingUp, TrendingDown, ChevronDown, Package, Search } from "lucide-react";

export default function EstoqueComparativoPage() {
	const [historyStore, setHistoryStore] = useState<StoreId>("conjunto");
	const [snapshots, setSnapshots] = useState<StockSnapshot[]>([]);
	const [selectedSnapshot1, setSelectedSnapshot1] = useState<string>("");
	const [selectedSnapshot2, setSelectedSnapshot2] = useState<string>("");
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");

	const fetchHistory = async () => {
		setLoadingHistory(true);
		try {
			const historyRef = collection(db, "stores", historyStore, "stockHistory");
			const q = query(
				historyRef,
				orderBy("timestamp", "desc"),
				limit(500) // Puxamos mais para garantir que tenhamos dias suficientes
			);

			const querySnapshot = await getDocs(q);
			const allDocs = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as StockSnapshot[];

			// Filtrar para manter apenas a última atualização de cada dia
			const seenDates = new Set();
			const dailyDocs = allDocs.filter((doc) => {
				if (!doc.timestamp) return false;
				const date = doc.timestamp.toDate();
				const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
				if (seenDates.has(normalizedDate)) return false;
				seenDates.add(normalizedDate);
				return true;
			});

			setSnapshots(dailyDocs);
			if (dailyDocs.length >= 2) {
				setSelectedSnapshot1(dailyDocs[1].id!); // Segundo dia mais recente
				setSelectedSnapshot2(dailyDocs[0].id!); // Dia mais recente
			} else if (dailyDocs.length === 1) {
				setSelectedSnapshot1(dailyDocs[0].id!);
				setSelectedSnapshot2(dailyDocs[0].id!);
			}
		} catch (error) {
			console.error("Erro ao buscar histórico:", error);
		} finally {
			setLoadingHistory(false);
		}
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

	useEffect(() => {
		fetchHistory();
	}, [historyStore]);

	const renderStockCell = (qty: number, openVal: number | boolean) => {
		const openCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
		return (
			<div className="flex flex-col items-center">
				<div className="flex items-center gap-1">
					{(qty > 0 || openCount === 0) && (
						<span className={`text-2xl font-black ${qty === 0 && openCount === 0 ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>
							{qty}
						</span>
					)}
					{openCount > 0 && (
						<span className="text-xl font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
							{qty > 0 ? `+ ${openCount} ab.` : `${openCount} ab.`}
						</span>
					)}
				</div>
			</div>
		);
	};

	return (
		<div className="space-y-6">
			{snapshots.length > 0 ? (
				<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
					<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
						<div className="flex flex-wrap items-center gap-6">
							<div className="flex flex-col gap-2">
								<span className="text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 text-center">Loja</span>
								<div className="relative group flex min-w-[160px]">
									<select
										value={historyStore}
										onChange={(e) => setHistoryStore(e.target.value as StoreId)}
										className="appearance-none w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-[1rem] font-black text-slate-600 dark:text-blue-500 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm uppercase">
										{Object.entries(STORE_NAMES).map(([id, name]) => (
											<option key={id} value={id} className="dark:bg-slate-900">{name}</option>
										))}
									</select>
									<ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="flex flex-col gap-2">
									<span className="text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 text-center">Comparar de</span>
									<div className="relative group">
										<select
											value={selectedSnapshot1}
											onChange={(e) => setSelectedSnapshot1(e.target.value)}
											className="appearance-none bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-[1rem] font-black text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm">
											{snapshots.map((s) => (
												<option key={s.id} value={s.id} className="dark:bg-slate-900">{formatHistoryLabel(s.timestamp.toDate())}</option>
											))}
										</select>
										<ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
									</div>
								</div>
								<ArrowRight className="text-slate-300 dark:text-slate-600 mt-6" size={16} />
								<div className="flex flex-col gap-2">
									<span className="text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 text-center">Para</span>
									<div className="relative group">
										<select
											value={selectedSnapshot2}
											onChange={(e) => setSelectedSnapshot2(e.target.value)}
											className="appearance-none bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-[1rem] font-black text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm">
											{snapshots.map((s) => (
												<option key={s.id} value={s.id} className="dark:bg-slate-900">{formatHistoryLabel(s.timestamp.toDate())}</option>
											))}
										</select>
										<ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
									</div>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-2 flex-1 min-w-[250px]">
							<span className="text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Filtrar por Sabor</span>
							<div className="relative group">
								<Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
								<input
									type="text"
									placeholder="Ex: Nutella..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl py-2 pl-12 pr-4 text-[0.95rem] font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
								/>
							</div>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
									<th className="p-6 text-left text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item</th>
									<th className="p-6 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Antes</th>
									<th className="p-6 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Depois</th>
									<th className="p-6 text-center text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Diferença</th>
								</tr>
							</thead>
							<tbody>
								{(Object.entries(STOCK_LABELS) as [keyof StockData, string][])
									.sort((a, b) => a[1].localeCompare(b[1]))
									.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
									.map(([key, label]) => {
									const s1 = snapshots.find(s => s.id === selectedSnapshot1);
									const s2 = snapshots.find(s => s.id === selectedSnapshot2);
									
									const q1 = s1?.stock[key as keyof StockData] || 0;
									const q2 = s2?.stock[key as keyof StockData] || 0;
									const o1 = s1?.isUnits?.[key as keyof StockData] || 0;
									const o2 = s2?.isUnits?.[key as keyof StockData] || 0;

									// Diferença apenas de pacotes inteiros
									const diff = q2 - q1;

									return (
										<tr key={key} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
											<td className="p-6 text-lg font-black text-slate-600 dark:text-slate-300 uppercase">{label}</td>
											<td className="p-4 text-center">
												{renderStockCell(q1, o1)}
											</td>
											<td className="p-4 text-center">
												{renderStockCell(q2, o2)}
											</td>
											<td className="p-6 text-center">
												<div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-black ${
													diff > 0 ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : 
													diff < 0 ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : 
													"bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
												}`}>
													{diff > 0 && <TrendingUp size={14} />}
													{diff < 0 && <TrendingDown size={14} />}
													{diff > 0 ? `+${diff}` : diff}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			) : (
				!loadingHistory && (
					<div className="bg-white dark:bg-slate-900 p-20 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors">
						<p className="text-slate-400 dark:text-slate-500 font-bold">Nenhuma movimentação encontrada para esta loja.</p>
					</div>
				)
			)}
		</div>
	);
}
