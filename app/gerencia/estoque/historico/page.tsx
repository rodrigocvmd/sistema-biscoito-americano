"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, Timestamp, limit } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, StockSnapshot } from "@/types";
import { RefreshCw, Calendar, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

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
				limit(15)
			);

			const querySnapshot = await getDocs(q);
			const docs = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as StockSnapshot[];

			setSnapshots(docs);
			if (docs.length >= 2) {
				setSelectedSnapshot1(docs[1].id!); // Segundo mais recente (penúltimo salvo entre os 15 se ordenado desc)
				setSelectedSnapshot2(docs[0].id!); // Mais recente
			} else if (docs.length === 1) {
				setSelectedSnapshot1(docs[0].id!);
				setSelectedSnapshot2(docs[0].id!);
			}
		} catch (error) {
			console.error("Erro ao buscar histórico:", error);
		} finally {
			setLoadingHistory(false);
		}
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
					<select
						value={historyStore}
						onChange={(e) => setHistoryStore(e.target.value as StoreId)}
						className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-slate-200">
						{Object.entries(STORE_NAMES).map(([id, name]) => (
							<option key={id} value={id}>{name}</option>
						))}
					</select>
				</div>

				<button
					onClick={fetchHistory}
					disabled={loadingHistory}
					className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-black transition-all shadow-md shadow-blue-100 dark:shadow-none disabled:opacity-50">
					{loadingHistory ? <RefreshCw className="animate-spin" size={18} /> : "ATUALIZAR"}
				</button>
			</div>

			{snapshots.length > 0 ? (
				<div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
					<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
						<div className="flex items-center gap-4">
							<div className="flex flex-col gap-1">
								<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Comparar de</span>
								<select
									value={selectedSnapshot1}
									onChange={(e) => setSelectedSnapshot1(e.target.value)}
									className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200">
									{snapshots.map((s) => (
										<option key={s.id} value={s.id}>{formatDate(s.timestamp.toDate())}</option>
									))}
								</select>
							</div>
							<ArrowRight className="text-slate-300 dark:text-slate-600 mt-4" size={20} />
							<div className="flex flex-col gap-1">
								<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Para</span>
								<select
									value={selectedSnapshot2}
									onChange={(e) => setSelectedSnapshot2(e.target.value)}
									className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-200">
									{snapshots.map((s) => (
										<option key={s.id} value={s.id}>{formatDate(s.timestamp.toDate())}</option>
									))}
								</select>
							</div>
						</div>
						<div className="text-right">
							<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Loja Selecionada</span>
							<span className="text-lg font-black text-blue-600 dark:text-blue-400">{STORE_NAMES[historyStore]}</span>
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
