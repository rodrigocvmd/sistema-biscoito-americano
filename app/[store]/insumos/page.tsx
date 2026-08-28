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
import { SupplyOrder, UrgencyLevel, formatDate, formatOnlyDate } from "@/types";
import {
	Plus,
	CheckCircle2,
	Clock,
	AlertTriangle,
	AlertCircle,
	Info,
	Calendar,
	Package,
	Trash2,
	RefreshCw,
	Hourglass,
	Coffee,
	Search,
	ChevronDown,
	Edit2,
} from "lucide-react";

import { use } from "react";

const INVENTORY_DATA = [
	{
		category: "BEBIDAS E SODAS",
		items: [
			"ÁGUA NORMAL 1 FARDO",
			"ÁGUA NORMAL 2 FARDOS",
			"ÁGUA NORMAL 3 FARDOS",
			"ÁGUA NORMAL 4 FARDOS",
			"ÁGUA COM GÁS 1 FARDO",
			"ÁGUA COM GÁS 2 FARDOS",
			"ÁGUA COM GÁS 3 FARDOS",
			"ÁGUA COM GÁS 4 FARDOS",
			"COCA NORMAL",
			"COCA ZERO",
			"RED BULL NORMAL",
			"RED BULL ZERO",
			"BUBBLE MAÇÃ VERDE",
			"BUBBLE MORANGO",
			"BUBBLE LICHIA",
			"BUBBLE BLUEBERRY",
			"FANTA LARANJA",
			"SODA FRUTAS VERMELHAS",
			"SODA MORANGO",
			"SODA MAÇÃ VERDE",
			"SODA CRAMBERRY",
			"SODA LIMÃO",
			"SODA TANGERINA",
			"SODA PESSEGO",
			"SODA JABUTICABA",
			"SODA BLUEBERRY",
			"SODA CURAÇAO",
			"SODA FRAMBOESA",
			"GATORADE DE LIMÃO"
		],
	},
	{
		category: "INSUMOS E CONFEITARIA",
		items: [
			"SORVETE",
			"NUTELLA",
			"LEITE NINHO",
			"LEITE LÍQUIDO",
			"PÓ DE CACAU 50%",
			"M&M",
			"GRANULADO",
			"CHANTILLY",
			"DOCE DE LEITE",
			"OVOMALTINE CREMOSO",
			"OVOMALTINE CROCANTE",
			"CHOCOLATE PICADO",
			"FLOR DE SAL",
			"BISCOITO LÓTUS",
			"LÓTUS TRITURADO",
			"BISCOITO OREO",
			"CHOCOLATE ALPINO",
			"GELO",
			"BARRA KINDER BUENO",
		],
	},
	{
		category: "CALDAS",
		items: ["CALDA DE FRUTAS VERMELHAS", "CALDA DE CARAMELO", "CALDA CHOCOLATE"],
	},
	{
		category: "CAFETERIA E MATINAL",
		items: [
			"CÁPSULA DE CAFÉ",
			"NESCAFÉ MATINAL SUAVE",
			"PO DE CAPUCCINO",
			"SACHE CHOCOLATE QUENTE",
			"SACHE AÇÚCAR",
			"SACHE ADOÇANTE",
			"MISTURADOR CAFÉ"
		],
	},
	{
		category: "EMBALAGENS E DESCARTÁVEIS",
		items: [
			"SAQUINHO UNITÁRIO",
			"KRAFT P",
			"KRAFT G",
			"CAIXA P",
			"CAIXA G",
			"HAMBURGUEIRA",
			"PAPEL INTERFOLHADO",
			"PAPEL MANTEIGA",
			"SACOLA PLÁSTICA",
			"COPO DE ISOPOR 100ML",
			"COPO DE ISOPOR 180ML",
			"COPO DESCARTÁVEL (200ML)",
			"COPO PARA DELIVERY (CALDA)",
			"COPO TÉRMICO 100 ML",
			"COPO TÉRMICO 180 ML",
			"COPO 300 ML",
			"COPO 400 ML",
			"COPO FLURY",
			"TAMPA 300 ML",
			"TAMPA 400 ML",
			"TAMPA FLURY",
			"CANUDO NORMAL",
			"CANUDO BUBBLE",
			"CANUDO SHAKE",
			"COLHER DESCARTÁVEL",
			"GUARDANAPO",
			"SUPORTE SHAKE",
			"SUPORTE FLURY",
		],
	},
	{
		category: "OPERACIONAL E DELIVERY",
		items: [
			"ETIQUETA VERMELHA",
			"ETIQUETA BRANCA",
			"BILHETE RECADO DELIVERY",
			"BILHETE TELEFONE DELIVERY",
			"BOBINA IMPRESSORA",
			"BOBINA CIELO",
			"ENVELOPE",
			"TROCO",
			"GRAMPO",
			"CLIPE DE PAPEL"
		],
	},
	{
		category: "HIGIENE E SEGURANÇA",
		items: [
			"LUVAS",
			"TOUCA",
			"DESINFETANTE",
			"DETERGENTE",
			"VEJA",
			"ÁLCOOL",
			"SACO DE LIXO",
			"PANO DE PRATO",
			"SABÃO LÍQUIDO",
			"BUCHA",
			"PERFEX",
			"KIBOA",
			"PAPEL TOALHA",
			"PAPEL HIGIÊNICO",
		],
	},
];

