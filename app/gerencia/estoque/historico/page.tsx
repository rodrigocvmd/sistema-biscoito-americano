"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, Timestamp, limit } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, StockSnapshot } from "@/types";
import { RefreshCw, Calendar, ArrowRight, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

export default function EstoqueHistoricoPage() {
	const [historyStore, setHistoryStore] = useState<StoreId>("conjunto");
	const [snapshots, setSnapshots] = useState<StockSnapshot[]>([]);
	const [selectedSnapshot1, setSelectedSnapshot1] = useState<string>("");
	const [selectedSnapshot2, setSelectedSnapshot2] = useState<string>("");
	const [loadingHistory, setLoadingHistory] = useState(false);

	const fetchHistory = async () => {
		setLoadingHistory(true);
		try {
			const historyRef = collection(db, "stores", historyStore, "stockHistory");
			const q = query(
				historyRef,
				orderBy("timestamp", "desc"),
				limit(100)
			);

			const querySnapshot = await getDocs(q);
			const allDocs = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as StockSnapshot[];

			// Filtrar para manter apenas a última atualização de cada dia
			const seenDates = new Set();
			const dailyDocs = allDocs.filter((doc) => {
				const date = doc.timestamp.toDate();
				// Normalizamos para o início do dia para garantir unicidade por data
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
		const weekDays = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];
		const weekDay = weekDays[date.getDay()];
		return `${day}/${month} - ${weekDay}`;
	};

	useEffect(() => {
		fetchHistory();
	}, [historyStore]);

	return (
		<div className="space-y-6">
			{/* Filters */}
			<div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-6 justify-center transition-colors">
				<div className="flex flex-col gap-2">
					<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Loja para Histórico</span>
					<div className="relative group flex">
						<select
							value={historyStore}
							onChange={(e) => setHistoryStore(e.target.value as StoreId)}
							className="flex justify-center items-center align-middle appearance-none w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 pr-12 text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
							{Object.entries(STORE_NAMES).map(([id, name]) => (
								<option key={id} value={id} className="dark:bg-slate-900">{name}</option>
							))}
						</select>
						<ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors pointer-events-none" />
					</div>
				</div>

				<button
					onClick={fetchHistory}
					disabled={loadingHistory}
					className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-500/20 dark:shadow-none disabled:opacity-50 flex items-center gap-3">
					{loadingHistory ? <RefreshCw className="animate-spin" size={18} /> : (
						<>
							<RefreshCw size={18} />
							<span>ATUALIZAR</span>
						</>
					)}
				</button>
			</div>

			{snapshots.length > 0 ? (
				<div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
					<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
						<div className="flex items-center gap-4">
							<div className="flex flex-col gap-2">
								<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 text-center">Comparar de</span>
								<div className="relative group">
									<select
										value={selectedSnapshot1}
										onChange={(e) => setSelectedSnapshot1(e.target.value)}
										className="appearance-none bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-[13px] font-black text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm">
										{snapshots.map((s) => (
											<option key={s.id} value={s.id} className="dark:bg-slate-900">{formatHistoryLabel(s.timestamp.toDate())}</option>
										))}
									</select>
									<ChevronDown size={16} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
								</div>
							</div>
							<ArrowRight className="text-slate-300 dark:text-slate-600 mt-6" size={20} />
							<div className="flex flex-col gap-2">
								<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 text-center">Para</span>
								<div className="relative group">
									<select
										value={selectedSnapshot2}
										onChange={(e) => setSelectedSnapshot2(e.target.value)}
										className="appearance-none bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-[13px] font-black text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm">
										{snapshots.map((s) => (
											<option key={s.id} value={s.id} className="dark:bg-slate-900">{formatHistoryLabel(s.timestamp.toDate())}</option>
										))}
									</select>
									<ChevronDown size={16} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
								</div>
							</div>
						</div>
						<div className="text-center">
							<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Loja Selecionada</span>
							<span className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{STORE_NAMES[historyStore]}</span>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
									<th className="p-6 text-left text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item</th>
									<th className="p-6 text-center text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Antes</th>
									<th className="p-6 text-center text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Depois</th>
									<th className="p-6 text-center text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Diferença</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(STOCK_LABELS).map(([key, label]) => {
									const s1 = snapshots.find(s => s.id === selectedSnapshot1);
									const s2 = snapshots.find(s => s.id === selectedSnapshot2);
									
									const u1 = s1?.isUnits?.[key as keyof StockData] || false;
									const u2 = s2?.isUnits?.[key as keyof StockData] || false;

									const v1 = u1 ? 0 : (s1?.stock[key as keyof StockData] || 0);
									const v2 = u2 ? 1 : (s2?.stock[key as keyof StockData] || 0);
									
									const displayV1 = s1?.stock[key as keyof StockData] || 0;
									const displayV2 = s2?.stock[key as keyof StockData] || 0;

									const diff = (u1 && u2) ? 0 : (v2 - v1);

									return (
										<tr key={key} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
											<td className="p-6 text-sm font-black text-slate-600 dark:text-slate-300 uppercase">{label}</td>
											<td className="p-6 text-center text-lg font-bold text-slate-400 dark:text-slate-500">
												{u1 ? "< 1" : displayV1}
											</td>
											<td className="p-6 text-center text-lg font-bold text-slate-900 dark:text-slate-100">
												{u2 ? "< 1" : displayV2}
											</td>
											<td className="p-6 text-center">
												<div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black ${
													diff > 0 ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : 
													diff < 0 ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : 
													"bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
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
					<div className="bg-white dark:bg-slate-900 p-20 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors">
						<p className="text-slate-400 dark:text-slate-500 font-bold">Nenhum snapshot encontrado para esta loja.</p>
					</div>
				)
			)}
		</div>
	);
}
