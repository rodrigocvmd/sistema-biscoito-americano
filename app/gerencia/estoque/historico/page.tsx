"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	query,
	orderBy,
	onSnapshot,
	limit,
} from "firebase/firestore";
import { STOCK_LABELS, StockData, formatDate, StockMovement, STORE_NAMES, StoreId } from "@/types";
import {
	RefreshCw,
	History,
	ArrowUpCircle,
	ArrowDownCircle,
	Filter,
	Calendar as CalendarIcon,
	ExternalLink,
	XCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";

export default function GlobalStockHistoryPage() {
	const [selectedStore, setSelectedStore] = useState<StoreId>("conjunto");
	const [loading, setLoading] = useState(true);
	const [movements, setMovements] = useState<StockMovement[]>([]);

	// Filter State
	const [filterItem, setFilterItem] = useState<string>("all");
	const [filterDate, setFilterDate] = useState<string>("");

	// Pagination State
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 20;

	useEffect(() => {
		setLoading(true);
		const movementsRef = collection(db, "stores", selectedStore, "stockMovements");

		// Listen to movements (last 300)
		const qMovements = query(movementsRef, orderBy("timestamp", "desc"), limit(300));
		const unsubMovements = onSnapshot(qMovements, (snapshot) => {
			const docs = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as StockMovement[];
			setMovements(docs);
			setLoading(false);
		});

		return () => unsubMovements();
	}, [selectedStore]);

	const filteredMovements = useMemo(() => {
		setCurrentPage(1); // Reset to first page on filter change
		return movements.filter((m) => {
			const matchesItem = filterItem === "all" || m.itemId === filterItem;
			
			let matchesDate = true;
			if (filterDate && m.timestamp && filterDate.length === 10) {
				const movementDate = m.timestamp.toDate();
				const d = String(movementDate.getDate()).padStart(2, "0");
				const mth = String(movementDate.getMonth() + 1).padStart(2, "0");
				const yr = movementDate.getFullYear();
				const formattedMovementDate = `${d}/${mth}/${yr}`;
				matchesDate = formattedMovementDate === filterDate;
			}

			return matchesItem && matchesDate;
		});
	}, [movements, filterItem, filterDate]);

	const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
	const paginatedMovements = filteredMovements.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	const formatStockCompact = (qty: number, hasOpen: boolean) => {
		if (qty === 0 && !hasOpen) return "0";
		const openText = hasOpen ? " + 1 aberto" : "";
		if (qty === 0 && hasOpen) return "1 aberto";
		return `${qty}${openText}`;
	};

	return (
		<div className="space-y-6">
			{/* Store Selector */}
			<div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl w-fit">
				{(Object.entries(STORE_NAMES) as [StoreId, string][]).map(([id, name]) => (
					<button
						key={id}
						onClick={() => setSelectedStore(id)}
						className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
							selectedStore === id
								? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
								: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
						}`}
					>
						{name.toUpperCase()}
					</button>
				))}
			</div>

			{/* History Section */}
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-1">
					<h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
						<History className="text-slate-400 dark:text-slate-600" size={20} />
						Histórico de Movimentações - {STORE_NAMES[selectedStore]}
					</h3>
					
					{/* Filters */}
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative group">
							<Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
							<select
								value={filterItem}
								onChange={(e) => setFilterItem(e.target.value)}
								className="pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
							>
								<option value="all">TODOS OS ITENS</option>
								{Object.entries(STOCK_LABELS).sort((a,b) => a[1].localeCompare(b[1])).map(([id, label]) => (
									<option key={id} value={id}>{label}</option>
								))}
							</select>
							<ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
						</div>

						<div className="relative">
							<CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
							<input
								type="text"
								placeholder="DD/MM/AAAA"
								maxLength={10}
								value={filterDate}
								onChange={(e) => {
									let val = e.target.value.replace(/\D/g, '');
									if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
									if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5, 9);
									setFilterDate(val);
								}}
								className="pl-9 pr-3 py-2 w-[130px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
							/>
						</div>

						{(filterItem !== "all" || filterDate !== "") && (
							<button
								onClick={() => { setFilterItem("all"); setFilterDate(""); }}
								className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
								title="Limpar filtros"
							>
								<RefreshCw size={14} />
							</button>
						)}
					</div>
				</div>
				
				<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px]">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
							<RefreshCw className="animate-spin mb-4" size={32} />
							<p className="font-bold text-sm">Carregando movimentações...</p>
						</div>
					) : (
						<>
							<div className="overflow-x-auto">
								<table className="w-full border-collapse">
									<thead>
										<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-left">
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Data / Hora</th>
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item</th>
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Tipo</th>
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Qtd</th>
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Antes</th>
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Atual</th>
											<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Obs</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{paginatedMovements.length > 0 ? (
											paginatedMovements.map((m) => (
												<tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
													<td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-400 dark:text-slate-500">
														{formatDate(m.timestamp?.toDate())}
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-md font-black text-slate-700 dark:text-slate-200 uppercase">
														{m.itemName}
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center">
														<span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase ${
															m.type === 'recebido' 
																? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
																: m.type === 'saida'
																	? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
																	: m.type === 'abertura'
																		? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
																		: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
														}`}>
															{m.type === 'recebido' ? <ArrowDownCircle size={12} /> : m.type === 'saida' ? <ArrowUpCircle size={12} /> : m.type === 'abertura' ? <ExternalLink size={12} /> : <XCircle size={12} />}
															{m.type === 'recebido' ? 'recebido' : m.type === 'saida' ? 'saída' : m.type === 'abertura' ? 'pacote aberto' : 'pacote finalizado'}
														</span>
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center text-lg font-black text-slate-600 dark:text-slate-200">
														{m.quantity}
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center text-lg font-bold text-slate-500 dark:text-slate-400">
														{m.beforeStock !== undefined ? formatStockCompact(m.beforeStock, m.beforeOpen || false) : "-"}
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center text-lg font-black text-slate-800 dark:text-white">
														{m.afterStock !== undefined ? formatStockCompact(m.afterStock, m.afterOpen || false) : "-"}
													</td>
													<td className="px-6 py-4 text-md font-medium text-slate-500 dark:text-slate-300 max-w-xs truncate">
														{m.obs || "-"}
													</td>
												</tr>
											))
										) : (
											<tr>
												<td colSpan={7} className="px-6 py-10 text-center text-slate-400 dark:text-slate-600 font-medium">
													Nenhuma movimentação encontrada para esta loja.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
									<p className="text-xs font-bold text-slate-500">
										Mostrando <span className="text-slate-700 dark:text-slate-300">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="text-slate-700 dark:text-slate-300">{Math.min(currentPage * itemsPerPage, filteredMovements.length)}</span> de <span className="text-slate-700 dark:text-slate-300">{filteredMovements.length}</span> movimentações
									</p>
									<div className="flex items-center gap-2">
										<button
											onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
											disabled={currentPage === 1}
											className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
										>
											<ChevronLeft size={20} />
										</button>
										<div className="flex items-center gap-1">
											{Array.from({ length: totalPages }, (_, i) => i + 1)
												.filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
												.map((p, i, arr) => (
													<div key={p} className="flex items-center gap-1">
														{i > 0 && arr[i-1] !== p - 1 && <span className="text-slate-400">...</span>}
														<button
															onClick={() => setCurrentPage(p)}
															className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
																currentPage === p
																	? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
																	: "text-slate-500 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
															}`}
														>
															{p}
														</button>
													</div>
												))}
										</div>
										<button
											onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
											disabled={currentPage === totalPages}
											className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
										>
											<ChevronRight size={20} />
										</button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</section>
		</div>
	);
}
