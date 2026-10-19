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
	const [showDelivered, setShowDelivered] = useState(false);
	const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
	const [editingOrder, setEditingOrder] = useState<{
		id: string;
		name: string;
		urgency: UrgencyLevel;
		quantity: string;
	} | null>(null);
	const [savingEdit, setSavingEdit] = useState(false);
	const [sortOrder, setSortOrder] = useState<"urgency" | "date" | "alphabetical">("urgency");

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

		// Query for Pending
		const qPending = query(
			ordersRef,
			where("status", "==", "pending"),
			orderBy("createdAt", "desc"),
		);

		// Query for Delivered or Cancelled (last 28 days / 4 weeks)
		const twentyEightDaysAgo = new Date();
		twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

		const qDelivered = query(
			ordersRef,
			where("status", "in", ["delivered", "cancelled"]),
			where("deliveredAt", ">=", Timestamp.fromDate(twentyEightDaysAgo)),
			orderBy("deliveredAt", "desc"),
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
			setDeliveredOrders(orders);
		});

		return () => {
			unsubscribePending();
			unsubscribeDelivered();
		};
	}, [store]);

	const handleAddOrder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newName.trim()) return;

		setAdding(true);
		try {
			const ordersRef = collection(db, "stores", store, "supplyOrders");
			await addDoc(ordersRef, {
				name: newName.trim().toUpperCase(),
				quantity: newQuantity.trim(),
				urgency: isUrgent ? "Urgente" : "Normal",
				status: "pending",
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

	const handleMarkAsDelivered = async (orderId: string) => {
		try {
			const orderRef = doc(db, "stores", store, "supplyOrders", orderId);
			const deliveredAt = new Date();
			const expireAt = new Date();
			expireAt.setDate(deliveredAt.getDate() + 14);

			await updateDoc(orderRef, {
				status: "delivered",
				deliveredAt: Timestamp.fromDate(deliveredAt),
				expireAt: Timestamp.fromDate(expireAt),
			});
		} catch (error) {
			console.error("Erro ao marcar como entregue:", error);
		}
	};

	const handleCancelOrder = async () => {
		if (!orderToCancel) return;
		try {
			const orderRef = doc(db, "stores", store, "supplyOrders", orderToCancel);
			const cancelledAt = new Date();
			const expireAt = new Date();
			expireAt.setDate(cancelledAt.getDate() + 14);

			await updateDoc(orderRef, {
				status: "cancelled",
				deliveredAt: Timestamp.fromDate(cancelledAt),
				expireAt: Timestamp.fromDate(expireAt),
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
								className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:font-medium uppercase text-sm"
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

					{/* Botão Adicionar */}
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

								return (
									<div
										key={order.id}
										className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
											isPendingSupply
												? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 shadow-sm opacity-80"
												: isUrgentItem
												? "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/60 shadow-sm"
												: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm"
										}`}>
										<div className="flex-1 min-w-0">
											<div className="flex flex-wrap items-center gap-2 mb-2">
												<span className="text-lg font-black text-slate-800 dark:text-slate-200 truncate">
													{order.name}
												</span>
												{isPendingSupply && (
													<span className="flex items-center gap-1 bg-amber-500 text-white px-2.5 py-0.5 rounded-md text-[0.6875rem] font-black uppercase tracking-wider shadow-xs">
														<Clock size={12} /> Aguardando reposição
													</span>
												)}
												{isUrgentItem && !isPendingSupply && (
													<span className="flex items-center gap-1 bg-red-600 text-white px-2.5 py-0.5 rounded-md text-[0.6875rem] font-black uppercase tracking-wider shadow-xs animate-pulse">
														<AlertTriangle size={12} /> Urgente
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
													{formatDate(order.createdAt?.toDate())}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-2 shrink-0 sm:w-auto w-full">
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

											<button
												onClick={() => handleMarkAsDelivered(order.id)}
												className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white px-4 py-3 rounded-2xl font-black text-sm transition-all border border-emerald-200 dark:border-emerald-800/50 cursor-pointer active:scale-95 shadow-xs">
												<CheckCircle2 size={16} />
												Recebido
											</button>
										</div>
									</div>
								);
							})}
					</div>
				)}
			</section>

			{/* Seção de Insumos Entregues / Finalizados */}
			<section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
				<button
					onClick={() => setShowDelivered(!showDelivered)}
					className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer group">
					<h3 className="text-base font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
						<CheckCircle2
							className={`${showDelivered ? "text-emerald-500" : "text-slate-300 dark:text-slate-700"}`}
							size={20}
						/>
						({deliveredOrders.length}) Insumos Finalizados (Últimas 4 Semanas)
					</h3>
					<span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300">
						{showDelivered ? "Esconder" : "Mostrar"}
					</span>
				</button>

				{showDelivered && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-75 dark:opacity-80 animate-in fade-in slide-in-from-top-2 duration-300">
						{deliveredOrders.map((order) => (
							<div
								key={order.id}
								className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
									order.status === "cancelled"
										? "bg-red-50/60 dark:bg-red-900/10 border-red-200 dark:border-red-900/30"
										: "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
								}`}>
								<div className="min-w-0 flex-1">
									<p
										className={`text-sm font-bold truncate ${
											order.status === "cancelled"
												? "text-red-700 dark:text-red-400"
												: "text-slate-700 dark:text-slate-300 line-through decoration-slate-400"
										}`}>
										{order.name}
										{order.quantity && ` (${order.quantity})`}
										{order.status === "cancelled" && " (CANCELADO)"}
									</p>
									<p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">
										{order.status === "cancelled" ? "Cancelado em: " : "Entregue em: "}
										{formatDate(order.deliveredAt?.toDate())}
									</p>
								</div>
								<div
									className={`shrink-0 ${
										order.status === "cancelled"
											? "text-red-500 dark:text-red-400"
											: "text-emerald-600 dark:text-emerald-400"
									}`}>
									{order.status === "cancelled" ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
								</div>
							</div>
						))}
						{deliveredOrders.length === 0 && (
							<p className="col-span-full text-sm text-slate-400 dark:text-slate-500 italic py-4 text-center">
								Nenhum insumo finalizado nas últimas 4 semanas.
							</p>
						)}
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
		</div>
	);
}
