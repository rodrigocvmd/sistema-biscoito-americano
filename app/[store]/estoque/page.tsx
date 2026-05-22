"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	addDoc,
	updateDoc,
	doc,
	query,
	orderBy,
	onSnapshot,
	serverTimestamp,
	limit,
} from "firebase/firestore";
import { STOCK_LABELS, StockData, formatDate, StockMovement } from "@/types";
import {
	Plus,
	CheckCircle2,
	RefreshCw,
	ChevronDown,
	History,
	AlertCircle,
	ArrowUpCircle,
	ArrowDownCircle,
	MessageSquare,
	Filter,
	Calendar as CalendarIcon,
	ExternalLink,
	XCircle,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";

export default function StockMovementsPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [movements, setMovements] = useState<StockMovement[]>([]);
	const [stock, setStock] = useState<Partial<StockData>>({});
	const [isUnits, setIsUnits] = useState<Partial<Record<keyof StockData, boolean>>>({});

	// Movement Form State
	const [selectedItemId, setSelectedItemId] = useState<keyof StockData | "">("");
	const [searchTerm, setSearchTerm] = useState("");
	const [type, setType] = useState<"recebido" | "saida">("recebido");
	const [quantity, setQuantity] = useState<number>(1);
	const [obs, setObs] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	// Abertura Form State
	const [openItemId, setOpenItemId] = useState<keyof StockData | "">("");
	const [openSearchTerm, setOpenSearchTerm] = useState("");
	const [openObs, setOpenObs] = useState("");
	const [openSubmitting, setOpenSubmitting] = useState(false);
	const [finishSubmitting, setFinishSubmitting] = useState(false);
	const [openMessage, setOpenMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	// Filter State
	const [filterItem, setFilterItem] = useState<string>("all");
	const [filterDate, setFilterDate] = useState<string>("");

	// Pagination State
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 20;

	// Combobox State
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isOpenDropdownOpen, setIsOpenDropdownOpen] = useState(false);

	const normalizeString = (str: string) =>
		str
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");

	const filteredItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][])
		.filter(([_, label]) => normalizeString(label).includes(normalizeString(searchTerm)))
		.sort((a, b) => a[1].localeCompare(b[1]));

	const filteredOpenItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][])
		.filter(([_, label]) => normalizeString(label).includes(normalizeString(openSearchTerm)))
		.sort((a, b) => a[1].localeCompare(b[1]));

	useEffect(() => {
		const storeRef = doc(db, "stores", store);
		const movementsRef = collection(db, "stores", store, "stockMovements");

		// Listen to stock
		const unsubStock = onSnapshot(storeRef, (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data();
				setStock(data.stock || {});
				setIsUnits(data.isUnits || {});
			}
		});

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

		return () => {
			unsubStock();
			unsubMovements();
		};
	}, [store]);

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

	const handleAddMovement = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedItemId || quantity <= 0) return;

		setSubmitting(true);
		setMessage(null);
		try {
			const storeRef = doc(db, "stores", store);
			const movementsRef = collection(db, "stores", store, "stockMovements");
			const historyRef = collection(db, "stores", store, "stockHistory");

			const beforeStock = stock[selectedItemId] || 0;
			const afterStock = type === "recebido" ? beforeStock + quantity : beforeStock - quantity;
			const currentOpenStatus = isUnits[selectedItemId] || false;

			const newStock = { ...stock, [selectedItemId]: afterStock };

			await updateDoc(storeRef, {
				[`stock.${selectedItemId}`]: afterStock,
				lastStockUpdate: serverTimestamp(),
			});

			await addDoc(movementsRef, {
				itemId: selectedItemId,
				itemName: STOCK_LABELS[selectedItemId],
				type,
				quantity,
				beforeStock,
				afterStock,
				beforeOpen: currentOpenStatus,
				afterOpen: currentOpenStatus,
				obs: obs.trim(),
				timestamp: serverTimestamp(),
			});

			// Save full snapshot for history comparison
			await addDoc(historyRef, {
				stock: newStock,
				isUnits: isUnits,
				timestamp: serverTimestamp(),
			});

			setMessage({ type: "success", text: "Movimentação registrada com sucesso!" });
			setSelectedItemId("");
			setSearchTerm("");
			setQuantity(1);
			setObs("");
			setTimeout(() => setMessage(null), 3000);
		} catch (error) {
			console.error("Erro ao registrar movimentação:", error);
			setMessage({ type: "error", text: "Erro ao salvar movimentação." });
		} finally {
			setSubmitting(false);
		}
	};

	const handleRegisterOpening = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!openItemId) return;

		const currentQty = stock[openItemId] || 0;
		if (currentQty <= 0) {
			setOpenMessage({ type: "error", text: "Estoque insuficiente para abrir um pacote." });
			return;
		}

		setOpenSubmitting(true);
		setOpenMessage(null);
		try {
			const storeRef = doc(db, "stores", store);
			const movementsRef = collection(db, "stores", store, "stockMovements");
			const historyRef = collection(db, "stores", store, "stockHistory");

			const beforeStock = currentQty;
			const afterStock = currentQty - 1;
			const beforeOpen = isUnits[openItemId] || false;

			const newStock = { ...stock, [openItemId]: afterStock };
			const newIsUnits = { ...isUnits, [openItemId]: true };

			// Logic: Subtract 1 package and set isUnits to true
			await updateDoc(storeRef, {
				[`stock.${openItemId}`]: afterStock,
				[`isUnits.${openItemId}`]: true,
				lastStockUpdate: serverTimestamp(),
			});

			await addDoc(movementsRef, {
				itemId: openItemId,
				itemName: STOCK_LABELS[openItemId],
				type: "abertura",
				quantity: 1,
				beforeStock,
				afterStock,
				beforeOpen,
				afterOpen: true,
				obs: openObs.trim(),
				timestamp: serverTimestamp(),
			});

			// Save full snapshot for history comparison
			await addDoc(historyRef, {
				stock: newStock,
				isUnits: newIsUnits,
				timestamp: serverTimestamp(),
			});

			setOpenMessage({ type: "success", text: "Abertura registrada com sucesso!" });
			setOpenItemId("");
			setOpenSearchTerm("");
			setOpenObs("");
			setTimeout(() => setOpenMessage(null), 3000);
		} catch (error) {
			console.error("Erro ao registrar abertura:", error);
			setOpenMessage({ type: "error", text: "Erro ao registrar abertura." });
		} finally {
			setOpenSubmitting(false);
		}
	};

	const handleFinishPackage = async () => {
		if (!openItemId) return;

		const hasOpen = isUnits[openItemId] || false;
		if (!hasOpen) return;

		setFinishSubmitting(true);
		setOpenMessage(null);
		try {
			const storeRef = doc(db, "stores", store);
			const movementsRef = collection(db, "stores", store, "stockMovements");
			const historyRef = collection(db, "stores", store, "stockHistory");

			const currentQty = stock[openItemId] || 0;
			const newIsUnits = { ...isUnits, [openItemId]: false };

			// Logic: Set isUnits to false (package finished)
			await updateDoc(storeRef, {
				[`isUnits.${openItemId}`]: false,
				lastStockUpdate: serverTimestamp(),
			});

			await addDoc(movementsRef, {
				itemId: openItemId,
				itemName: STOCK_LABELS[openItemId],
				type: "fechamento",
				quantity: 1,
				beforeStock: currentQty,
				afterStock: currentQty,
				beforeOpen: true,
				afterOpen: false,
				obs: openObs.trim(),
				timestamp: serverTimestamp(),
			});

			// Save full snapshot for history comparison
			await addDoc(historyRef, {
				stock: stock,
				isUnits: newIsUnits,
				timestamp: serverTimestamp(),
			});

			setOpenMessage({ type: "success", text: "Consumo de pacote finalizado!" });
			setOpenItemId("");
			setOpenSearchTerm("");
			setOpenObs("");
			setTimeout(() => setOpenMessage(null), 3000);
		} catch (error) {
			console.error("Erro ao finalizar pacote:", error);
			setOpenMessage({ type: "error", text: "Erro ao finalizar pacote." });
		} finally {
			setFinishSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando movimentações...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Tab Switcher */}
			<div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
				<Link
					href={`/${store}/estoque`}
					className="px-6 py-2.5 bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 rounded-xl text-sm font-black shadow-sm transition-all">
					Estoque (Movimentação)
				</Link>
				<Link
					href={`/${store}/estoque2`}
					className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-sm font-black transition-all">
					Contagem Atual
				</Link>
			</div>

			{/* Opening Section */}
			<section className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
				<h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
					<ExternalLink className="text-blue-600 dark:text-blue-500" size={24} />
					Registrar Abertura ou Fim de Pacote
				</h2>

				<div className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
						{/* Item Selection */}
						<div className="space-y-1 relative md:col-span-1 lg:col-span-2">
							<label className="font-bold text-slate-400 dark:text-slate-500 ml-1">
								Sabor / Item
							</label>
							<div className="relative">
								<input
									type="text"
									required
									placeholder="BUSCAR SABOR..."
									value={openSearchTerm || (openItemId ? STOCK_LABELS[openItemId] : "")}
									onFocus={() => setIsOpenDropdownOpen(true)}
									onBlur={() => setTimeout(() => setIsOpenDropdownOpen(false), 200)}
									onChange={(e) => {
										setOpenSearchTerm(e.target.value.toUpperCase());
										setOpenItemId("");
										setIsOpenDropdownOpen(true);
									}}
									autoComplete="off"
									className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:font-medium uppercase"
								/>
								<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none">
									<ChevronDown size={18} />
								</div>

								{isOpenDropdownOpen && (
									<div className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
										{filteredOpenItems.length > 0 ? (
											filteredOpenItems.map(([id, label]) => (
												<div
													key={id}
													onMouseDown={(e) => {
														e.preventDefault();
														setOpenItemId(id);
														setOpenSearchTerm("");
														setIsOpenDropdownOpen(false);
													}}
													className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between group">
													<div className="flex flex-col">
														<span className="text-lg">{label}</span>
														{isUnits[id] && (
															<span className="text-[14px] text-orange-500 font-black uppercase">
																Já possui 1 aberto
															</span>
														)}
													</div>
													<span className="text-[14px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
														{formatStockCompact(stock[id] || 0, isUnits[id] || false)} em estoque
													</span>
												</div>
											))
										) : (
											<div className="px-4 py-4 text-center text-xs font-bold text-slate-400">
												NENHUM SABOR ENCONTRADO
											</div>
										)}
									</div>
								)}
							</div>
						</div>

						{/* Open Button */}
						<button
							onClick={handleRegisterOpening}
							disabled={openSubmitting || !openItemId || (stock[openItemId] || 0) <= 0}
							className="bg-blue-600 hover:bg-blue-700 text-white font-black h-[50px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
							{openSubmitting ? (
								<RefreshCw className="animate-spin" size={20} />
							) : (
								<ExternalLink size={20} />
							)}
							{openSubmitting ? "ABRINDO..." : "ABRIR PACOTE"}
						</button>

						{/* Finish Button */}
						<button
							onClick={handleFinishPackage}
							disabled={finishSubmitting || !openItemId || !isUnits[openItemId]}
							className="bg-slate-700 hover:bg-slate-800 text-white font-black h-[50px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
							{finishSubmitting ? (
								<RefreshCw className="animate-spin" size={20} />
							) : (
								<XCircle size={20} />
							)}
							{finishSubmitting ? "FINALIZANDO..." : "FINALIZAR 1 ABERTO"}
						</button>
					</div>

					{/* Observations */}
					<div className="space-y-1">
						<label className="font-bold text-slate-400 dark:text-slate-500 ml-1 flex items-center gap-1">
							<MessageSquare size={12} /> Observações (Opcional)
						</label>
						<textarea
							value={openObs}
							onChange={(e) => setOpenObs(e.target.value)}
							placeholder="Inserir observação caso necessário."
							className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-200 font-medium h-20 resize-none"
						/>
					</div>

					{openMessage && (
						<div
							className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${
								openMessage.type === "success"
									? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
									: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
							}`}>
							<AlertCircle size={18} />
							{openMessage.text}
						</div>
					)}
				</div>
			</section>

			{/* Movement Section */}
			<section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
					<Plus className="text-red-600 dark:text-red-500" size={24} />
					Registrar Movimentação
				</h2>

				<form onSubmit={handleAddMovement} className="space-y-6">
					<div id="registrarMovimentacao" className="grid grid-cols-1 md:grid-cols-8 lg:grid-cols-16 gap-4 items-end">
						{/* Item Selection */}
						<div className="space-y-1 relative lg:col-span-6">
							<label className="font-bold text-slate-400 dark:text-slate-500 ml-1">
								Sabor / Item
							</label>
							<div className="relative">
								<input
									id="buscarSabor"
									type="text"
									required
									placeholder="BUSCAR SABOR..."
									value={searchTerm || (selectedItemId ? STOCK_LABELS[selectedItemId] : "")}
									onFocus={() => setIsDropdownOpen(true)}
									onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
									onChange={(e) => {
										setSearchTerm(e.target.value.toUpperCase());
										setSelectedItemId("");
										setIsDropdownOpen(true);
									}}
									autoComplete="off"
									className="w-full px-4 py-3 h-[50px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:font-medium uppercase"
								/>
								<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none">
									<ChevronDown size={18} />
								</div>

								{isDropdownOpen && (
									<div className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
										{filteredItems.length > 0 ? (
											filteredItems.map(([id, label]) => (
												<div
													key={id}
													onMouseDown={(e) => {
														e.preventDefault();
														setSelectedItemId(id);
														setSearchTerm("");
														setIsDropdownOpen(false);
													}}
													className="px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 cursor-pointer text-lg font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between group">
													{label}
													<span className="text-[14px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pl-5">
														{formatStockCompact(stock[id] || 0, isUnits[id] || false)} em estoque
													</span>
												</div>
											))
										) : (
											<div className="px-4 py-4 text-center text-xs font-bold text-slate-400">
												NENHUM SABOR ENCONTRADO
											</div>
										)}
									</div>
								)}
							</div>
						</div>

						{/* Type Toggle */}
						<div className="space-y-1 lg:col-span-4">
							<label className="font-bold text-slate-400 dark:text-slate-500 ml-1">
								Tipo de Movimento
							</label>
							<div id="tipoDeMovimento" className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[50px]">
								<button
									type="button"
									onClick={() => setType("recebido")}
									className={`flex-1 flex items-center justify-center gap-2 rounded-lg font-black	 transition-all ${
										type === "recebido"
											? "bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm"
											: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
									}`}>
									<ArrowUpCircle size={28} />
									RECEBIDO
								</button>
								<button
									type="button"
									onClick={() => setType("saida")}
									className={`flex-1 flex items-center justify-center gap-2 rounded-lg font-black transition-all ${
										type === "saida"
											? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm"
											: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
									}`}>
									<ArrowDownCircle size={28} />
									SAÍDA
								</button>
							</div>
						</div>

						{/* Quantity Select */}
						<div className="space-y-1 lg:col-span-3">
							<label className="font-bold text-slate-400 dark:text-slate-500 ml-1">
								Quantidade (Pacotes)
							</label>
							<div className="relative">
								<select
									value={quantity}
									onChange={(e) => setQuantity(parseInt(e.target.value))}
									className="w-full px-4 py-3 h-[50px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-black appearance-none cursor-pointer text-xl">
									{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
										<option key={n} value={n}>
											{n} {n === 1 ? "Pacote" : "Pacotes"}
										</option>
									))}
								</select>
								<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
									<ChevronDown size={18} />
								</div>
							</div>
						</div>

						{/* Submit Button */}
						<button
							type="submit"
							disabled={submitting || !selectedItemId}
							className="bg-green-600 hover:bg-green-700 text-white font-black h-[50px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed lg:col-span-3">
							{submitting ? (
								<RefreshCw className="animate-spin" size={20} />
							) : (
								<CheckCircle2 size={20} />
							)}
							{submitting ? "SALVANDO..." : "REGISTRAR"}
						</button>
					</div>

					{/* Observations */}
					<div className="space-y-1">
						<label className="font-bold text-slate-400 dark:text-slate-500 ml-1 flex items-center gap-1">
							<MessageSquare size={12} /> Observações (Opcional)
						</label>
						<textarea
							value={obs}
							onChange={(e) => setObs(e.target.value)}
							placeholder="Inserir observação caso necessário."
							className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-medium h-20 resize-none"
						/>
					</div>

					{message && (
						<div
							className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold ${
								message.type === "success"
									? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
									: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
							}`}>
							<AlertCircle size={18} />
							{message.text}
						</div>
					)}
				</form>
			</section>

			

			{/* History Section */}
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-1">
					<h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
						<History className="text-slate-400 dark:text-slate-600" size={20} />
						Histórico de Movimentações
					</h3>

					{/* Filters */}
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative group">
							<Filter
								size={14}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
							/>
							<select
								value={filterItem}
								onChange={(e) => setFilterItem(e.target.value)}
								className="pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 appearance-none focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer">
								<option value="all">TODOS OS ITENS</option>
								{Object.entries(STOCK_LABELS)
									.sort((a, b) => a[1].localeCompare(b[1]))
									.map(([id, label]) => (
										<option key={id} value={id}>
											{label}
										</option>
									))}
							</select>
							<ChevronDown
								size={14}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
							/>
						</div>

						<div className="relative">
							<CalendarIcon
								size={14}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
							/>
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
								className="pl-9 pr-3 py-2 w-[130px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
							/>
						</div>

						{(filterItem !== "all" || filterDate !== "") && (
							<button
								onClick={() => {
									setFilterItem("all");
									setFilterDate("");
								}}
								className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
								title="Limpar filtros">
								<RefreshCw size={14} />
							</button>
						)}
					</div>
				</div>

				<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-left">
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
										Data / Hora
									</th>
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
										Item
									</th>
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
										Tipo
									</th>
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
										Qtd
									</th>
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
										Antes
									</th>
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
										Atual
									</th>
									<th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
										Obs
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
								{paginatedMovements.length > 0 ? (
									paginatedMovements.map((m) => (
										<tr
											key={m.id}
											className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
											<td className="px-6 py-4 whitespace-nowrap font-bold text-slate-400 dark:text-slate-500">
												{formatDate(m.timestamp?.toDate())}
											</td>
											<td className="px-6 py-4 whitespace-nowrap font-black text-slate-700 dark:text-slate-200 uppercase">
												{m.itemName}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-center">
												<span
													className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase ${
														m.type === "recebido"
															? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
															: m.type === "saida"
																? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
																: m.type === "abertura"
																	? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
																	: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
													}`}>
													{m.type === "recebido" ? (
														<ArrowDownCircle size={12} />
													) : m.type === "saida" ? (
														<ArrowUpCircle size={12} />
													) : m.type === "abertura" ? (
														<ExternalLink size={12} />
													) : (
														<XCircle size={12} />
													)}
													{m.type === "recebido"
														? "recebido"
														: m.type === "saida"
															? "saída"
															: m.type === "abertura"
																? "pacote aberto"
																: "pacote finalizado"}
												</span>
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-center font-black text-slate-700 dark:text-slate-200">
												{m.quantity}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-center font-bold text-slate-400 dark:text-slate-500">
												{m.beforeStock !== undefined
													? formatStockCompact(m.beforeStock, m.beforeOpen || false)
													: "-"}
											</td>
											<td className="px-6 py-4 whitespace-nowrap text-center font-black text-blue-600 dark:text-blue-400">
												{m.afterStock !== undefined
													? formatStockCompact(m.afterStock, m.afterOpen || false)
													: "-"}
											</td>
											<td className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 max-w-xs truncate">
												{m.obs || "-"}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td
											colSpan={7}
											className="px-6 py-10 text-center text-slate-400 dark:text-slate-600 font-medium">
											Nenhuma movimentação encontrada com os filtros selecionados.
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
															? "bg-red-600 text-white shadow-md shadow-red-500/20"
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
				</div>
			</section>
		</div>
	);
}