export default function SuppliesPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [pendingOrders, setPendingOrders] = useState<SupplyOrder[]>([]);
	const [deliveredOrders, setDeliveredOrders] = useState<SupplyOrder[]>([]);

	// Form State
	const [newName, setNewName] = useState("");
	const [newUrgency, setNewUrgency] = useState<UrgencyLevel>("Acabando");
	const [adding, setAdding] = useState(false);
	const [showDelivered, setShowDelivered] = useState(false);
	const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
	const [editingOrder, setEditingOrder] = useState<{ id: string; urgency: UrgencyLevel } | null>(
		null,
	);
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
				name: newName,
				urgency: newUrgency,
				status: "pending",
				createdAt: serverTimestamp(),
			});

			setNewName("");
			setNewUrgency("Acabando");
		} catch (error) {
			console.error("Erro ao adicionar insumo:", error);
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

	const handleUpdateUrgency = async () => {
		if (!editingOrder) return;
		try {
			const orderRef = doc(db, "stores", store, "supplyOrders", editingOrder.id);
			await updateDoc(orderRef, {
				urgency: editingOrder.urgency,
			});
			setEditingOrder(null);
		} catch (error) {
			console.error("Erro ao atualizar urgência:", error);
		}
	};

	const getUrgencyBadge = (urgency: UrgencyLevel) => {
		switch (urgency) {
			case "Urgente":
				return (
					<span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md text-[0.625rem] font-bold uppercase">
						<AlertTriangle size={12} /> Urgente
					</span>
				);
			case "Acabando":
				return (
					<span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[0.625rem] font-bold uppercase">
						<AlertCircle size={12} /> Acabando
					</span>
				);
			default:
				return (
					<span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[0.625rem] font-bold uppercase">
						<Hourglass size={12} /> Adiantando
					</span>
				);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando insumos...</p>
			</div>
		);
	}

	return (
		<div className="space-y-10">
			{/* Add New Section */}
			<section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
					<Plus className="text-green-600 dark:text-green-500" size={24} />
					Solicitar Novo Insumo
				</h2>
				<form onSubmit={handleAddOrder} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
					<div className="space-y-1 md:col-span-1 relative">
						<label className="text-lg font-bold text-slate-400 dark:text-slate-500 ml-1">
							Insumo
						</label>
						<div className="relative">
							<input
								id="listaInsumos"
								type="text"
								required
								placeholder="BUSCAR OU DIGITAR..."
								value={newName}
								onFocus={() => setIsDropdownOpen(true)}
								onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
								onChange={(e) => {
									setNewName(e.target.value.toUpperCase());
									setIsDropdownOpen(true);
								}}
								autoComplete="off"
								className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:font-medium uppercase"
							/>
							<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none">
								<ChevronDown size={18} />
							</div>

							{/* Dropdown Results */}
							{isDropdownOpen && (
								<div className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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
														Pressione Adicionar para:
													</p>
													<p className="text-sm font-black text-red-600 dark:text-red-400 mt-1">
														"{newName}"
													</p>
												</div>
											)}
								</div>
							)}
						</div>
					</div>
					<div className="space-y-1">
						<label className="text-lg font-bold text-slate-400 dark:text-slate-500 ml-1">
							Urgência
						</label>
						<select
							value={newUrgency}
							onChange={(e) => setNewUrgency(e.target.value as UrgencyLevel)}
							className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 dark:text-slate-200 font-medium appearance-none cursor-pointer text-md">
							<option value="Urgente">🚨 Urgente</option>
							<option value="Acabando">⚠️ Acabando</option>
							<option value="Adiantando">⏳ Adiantando</option>
						</select>
					</div>
					<button
						type="submit"
						disabled={adding}
						className="cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold h-[50px] rounded-xl shadow-md shadow-red-100 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-lg">
						{adding ? <RefreshCw className="animate-spin" size={20} /> : <Plus size={20} />}
						Adicionar
					</button>
				</form>
			</section>

			{/* Pending List */}
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
						<Package className="text-slate-400 dark:text-slate-600" size={20} />
						Insumos Pendentes ({pendingOrders.length})
					</h3>

					{pendingOrders.length > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-[11px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
								Ordenar:
							</span>
							<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
								{[
									{ id: "urgency", label: "Urgência" },
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
					<div className="bg-slate-100/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center">
						<p className="text-slate-400 dark:text-slate-500 font-medium">
							Nenhum insumo pendente no momento.
						</p>
					</div>
				) : (
					<div className="grid md:grid-cols-2 gap-3">
						{[...pendingOrders]
							.sort((a, b) => {
								if (sortOrder === "alphabetical") {
									return a.name.localeCompare(b.name, "pt-BR");
								}
								if (sortOrder === "urgency") {
									const weight: Record<string, number> = {
										Urgente: 3,
										Acabando: 2,
										Adiantando: 1,
									};
									const diff = (weight[b.urgency] || 0) - (weight[a.urgency] || 0);
									if (diff !== 0) return diff;
									return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
								}
								if (sortOrder === "date") {
									// Mais recentes primeiro
									return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
								}
								return 0;
							})
							.map((order) => (
							<div
								key={order.id}
								className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 dark:hover:border-red-900/50 transition-all">
								<div className="flex-1 min-w-0">
									<div className="flex flex-wrap items-center gap-2 mb-2">
										<span className="text-lg font-black text-slate-800 dark:text-slate-200 truncate">
											{order.name}
										</span>
										<div className="shrink-0">{getUrgencyBadge(order.urgency)}</div>
									</div>
									<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
										<span className="flex items-center gap-1.5 text-[0.9rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
											<Calendar size={14} />
											{formatDate(order.createdAt?.toDate())}
										</span>
									</div>
								</div>
								<div className="flex items-center gap-2 shrink-0 sm:w-auto w-full">
									<button
										onClick={() => setEditingOrder({ id: order.id, urgency: order.urgency })}
										className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
										title="Editar urgência">
										<Edit2 size={18} />
									</button>
									<button
										onClick={() => setOrderToCancel(order.id)}
										className="flex items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
										title="Cancelar pedido">
										<Trash2 size={18} />
									</button>
									<button
										onClick={() => handleMarkAsDelivered(order.id)}
										className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white px-4 py-2.5 rounded-xl font-black text-lg transition-all border border-emerald-100 dark:border-emerald-800/50 cursor-pointer active:scale-95 shadow-sm active:shadow-none">
										<CheckCircle2 size={16} />
										Entregue
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* Delivered List (Last 4 weeks) */}
			<section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
				<button
					onClick={() => setShowDelivered(!showDelivered)}
					className="w-full flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer group">
					<h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
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
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60 dark:opacity-70 animate-in fade-in slide-in-from-top-2 duration-300">
						{deliveredOrders.map((order) => (
							<div
								key={order.id}
								className={`p-3 rounded-lg border flex items-center justify-between ${
									order.status === "cancelled"
										? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 opacity-80"
										: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
								}`}>
								<div>
									<p
										className={`text-md font-bold ${
											order.status === "cancelled"
												? "text-red-700 dark:text-red-400"
												: "text-slate-700 dark:text-slate-300 line-through decoration-slate-400 dark:decoration-slate-600"
										}`}>
										{order.name}
										{order.status === "cancelled" && " (CANCELADO)"}
									</p>
									<p className="text-[0.75rem] text-slate-400 dark:text-slate-500 font-bold uppercase">
										{order.status === "cancelled" ? "Cancelado em: " : "Entregue em: "}
										{formatDate(order.deliveredAt?.toDate())}
									</p>
								</div>
								<div
									className={
										order.status === "cancelled"
											? "text-red-500 dark:text-red-400"
											: "text-emerald-600 dark:text-emerald-400"
									}>
									{order.status === "cancelled" ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
								</div>
							</div>
						))}
						{deliveredOrders.length === 0 && (
							<p className="text-sm text-slate-400 dark:text-slate-500 italic ml-1 py-4">
								Nenhuma entrega recente para exibir nas últimas 4 semanas.
							</p>
						)}
					</div>
				)}
			</section>

			{/* Cancellation Modal */}
			{orderToCancel && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<AlertTriangle size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center mb-2">
							Confirmar Cancelamento
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium mb-8">
							Tem certeza que deseja cancelar este pedido de insumo? Ele será movido para o
							histórico como cancelado.
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={handleCancelOrder}
								className="cursor-pointer w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-100 dark:shadow-none">
								Sim, cancelar pedido
							</button>
							<button
								onClick={() => setOrderToCancel(null)}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl transition-all">
								Não, manter pedido
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Edit Urgency Modal */}
			{editingOrder && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<Edit2 size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center mb-2">
							Editar Urgência
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium mb-6">
							Selecione o novo nível de urgência para este insumo.
						</p>

						<div className="space-y-4 mb-8">
							{(["Urgente", "Acabando", "Adiantando"] as UrgencyLevel[]).map((u) => (
								<button
									key={u}
									onClick={() => setEditingOrder({ ...editingOrder, urgency: u })}
									className={`w-full p-4 rounded-2xl font-bold text-left transition-all border-2 ${
										editingOrder.urgency === u
											? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
											: "border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-200 dark:hover:border-slate-600"
									}`}>
									{u === "Urgente"
										? "🚨 Urgente"
										: u === "Acabando"
											? "⚠️ Acabando"
											: "⏳ Adiantando"}
								</button>
							))}
						</div>

						<div className="flex flex-col gap-3">
							<button
								onClick={handleUpdateUrgency}
								className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none">
								Salvar Alteração
							</button>
							<button
								onClick={() => setEditingOrder(null)}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl transition-all">
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
