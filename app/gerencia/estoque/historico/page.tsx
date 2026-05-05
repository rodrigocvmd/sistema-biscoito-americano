"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, StockSnapshot } from "@/types";
import { RefreshCw, Calendar, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";

export default function EstoqueHistoricoPage() {
	const [historyStore, setHistoryStore] = useState<StoreId>("conjunto");
	const [historyDateStart, setHistoryDateStart] = useState<string>("");
	const [historyDateEnd, setHistoryDateEnd] = useState<string>("");
	const [snapshots, setSnapshots] = useState<StockSnapshot[]>([]);
	const [selectedSnapshot1, setSelectedSnapshot1] = useState<string>("");
	const [selectedSnapshot2, setSelectedSnapshot2] = useState<string>("");
	const [loadingHistory, setLoadingHistory] = useState(false);

	const fetchHistory = async () => {
		if (!historyDateStart || !historyDateEnd) return;
		setLoadingHistory(true);
		try {
			const historyRef = collection(db, "stores", historyStore, "stockHistory");
			const q = query(
				historyRef,
				where("timestamp", ">=", Timestamp.fromDate(new Date(historyDateStart))),
				where("timestamp", "<=", Timestamp.fromDate(new Date(historyDateEnd + "T23:59:59"))),
				orderBy("timestamp", "desc"),
			);

			const querySnapshot = await getDocs(q);
			const docs = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as StockSnapshot[];

			setSnapshots(docs);
			if (docs.length >= 2) {
				setSelectedSnapshot1(docs[docs.length - 1].id!); // Mais antigo
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
		if (historyDateStart && historyDateEnd) {
			fetchHistory();
		}
	}, [historyStore, historyDateStart, historyDateEnd]);

	return (
		<div className="space-y-6">
			{/* Filters */}
			<div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap items-center gap-6 justify-center">
				<div className="flex flex-col gap-2">
					<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Loja</span>
					<select
						value={historyStore}
						onChange={(e) => setHistoryStore(e.target.value as StoreId)}
						className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
						{Object.entries(STORE_NAMES).map(([id, name]) => (
							<option key={id} value={id}>{name}</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-2">
					<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Início</span>
					<div className="relative">
						<Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
						<input
							type="date"
							value={historyDateStart}
							onChange={(e) => setHistoryDateStart(e.target.value)}
							className="bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-2">
					<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Fim</span>
					<div className="relative">
						<Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
						<input
							type="date"
							value={historyDateEnd}
							onChange={(e) => setHistoryDateEnd(e.target.value)}
							className="bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
						/>
					</div>
				</div>

				<button
					onClick={fetchHistory}
					disabled={loadingHistory || !historyDateStart || !historyDateEnd}
					className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-black transition-all shadow-md shadow-blue-100 disabled:opacity-50">
					{loadingHistory ? <RefreshCw className="animate-spin" size={18} /> : "BUSCAR"}
				</button>
			</div>

			{snapshots.length > 0 ? (
				<div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
					<div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-6">
						<div className="flex items-center gap-4">
							<div className="flex flex-col gap-1">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comparar de</span>
								<select
									value={selectedSnapshot1}
									onChange={(e) => setSelectedSnapshot1(e.target.value)}
									className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
									{snapshots.map((s) => (
										<option key={s.id} value={s.id}>{formatDate(s.timestamp.toDate())}</option>
									))}
								</select>
							</div>
							<ArrowRight className="text-slate-300 mt-4" size={20} />
							<div className="flex flex-col gap-1">
								<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Para</span>
								<select
									value={selectedSnapshot2}
									onChange={(e) => setSelectedSnapshot2(e.target.value)}
									className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
									{snapshots.map((s) => (
										<option key={s.id} value={s.id}>{formatDate(s.timestamp.toDate())}</option>
									))}
								</select>
							</div>
						</div>
						<div className="text-right">
							<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Loja Selecionada</span>
							<span className="text-lg font-black text-blue-600">{STORE_NAMES[historyStore]}</span>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="bg-slate-50/50 border-b border-slate-200">
									<th className="p-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Item</th>
									<th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Antes</th>
									<th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Depois</th>
									<th className="p-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">Diferença</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(STOCK_LABELS).map(([key, label]) => {
									const s1 = snapshots.find(s => s.id === selectedSnapshot1);
									const s2 = snapshots.find(s => s.id === selectedSnapshot2);
									
									const v1 = s1?.stock[key as keyof StockData] || 0;
									const v2 = s2?.stock[key as keyof StockData] || 0;
									const u1 = s1?.isUnits?.[key as keyof StockData] || false;
									const u2 = s2?.isUnits?.[key as keyof StockData] || false;
									const diff = v2 - v1;

									return (
										<tr key={key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
											<td className="p-6 text-sm font-black text-slate-600 uppercase">{label}</td>
											<td className="p-6 text-center text-lg font-bold text-slate-400">
												{u1 ? "< 1" : v1}
											</td>
											<td className="p-6 text-center text-lg font-bold text-slate-900">
												{u2 ? "< 1" : v2}
											</td>
											<td className="p-6 text-center">
												<div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black ${
													diff > 0 ? "bg-green-50 text-green-600" : 
													diff < 0 ? "bg-red-50 text-red-600" : 
													"bg-slate-50 text-slate-400"
												}`}>
													{diff > 0 && <TrendingUp size={14} />}
													{diff < 0 && <TrendingDown size={14} />}
													{u1 !== u2 ? (u2 ? "Entrou < 1" : "Saiu < 1") : (diff > 0 ? `+${diff}` : diff)}
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
					<div className="bg-white p-20 rounded-[32px] border border-slate-200 shadow-sm text-center">
						<p className="text-slate-400 font-bold">Nenhum snapshot encontrado para o período selecionado.</p>
					</div>
				)
			)}
		</div>
	);
}
