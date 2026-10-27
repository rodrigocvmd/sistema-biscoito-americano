"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	addDoc,
	updateDoc,
	doc,
	query,
	where,
	orderBy,
	onSnapshot,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import {
	SupplyOrder,
	UrgencyLevel,
	formatDate,
	formatOnlyDate,
	STORE_NAMES,
	StoreId,
} from "@/types";
import {
	Plus,
	CheckCircle2,
	AlertTriangle,
	Calendar,
	Package,
	Trash2,
	RefreshCw,
	ChevronDown,
	Edit2,
	X,
	Tag,
	Clock,
	Minus,
	Search,
	Check,
	Filter,
} from "lucide-react";

import { use } from "react";
import { INVENTORY_DATA } from "@/lib/insumos-data";

export default function SuppliesPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [pendingOrders, setPendingOrders] = useState<SupplyOrder[]>([]);
	const [deliveredOrders, setDeliveredOrders] = useState<SupplyOrder[]>([]);

	// Form State
	const [newName, setNewName] = useState("");
	const [newQuantity, setNewQuantity] = useState("");
	const [isUrgent, setIsUrgent] = useState(false);
	const [adding, setAdding] = useState(false);
	const [showDelivered, setShowDelivered] = useState(true);
	const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
	const [editingOrder, setEditingOrder] = useState<{
		id: string;
		name: string;
		urgency: UrgencyLevel;
		quantity: string;
	} | null>(null);
	const [duplicateModalOrder, setDuplicateModalOrder] = useState<SupplyOrder | null>(null);
	const [savingEdit, setSavingEdit] = useState(false);
	const [sortOrder, setSortOrder] = useState<"urgency" | "date" | "alphabetical">("urgency");

	// Estados de Busca e Filtro no Histórico
	const [historySearch, setHistorySearch] = useState("");
	const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "delivered" | "cancelled">("all");

	// Persistir ordenação no localStorage da loja
	useEffect(() => {
		const savedSort = localStorage.getItem("biscoito_store_insumos_sort");
		if (savedSort === "urgency" || savedSort === "date" || savedSort === "alphabetical") {
			setSortOrder(savedSort);
		}
	}, []);

	useEffect(() => {
		localStorage.setItem("biscoito_store_insumos_sort", sortOrder);
	}, [sortOrder]);

	// Combobox State
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const normalizeString = (str: string) =>
		str
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");

	const filteredInventory = INVENTORY_DATA.map((cat) => ({
		...cat,
		items: cat.items
			.filter((item) => normalizeString(item).includes(normalizeString(newName)))
			.filter(
				(item) =>
					!pendingOrders.some((order) => normalizeString(order.name) === normalizeString(item)),
			),
	})).filter((cat) => cat.items.length > 0);

	// Listener de Insumos Pendentes e Entregues
	useEffect(() => {
		const ordersRef = collection(db, "stores", store, "supplyOrders");

		// Query para Insumos Pendentes
		const qPending = query(
			ordersRef,
			where("status", "==", "pending"),
			orderBy("createdAt", "desc"),
		);

		// Query para Insumos Finalizados (Entregues e Cancelados) - sem limite de data para acumular indefinidamente
		const qDelivered = query(
			ordersRef,
			where("status", "in", ["delivered", "cancelled"]),
		);

		const unsubscribePending = onSnapshot(qPending, (snapshot) => {
			const orders = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as SupplyOrder[];
			setPendingOrders(orders);
			setLoading(false);
		});

		const unsubscribeDelivered = onSnapshot(qDelivered, (snapshot) => {
			const orders = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as SupplyOrder[];
			// Ordena por data de entrega/criação decrescente na memória
			orders.sort((a, b) => {
				const timeA = a.deliveredAt?.toMillis() || a.createdAt?.toMillis() || 0;
				const timeB = b.deliveredAt?.toMillis() || b.createdAt?.toMillis() || 0;
				return timeB - timeA;
			});
			setDeliveredOrders(orders);
		});

		return () => {
			unsubscribePending();
			unsubscribeDelivered();
		};
	}, [store]);

	const handleAddOrder = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = newName.trim();
		if (!trimmedName) return;

		// Verifica se o insumo já está na lista de pendentes
		const existingOrder = pendingOrders.find(
			(o) => normalizeString(o.name) === normalizeString(trimmedName),
		);

		if (existingOrder) {
			setDuplicateModalOrder(existingOrder);
			return;
		}

		setAdding(true);
		try {
			const ordersRef = collection(db, "stores", store, "supplyOrders");
			await addDoc(ordersRef, {
				name: trimmedName.toUpperCase(),
				quantity: newQuantity.trim(),
				urgency: isUrgent ? "Urgente" : "Normal",
				status: "pending",
				checkedByGerencia: false,
				isPendingSupply: false,
				createdAt: serverTimestamp(),
			});

			setNewName("");
			setNewQuantity("");
			setIsUrgent(false);
			setIsDropdownOpen(false);
		} catch (error) {
			console.error("Erro ao adicionar insumo:", error);
			alert("Erro ao adicionar insumo. Tente novamente.");
		} finally {
			setAdding(false);
		}
	};

	const handleCancelOrder = async () => {
		if (!orderToCancel) return;
		try {
			const orderRef = doc(db, "stores", store, "supplyOrders", orderToCancel);
			const cancelledAt = new Date();

			await updateDoc(orderRef, {
				status: "cancelled",
				deliveredAt: Timestamp.fromDate(cancelledAt),
			});
			setOrderToCancel(null);
		} catch (error) {
			console.error("Erro ao cancelar pedido:", error);
		}
	};

	const handleSaveEditOrder = async () => {
		if (!editingOrder) return;
		setSavingEdit(true);
		try {
			const orderRef = doc(db, "stores", store, "supplyOrders", editingOrder.id);
			await updateDoc(orderRef, {
				urgency: editingOrder.urgency,
				quantity: editingOrder.quantity.trim(),
			});
			setEditingOrder(null);
		} catch (error) {
			console.error("Erro ao atualizar insumo:", error);
			alert("Erro ao atualizar insumo.");
		} finally {
			setSavingEdit(false);
		}
	};

	// Cálculo de filtro dos últimos 3 meses ou busca indefinida
	const threeMonthsAgo = new Date();
	threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
	const threeMonthsThreshold = threeMonthsAgo.getTime();

	const isSearchingHistory = historySearch.trim() !== "";
	const normalizedHistorySearch = normalizeString(historySearch);

	const filteredHistoricalOrders = deliveredOrders.filter((order) => {
		// Filtro de status
		if (historyStatusFilter !== "all" && order.status !== historyStatusFilter) {
			return false;
		}

		// Se o usuário digitou na busca, pesquisa indefinidamente em todo o histórico
		if (isSearchingHistory) {
			return normalizeString(order.name).includes(normalizedHistorySearch);
		}

		// Se não há termo de busca, exibe apenas os insumos dos últimos 3 meses
		const orderTime = order.deliveredAt?.toMillis() || order.createdAt?.toMillis() || 0;
		return orderTime >= threeMonthsThreshold;
	});

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p className="font-bold">Carregando insumos...</p>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Mensagem Minimalista e Objetiva de Cronograma */}
			<div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-4 sm:p-5 flex items-center gap-3.5 shadow-xs">
				<div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
					<Calendar size={20} />
				</div>
				<div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
					<span className="font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide mr-1.5">
						Aviso de Cronograma:
					</span>
					Os pedidos de insumos da semana devem ser realizados até{" "}
					<strong className="font-black text-slate-900 dark:text-white underline decoration-amber-400 decoration-2">
						segunda-feira
					</strong>
					. As entregas dos insumos serão realizadas na{" "}
					<strong className="font-black text-slate-900 dark:text-white underline decoration-amber-400 decoration-2">
						terça-feira
					</strong>
					.
				</div>
			</div>

			{/* Form de Solicitação de Insumo */}
			<section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
					<Plus className="text-emerald-600 dark:text-emerald-500" size={24} />
					Solicitar Novo Insumo
				</h2>
				<form onSubmit={handleAddOrder} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
					{/* Campo Insumo */}
					<div className="space-y-1 md:col-span-6 relative">
						<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
							Insumo *
						</label>
						<div className="relative">
							<input
								id="listaInsumos"
								type="text"
								required
								placeholder="BUSCAR OU DIGITAR INSUMO..."
								value={newName}
								onFocus={() => setIsDropdownOpen(true)}
								onBlur={() => setTimeout(() => setIsDropdownOpen(false), 250)}
								onChange={(e) => {
									setNewName(e.target.value.toUpperCase());
									setIsDropdownOpen(true);
								}}
								autoComplete="off"
								className="w-full h-[50px] px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:font-medium uppercase text-sm"
							/>
							<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
								<ChevronDown size={18} />
							</div>

							{/* Dropdown Results */}
							{isDropdownOpen && (
								<div className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
									{filteredInventory.length > 0
										? filteredInventory.map((category) => (
												<div key={category.category}>
													<div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-y border-slate-100 dark:border-slate-800 first:border-t-0">
														{category.category}
													</div>
													{category.items.map((item) => (
														<div
															key={item}
															onMouseDown={(e) => {
																e.preventDefault();
																setNewName(item);
																setIsDropdownOpen(false);
															}}
															className="px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between group">
															{item}
															<Plus
																size={14}
																className="opacity-0 group-hover:opacity-100 transition-opacity"
															/>
														</div>
													))}
												</div>
											))
										: newName.trim() !== "" && (
												<div className="px-4 py-4 text-center">
													<p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
														Adicionar item personalizado:
													</p>
													<p className="text-sm font-black text-red-600 dark:text-red-400 mt-1">
														&quot;{newName}&quot;
													</p>
												</div>
											)}
								</div>
							)}
						</div>
					</div>

					{/* Campo Quantidade (Opcional com botões +/-) */}
					<div className="space-y-1 md:col-span-2">
						<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
							Qtd (opcional)
						</label>
						<div className="flex items-center justify-between w-full h-[50px] px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
							<button
								type="button"
								onClick={() => {
									const cur = parseInt(newQuantity, 10);
									if (isNaN(cur) || cur <= 1) {
										setNewQuantity("");
									} else {
										setNewQuantity((cur - 1).toString());
									}
								}}
								disabled={!newQuantity || parseInt(newQuantity, 10) <= 0}
								className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer transition-all">
								<Minus size={16} />
							</button>

							<span className="text-sm font-black text-slate-800 dark:text-slate-100 select-none">
								{newQuantity ? newQuantity : <span className="text-slate-400 font-bold text-xs">-</span>}
							</span>

							<button
								type="button"
								onClick={() => {
									const cur = parseInt(newQuantity, 10);
									if (isNaN(cur) || cur <= 0) {
										setNewQuantity("1");
									} else {
										setNewQuantity((cur + 1).toString());
									}
								}}
								className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer transition-all">
								<Plus size={16} />
							</button>
						</div>
					</div>

					{/* Botão de Urgente */}
					<div className="space-y-1 md:col-span-2">
						<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
							Prioridade
						</label>
						<button
							type="button"
							onClick={() => setIsUrgent(!isUrgent)}
							className={`w-full h-[50px] rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
								isUrgent
									? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md shadow-red-200 dark:shadow-none animate-pulse"
									: "bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-red-600 hover:border-red-300"
							}`}>
							<AlertTriangle size={16} />
							<span>{isUrgent ? "🚨 Urgente" : "Urgente?"}</span>
						</button>
					</div>

					{/* Botão Solicitar */}
					<div className="md:col-span-2">
						<button
							type="submit"
							disabled={adding || !newName.trim()}
							className="cursor-pointer w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black h-[50px] rounded-2xl shadow-md shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-base active:scale-95">
							{adding ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
							Solicitar
						</button>
					</div>
				</form>
			</section>

			{/* Lista de Insumos Pendentes */}
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
						<Package className="text-slate-400 dark:text-slate-600" size={20} />
						Insumos Solicitados Pendentes ({pendingOrders.length})
					</h3>

					{pendingOrders.length > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-[11px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
								Ordenar:
							</span>
							<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
								{[
									{ id: "urgency", label: "Prioridade" },
									{ id: "date", label: "Data" },
									{ id: "alphabetical", label: "Alfabética" },
								].map((sort) => (
									<button
										key={sort.id}
										onClick={() => setSortOrder(sort.id as any)}
										className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
											sortOrder === sort.id
												? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm"
												: "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										{sort.label}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				{pendingOrders.length === 0 ? (
					<div className="bg-slate-100/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center">
						<Package className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
						<p className="text-slate-500 dark:text-slate-400 font-bold">
							Nenhum insumo pendente no momento.
						</p>
						<p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
							Utilize o formulário acima para solicitar insumos quando necessário.
						</p>
					</div>
				) : (
					<div className="grid md:grid-cols-2 gap-4">
						{[...pendingOrders]
							.sort((a, b) => {
								if (sortOrder === "alphabetical") {
									return a.name.localeCompare(b.name, "pt-BR");
								}
								if (sortOrder === "urgency") {
									const isUrgentA = a.urgency === "Urgente" ? 1 : 0;
									const isUrgentB = b.urgency === "Urgente" ? 1 : 0;
									if (isUrgentB !== isUrgentA) return isUrgentB - isUrgentA;
									return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
								}
								if (sortOrder === "date") {
									return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
								}
								return 0;
							})
							.map((order) => {
								const isUrgentItem = order.urgency === "Urgente";
								const isPendingSupply = !!order.isPendingSupply;
								const isChecked = !!order.checkedByGerencia;

								return (
									<div
										key={order.id}
										className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
											isPendingSupply
												? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 shadow-sm opacity-80"
												: isUrgentItem
												? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 shadow-sm"
												: isChecked
												? "bg-blue-50/30 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 shadow-sm"
												: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
										}`}>
										<div className="flex-1 min-w-0">
											<div className="flex flex-wrap items-center gap-2 mb-2">
												<span className="text-lg font-black text-slate-800 dark:text-slate-200 truncate">
													{order.name}
												</span>

												{isPendingSupply && (
													<span className="flex items-center gap-1 bg-amber-500 text-white px-2.5 py-0.5 rounded-md text-[0.6875rem] font-black uppercase tracking-wider shadow-xs">
														Sem Estoque
													</span>
												)}

												{isUrgentItem && !isPendingSupply && (
													<span className="flex items-center gap-1 bg-red-600 text-white px-2.5 py-0.5 rounded-md text-[0.6875rem] font-black uppercase tracking-wider shadow-xs animate-pulse">
														<AlertTriangle size={12} /> Urgente
													</span>
												)}

												{isChecked && (
													<span className="flex items-center gap-1 bg-blue-600 text-white px-2.5 py-0.5 rounded-md text-[0.6875rem] font-black uppercase tracking-wider shadow-xs">
														<Check size={12} strokeWidth={3} /> Separado pela gerência
													</span>
												)}
											</div>

											<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
												{order.quantity && (
													<span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black">
														<Tag size={12} className="text-slate-400" />
														Qtd: {order.quantity}
													</span>
												)}
												<span className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
													<Calendar size={13} />
													Pedido em: {formatDate(order.createdAt?.toDate())}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-2 shrink-0 sm:w-auto w-full justify-end">
											<button
												onClick={() =>
													setEditingOrder({
														id: order.id,
														name: order.name,
														urgency: order.urgency,
														quantity: order.quantity || "",
													})
												}
												className="flex items-center justify-center p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
												title="Editar pedido">
												<Edit2 size={16} />
											</button>

											<button
												onClick={() => setOrderToCancel(order.id)}
												className="flex items-center justify-center p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-2xl transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
												title="Cancelar pedido">
												<Trash2 size={16} />
											</button>
										</div>
									</div>
								);
							})}
					</div>
				)}
			</section>

			{/* Seção de Histórico de Insumos (3 Meses e Pesquisa Indefinida) */}
			<section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<button
						onClick={() => setShowDelivered(!showDelivered)}
						className="flex items-center gap-2 text-left cursor-pointer group">
						<CheckCircle2
							className={`${showDelivered ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`}
							size={22}
						/>
						<div>
							<h3 className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-200">
								Histórico de Insumos ({filteredHistoricalOrders.length})
							</h3>
							<p className="text-xs text-slate-400 font-medium">
								{isSearchingHistory
									? "Pesquisando em todo o histórico acumulado"
									: "Insumos entregues e finalizados nos últimos 3 meses"}
							</p>
						</div>
					</button>

					{showDelivered && (
						<div className="flex items-center gap-2">
							<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
								<button
									onClick={() => setHistoryStatusFilter("all")}
									className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
										historyStatusFilter === "all"
											? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
											: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
									}`}>
									Todos
								</button>
								<button
									onClick={() => setHistoryStatusFilter("delivered")}
									className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
										historyStatusFilter === "delivered"
											? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
											: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
									}`}>
									Entregues
								</button>
								<button
									onClick={() => setHistoryStatusFilter("cancelled")}
									className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
										historyStatusFilter === "cancelled"
											? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-xs"
											: "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
									}`}>
									Cancelados
								</button>
							</div>
						</div>
					)}
				</div>

				{showDelivered && (
					<div className="space-y-4">
						{/* Barra de Pesquisa de Insumos no Histórico */}
						<div className="relative">
							<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
							<input
								type="text"
								placeholder="Pesquisar insumo no histórico (busca em todo o período acumulado)..."
								value={historySearch}
								onChange={(e) => setHistorySearch(e.target.value)}
								className="w-full h-[46px] pl-11 pr-10 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
							/>
							{historySearch && (
								<button
									onClick={() => setHistorySearch("")}
									className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
									<X size={16} />
								</button>
							)}
						</div>

						{/* Grid com Insumos do Histórico */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-in fade-in duration-200">
							{filteredHistoricalOrders.map((order) => {
								const isCancelled = order.status === "cancelled";
								const isUrgentItem = order.urgency === "Urgente";

								return (
									<div
										key={order.id}
										className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
											isCancelled
												? "bg-red-50/50 dark:bg-red-950/15 border-red-200 dark:border-red-900/30"
												: "bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80"
										}`}>
										<div>
											<div className="flex items-start justify-between gap-2 mb-1.5">
												<span
													className={`text-base font-black uppercase break-words leading-tight ${
														isCancelled
															? "text-red-800 dark:text-red-300 line-through decoration-red-400"
															: "text-slate-800 dark:text-slate-200"
													}`}>
													{order.name}
												</span>

												<div className="flex items-center gap-1 shrink-0">
													{isCancelled ? (
														<span className="flex items-center gap-1 bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-md text-[0.625rem] font-black uppercase tracking-wider border border-red-200 dark:border-red-900/50">
															Cancelado
														</span>
													) : (
														<span className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[0.625rem] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-900/50">
															<CheckCircle2 size={12} /> Entregue
														</span>
													)}
												</div>
											</div>

											<div className="flex flex-wrap items-center gap-2">
												{order.quantity && (
													<span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
														Qtd: {order.quantity}
													</span>
												)}
												{isUrgentItem && (
													<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
														Urgente
													</span>
												)}
											</div>
										</div>

										<div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
											<span className="flex items-center gap-1">
												<Calendar size={12} />
												Pedido: {formatDate(order.createdAt?.toDate())}
											</span>
											<span>
												{isCancelled ? "Cancelado em: " : "Entregue em: "}
												{formatDate(order.deliveredAt?.toDate())}
											</span>
										</div>
									</div>
								);
							})}

							{filteredHistoricalOrders.length === 0 && (
								<div className="col-span-full py-10 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
									<p className="text-sm text-slate-400 dark:text-slate-500 font-bold">
										{isSearchingHistory
											? `Nenhum insumo encontrado para "${historySearch}" em todo o histórico.`
											: "Nenhum insumo finalizado nos últimos 3 meses."}
									</p>
									<p className="text-xs text-slate-400 mt-1">
										{isSearchingHistory
											? "Tente buscar com outro termo."
											: "Utilize a caixa de busca acima para pesquisar pedidos de datas anteriores."}
									</p>
								</div>
							)}
						</div>
					</div>
				)}
			</section>

			{/* Modal de Cancelamento */}
			{orderToCancel && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<AlertTriangle size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center mb-2">
							Confirmar Cancelamento
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium text-sm mb-8">
							Tem certeza que deseja cancelar esta solicitação de insumo? Ela será movida para o histórico como cancelada.
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={handleCancelOrder}
								className="cursor-pointer w-full bg-red-600 hover:bg-red-700 text-white font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-red-100 dark:shadow-none">
								Sim, cancelar pedido
							</button>
							<button
								onClick={() => setOrderToCancel(null)}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black py-3.5 rounded-2xl transition-all">
								Não, manter
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Modal de Edição de Insumo (Urgência e Quantidade) */}
			{editingOrder && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
									<Edit2 size={20} />
								</div>
								<div>
									<h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
										Editar Insumo
									</h3>
									<p className="text-xs text-slate-400 font-bold uppercase truncate max-w-[200px]">
										{editingOrder.name}
									</p>
								</div>
							</div>
							<button
								onClick={() => setEditingOrder(null)}
								className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
								<X size={20} />
							</button>
						</div>

						<div className="space-y-4 mb-6">
							<div>
								<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
									Quantidade (opcional)
								</label>
								<div className="flex items-center justify-between w-full h-[50px] px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
									<button
										type="button"
										onClick={() => {
											const cur = parseInt(editingOrder.quantity, 10);
											if (isNaN(cur) || cur <= 1) {
												setEditingOrder({ ...editingOrder, quantity: "" });
											} else {
												setEditingOrder({ ...editingOrder, quantity: (cur - 1).toString() });
											}
										}}
										disabled={!editingOrder.quantity || parseInt(editingOrder.quantity, 10) <= 0}
										className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer transition-all">
										<Minus size={16} />
									</button>

									<span className="text-sm font-black text-slate-800 dark:text-slate-100 select-none">
										{editingOrder.quantity ? editingOrder.quantity : <span className="text-slate-400 font-bold text-xs">-</span>}
									</span>

									<button
										type="button"
										onClick={() => {
											const cur = parseInt(editingOrder.quantity, 10);
											if (isNaN(cur) || cur <= 0) {
												setEditingOrder({ ...editingOrder, quantity: "1" });
											} else {
												setEditingOrder({ ...editingOrder, quantity: (cur + 1).toString() });
											}
										}}
										className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer transition-all">
										<Plus size={16} />
									</button>
								</div>
							</div>

							<div>
								<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
									Prioridade
								</label>
								<button
									type="button"
									onClick={() =>
										setEditingOrder({
											...editingOrder,
											urgency: editingOrder.urgency === "Urgente" ? "Normal" : "Urgente",
										})
									}
									className={`cursor-pointer w-full p-3.5 rounded-2xl font-black text-sm text-left transition-all border-2 flex items-center justify-between ${
										editingOrder.urgency === "Urgente"
											? "border-red-600 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 shadow-xs"
											: "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
									}`}>
									<span className="flex items-center gap-2">
										<AlertTriangle size={18} className={editingOrder.urgency === "Urgente" ? "text-red-600" : "text-slate-400"} />
										{editingOrder.urgency === "Urgente" ? "🚨 Urgente (Prioridade Alta)" : "Prioridade Normal"}
									</span>
									{editingOrder.urgency === "Urgente" && <CheckCircle2 size={16} className="text-red-600" />}
								</button>
							</div>
						</div>

						<div className="flex gap-3">
							<button
								onClick={handleSaveEditOrder}
								disabled={savingEdit}
								className="cursor-pointer flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm">
								{savingEdit ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
								Salvar Alteração
							</button>
							<button
								onClick={() => setEditingOrder(null)}
								disabled={savingEdit}
								className="cursor-pointer px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold py-3.5 rounded-2xl transition-all text-sm">
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Modal de Insumo Já Existente na Lista */}
			{duplicateModalOrder && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<AlertTriangle size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center mb-2">
							Insumo Já na Lista
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium text-sm mb-6">
							O insumo <strong className="text-slate-800 dark:text-slate-100 font-black">&quot;{duplicateModalOrder.name}&quot;</strong> já consta nos pedidos pendentes desta loja.
							<br />
							Deseja editar o pedido dele?
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={() => {
									const orderToEdit = duplicateModalOrder;
									setDuplicateModalOrder(null);
									setEditingOrder({
										id: orderToEdit.id,
										name: orderToEdit.name,
										urgency: orderToEdit.urgency,
										quantity: orderToEdit.quantity || "",
									});
									setNewName("");
									setNewQuantity("");
									setIsUrgent(false);
									setIsDropdownOpen(false);
								}}
								className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2 text-sm">
								<Edit2 size={16} />
								Sim, editar pedido
							</button>
							<button
								onClick={() => setDuplicateModalOrder(null)}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black py-3.5 rounded-2xl transition-all text-sm">
								Não, fechar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
