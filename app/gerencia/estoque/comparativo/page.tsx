"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId } from "@/types";
import { RefreshCw, ChevronDown, Package, Search } from "lucide-react";

interface RepositionSnapshotDoc {
	id?: string;
	sessionId?: string;
	type: "inicio" | "fim";
	timestamp: any; // Firestore Timestamp
	stores: Record<
		StoreId,
		{
			stock: Partial<StockData>;
			isUnits: Partial<Record<keyof StockData, number>>;
		}
	>;
}

interface RepositionSession {
	sessionId: string;
	initialSnap: RepositionSnapshotDoc | null;
	finalSnap: RepositionSnapshotDoc;
	timestamp: any; // Timestamp de finalização
}

const STORES: StoreId[] = ["conjunto", "terraco", "lago", "noroeste"];

export default function EstoqueComparativoPage() {
	const [sessions, setSessions] = useState<RepositionSession[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState<string>("");
	const [loadingHistory, setLoadingHistory] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");

	const fetchHistory = async () => {
		setLoadingHistory(true);
		try {
			const snapshotsRef = collection(db, "repositionSnapshots");
			const q = query(
				snapshotsRef,
				orderBy("timestamp", "desc"),
				limit(200)
			);

			const querySnapshot = await getDocs(q);
			const allDocs = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as RepositionSnapshotDoc[];

			// Agrupa snapshots pelo sessionId
			const sessionsMap: Record<string, { initial?: RepositionSnapshotDoc; final?: RepositionSnapshotDoc }> = {};
			allDocs.forEach((doc) => {
				const sId = doc.sessionId;
				if (!sId) return; // Ignora registros antigos ou inconsistentes sem sessionId
				if (!sessionsMap[sId]) sessionsMap[sId] = {};
				if (doc.type === "inicio") sessionsMap[sId].initial = doc;
				if (doc.type === "fim") sessionsMap[sId].final = doc;
			});

			// Filtra e formata as sessões finalizadas
			const parsedSessions: RepositionSession[] = Object.entries(sessionsMap)
				.filter(([_, value]) => value.final !== undefined)
				.map(([sId, value]) => ({
					sessionId: sId,
					initialSnap: value.initial || null,
					finalSnap: value.final!,
					timestamp: value.final!.timestamp,
				}))
				.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

			setSessions(parsedSessions);
			
			if (parsedSessions.length > 0) {
				setSelectedSessionId(parsedSessions[0].sessionId);
			}
		} catch (error) {
			console.error("Erro ao buscar histórico de reposição:", error);
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
	}, []);

	const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId);

	return (
		<div className="space-y-6">
			{loadingHistory ? (
				<div className="flex flex-col items-center justify-center p-12">
					<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
					<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando comparativos...</p>
				</div>
			) : sessions.length > 0 ? (
				<div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
					<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-6">
						<div className="flex flex-col gap-2 min-w-[280px]">
							<span className="text-[0.9rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Selecionar Reposicionamento</span>
							<div className="relative group">
								<select
									value={selectedSessionId}
									onChange={(e) => setSelectedSessionId(e.target.value)}
									className="appearance-none w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-[1rem] font-black text-slate-600 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm">
									{sessions.map((s) => (
										<option key={s.sessionId} value={s.sessionId} className="dark:bg-slate-900">
											{formatHistoryLabel(s.timestamp.toDate())}
										</option>
									))}
								</select>
								<ChevronDown size={14} strokeWidth={3} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 pointer-events-none transition-colors" />
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
									<th className="p-6 text-left text-[1rem] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Item</th>
									{STORES.map((storeId) => (
										<th key={storeId} className="p-6 text-center text-[1rem] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest min-w-[150px]">
											{STORE_NAMES[storeId]}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{(Object.entries(STOCK_LABELS) as [keyof StockData, string][])
									.sort((a, b) => a[1].localeCompare(b[1]))
									.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()))
									.map(([key, label]) => {
										return (
											<tr key={key} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
												<td className="p-6 text-xl font-black text-slate-600 dark:text-slate-300 uppercase">{label}</td>
												{STORES.map((storeId) => {
													const qA = selectedSession?.initialSnap?.stores?.[storeId]?.stock?.[key] ?? 0;
													const qB = selectedSession?.finalSnap?.stores?.[storeId]?.stock?.[key] ?? 0;
													const diff = qB - qA;

													return (
														<td key={storeId} className="p-4 text-center">
															<div className="flex flex-col items-center justify-center">
																<span className="text-2xl font-black text-slate-700 dark:text-slate-300">
																	{qA} → {qB}
																</span>
																{diff !== 0 && (
																	<span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xl font-black ${
																		diff > 0 ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : 
																		"bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
																	}`}>
																		{diff > 0 ? `+${diff}` : diff}
																	</span>
																)}
															</div>
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
			) : (
				<div className="bg-white dark:bg-slate-900 p-20 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm text-center transition-colors">
					<Package className="mx-auto text-slate-300 dark:text-slate-700 mb-4" size={48} />
					<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Nenhum reposicionamento registrado no histórico.</p>
					<p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Inicie e finalize um reposicionamento para gerar registros de comparação.</p>
				</div>
			)}
		</div>
	);
}
