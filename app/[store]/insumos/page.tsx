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
} from "lucide-react";

import { use } from "react";

const INVENTORY_DATA = [
	{
		category: "BEBIDAS E SODAS",
		items: [
			"ÁGUA NORMAL",
			"ÁGUA COM GÁS",
			"COCA NORMAL",
			"COCA ZERO",
			"BUBBLE MAÇÃ VERDE",
			"BUBBLE MORANGO",
			"BUBBLE LICHIA",
			"BUBBLE BLUEBERRY",
			"SODA FRUTAS VERMELHAS",
			"SODA MORANGO",
			"SODA MAÇÃ VERDE",
			"SODA CRAMBERRY",
			"SODA LIMÃO",
			"SODA MARACUJÁ",
			"XAROPE MORANGO",
			"XAROPE LIMÃO",
			"XAROPE FRAMBOESA",
		],
	},
	{
		category: "INSUMOS E CONFEITARIA",
		items: [
			"SORVETE",
			"NUTELLA",
			"LEITE NINHO",
			"LEITE LÍQUIDO TAMPA PRETA",
			"PÓ DE CACAU",
			"M&M",
			"GRANULADOS MILK",
			"GRANULADO DARK",
			"CHANTILLY",
			"DOCE DE LEITE",
			"SACO NEGRESCO MOÍDO",
			"OVOMALTINE CREMOSO",
			"OVOMALTINE CROCANTE",
			"CHOCOLATE PICADO",
			"FLOR DE SAL",
			"GELO",
		],
	},
	{
		category: "CALDAS",
		items: [
			"CALDA DE MORANGO BATIDA",
			"CALDA DE CARAMELO",
			"CALDA CHOCOLATE DA VINCI",
			"CALDA DECORAR COPO CARAMELO",
			"CALDA DECORAR COPO MORANGO",
			"CALDA DECORAR COPO CHOCOLATE",
		],
	},
	{
		category: "CAFETERIA E MATINAL",
		items: [
			"CÁPSULA DE CAFÉ",
			"COPO PARA CAFÉ",
			"NESCAFÉ MATINAL SUAVE",
			"PO DE CAPUCCINO",
			"SACHE CHOCOLATE QUENTE",
			"CHÁ MATTE",
			"SACHÉ AÇÚCAR NORMAL/ADOÇANTE/MASCAVO",
		],
	},
	{
		category: "EMBALAGENS E DESCARTÁVEIS",
		items: [
			"SAQUINHO UNITÁRIO / COOKIES",
			"KRAFT PEQUENO FINO BALCÃO",
			"KRAFT PEQUENO GROSSO DELIVERY",
			"KRAFT GRANDE",
			"CAIXA PEQUENA",
			"CAIXA GRANDE",
			"HAMBURGUEIRA",
			"PAPEL INTERFOLHADO",
			"PAPEL MANTEIGA",
			"SACOLA PLÁSTICA",
			"COPO DE ISOPOR",
			"COPO DESCARTÁVEL (GERAL)",
			"COPOS PARA CALDA, DELIVERY E POTINHOS",
			"COPO 180 ML",
			"COPO 300 ML COM LOGO",
			"COPO 300 ML SEM LOGO",
			"COPO 400 ML COM LOGO",
			"COPO 400 ML SEM LOGO",
			"TAMPA BOLHA",
			"TAMPA PARA COPO 300 ML SEM FURO",
			"TAMPA PARA COPO 300 ML COM FURO",
			"TAMPA PARA COPO 400 ML SEM FURO",
			"TAMPA PARA COPO 400 ML COM FURO",
			"CANUDO NORMAL",
			"CANUDO BUBBLES",
			"CANUDO SHAKE",
			"COLHER DESCARTÁVEL",
			"GUARDANAPO",
			"SUPORTE SHAKE",
		],
	},
	{
		category: "OPERACIONAL E DELIVERY",
		items: [
			"ETIQUETA VERMELHA",
			"ETIQUETA BRANCA",
			"BILHETE DELIVERY FONDUE",
			"BILHETE RECADO DELIVERY",
			"BILHETE TELEFONE DELIVERY",
			"BOBINA IMPRESSORA",
			"BOBINA CIELO",
			"ENVELOPE",
			"TROCO",
		],
	},
	{
		category: "HIGIENE E SEGURANÇA",
		items: [
			"CAIXA LUVAS",
			"MÁSCARAS",
			"DESINFETANTE",
			"DETERGENTE",
			"VEJA",
			"ÁLCOOL",
			"SACO DE LIXO",
			"PANO DE PRATO",
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
	const [newQuantity, setNewQuantity] = useState("");
	const [adding, setAdding] = useState(false);
	const [showDelivered, setShowDelivered] = useState(false);
	const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

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
		items: cat.items.filter((item) => normalizeString(item).includes(normalizeString(newName))),
	})).filter((cat) => cat.items.length > 0);

	useEffect(() => {
		const ordersRef = collection(db, "stores", store, "supplyOrders");

		// Query for Pending
		const qPending = query(
			ordersRef,
			where("status", "==", "pending"),
			orderBy("createdAt", "desc"),
		);

		// Query for Delivered or Cancelled (last 14 days)
		const fourteenDaysAgo = new Date();
		fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

		const qDelivered = query(
			ordersRef,
			where("status", "in", ["delivered", "cancelled"]),
			where("deliveredAt", ">=", Timestamp.fromDate(fourteenDaysAgo)),
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
				quantity: newQuantity,
				status: "pending",
				createdAt: serverTimestamp(),
			});

			setNewName("");
			setNewQuantity("");
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

	const getUrgencyBadge = (urgency: UrgencyLevel) => {
		switch (urgency) {
			case "Urgente":
				return (
					<span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
						<AlertTriangle size={12} /> Urgente
					</span>
				);
			case "Acabando":
				return (
					<span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
						<AlertCircle size={12} /> Acabando
					</span>
				);
			default:
				return (
					<span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
						<Hourglass size={12} /> Adiantando
					</span>
				);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando insumos...</p>
			</div>
		);
	}

	return (
		<div className="space-y-10">
			{/* Add New Section */}
			<section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
				<h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
					<Plus className="text-green-600" size={24} />
					Solicitar Novo Insumo
				</h2>
				<form onSubmit={handleAddOrder} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
					<div className="space-y-1 md:col-span-1 relative">
						<label className="text-xs font-bold text-slate-400 uppercase ml-1">Insumo</label>
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
								className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 font-bold placeholder:font-medium uppercase"
							/>
							<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
								<ChevronDown size={18} />
							</div>

							{/* Dropdown Results */}
							{isDropdownOpen && (
								<div className="absolute z-50 w-full mt-2 max-h-[300px] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
									{filteredInventory.length > 0 ? (
										filteredInventory.map((category) => (
											<div key={category.category}>
												<div className="px-4 py-2 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-y border-slate-100 first:border-t-0">
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
														className="px-4 py-3 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm font-bold text-slate-700 transition-colors flex items-center justify-between group">
														{item}
														<Plus
															size={14}
															className="opacity-0 group-hover:opacity-100 transition-opacity"
														/>
													</div>
												))}
											</div>
										))
									) : (
										newName.trim() !== "" && (
											<div className="px-4 py-4 text-center">
												<p className="text-xs font-bold text-slate-400 uppercase">
													Pressione Adicionar para:
												</p>
												<p className="text-sm font-black text-red-600 mt-1">"{newName}"</p>
											</div>
										)
									)}
								</div>
							)}
						</div>
					</div>
					<div className="space-y-1">
						<label className="text-xs font-bold text-slate-400 uppercase ml-1">
							Qtd (opcional)
						</label>
						<input
							type="text"
							placeholder="Ex: 5 caixas"
							value={newQuantity}
							onChange={(e) => setNewQuantity(e.target.value)}
							className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 font-medium"
						/>
					</div>
					<div className="space-y-1">
						<label className="text-xs font-bold text-slate-400 uppercase ml-1">Urgência</label>
						<select
							value={newUrgency}
							onChange={(e) => setNewUrgency(e.target.value as UrgencyLevel)}
							className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 font-medium appearance-none cursor-pointer">
							<option value="Urgente">🚨 Urgente</option>
							<option value="Acabando">⚠️ Acabando</option>
							<option value="Adiantando">⏳ Adiantando</option>
						</select>
					</div>
					<button
						type="submit"
						disabled={adding}
						className="cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold h-[50px] rounded-xl shadow-md shadow-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
						{adding ? <RefreshCw className="animate-spin" size={20} /> : <Plus size={20} />}
						Adicionar
					</button>
				</form>
			</section>

			{/* Pending List */}
			<section className="space-y-4">
				<h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 ml-1">
					<Package className="text-slate-400" size={20} />
					Insumos Pendentes ({pendingOrders.length})
				</h3>
				{pendingOrders.length === 0 ? (
					<div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
						<p className="text-slate-400 font-medium">Nenhum insumo pendente no momento.</p>
					</div>
				) : (
					<div className="grid gap-3">
						{pendingOrders.map((order) => (
							<div
								key={order.id}
								className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 transition-all">
								<div className="flex-1 min-w-0">
									<div className="flex flex-wrap items-center gap-2 mb-2">
										<span className="text-lg font-black text-slate-800 truncate">{order.name}</span>
										<div className="shrink-0">{getUrgencyBadge(order.urgency)}</div>
									</div>
									<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
										{order.quantity && (
											<span className="text-md font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100 flex items-center gap-1.5">
												<Package size={14} />
												{order.quantity}
											</span>
										)}
										<span className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
											<Calendar size={14} />
											{formatDate(order.createdAt?.toDate())}
										</span>
									</div>
								</div>
								<div className="flex items-center gap-2 shrink-0 sm:w-auto w-full">
									<button
										onClick={() => setOrderToCancel(order.id)}
										className="flex items-center justify-center p-2.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border border-slate-100 cursor-pointer"
										title="Cancelar pedido">
										<Trash2 size={18} />
									</button>
									<button
										onClick={() => handleMarkAsDelivered(order.id)}
										className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-4 py-2.5 rounded-xl font-black text-xs transition-all border border-emerald-100 cursor-pointer active:scale-95 shadow-sm active:shadow-none">
										<CheckCircle2 size={16} />
										Entregue
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* Delivered List (Last 14 days) */}
			<section className="space-y-4 pt-6 border-t border-slate-200">
				<button
					onClick={() => setShowDelivered(!showDelivered)}
					className="w-full flex items-center justify-between p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer group">
					<h3 className="text-lg font-bold text-slate-500 flex items-center gap-2">
						<CheckCircle2
							className={`${showDelivered ? "text-emerald-500" : "text-slate-300"}`}
							size={20}
						/>
						({deliveredOrders.length}) Insumos Entregues (Últimas 2 Semanas)
					</h3>
					<span className="text-slate-400 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600">
						{showDelivered ? "Esconder" : "Mostrar"}
					</span>
				</button>

				{showDelivered && (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60 animate-in fade-in slide-in-from-top-2 duration-300">
						{deliveredOrders.map((order) => (
							<div
								key={order.id}
								className={`p-3 rounded-lg border flex items-center justify-between ${
									order.status === "cancelled"
										? "bg-red-50 border-red-100 opacity-80"
										: "bg-slate-50 border-slate-200"
								}`}>
								<div>
									<p
										className={`text-md font-bold ${
											order.status === "cancelled"
												? "text-red-700"
												: "text-slate-700 line-through decoration-slate-400"
										}`}>
										{order.name}
										{order.status === "cancelled" && " (CANCELADO)"}
									</p>
									<p className="text-[12px] text-slate-400 font-bold uppercase">
										{order.status === "cancelled" ? "Cancelado em: " : "Entregue em: "}
										{formatDate(order.deliveredAt?.toDate())}
									</p>
								</div>
								<div className={order.status === "cancelled" ? "text-red-500" : "text-emerald-600"}>
									{order.status === "cancelled" ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
								</div>
							</div>
						))}
						{deliveredOrders.length === 0 && (
							<p className="text-sm text-slate-400 italic ml-1 py-4">
								Nenhuma entrega recente para exibir nas últimas 2 semanas.
							</p>
						)}
					</div>
				)}
			</section>

			{/* Cancellation Modal */}
			{orderToCancel && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
						<div className="bg-red-50 text-red-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<AlertTriangle size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 text-center mb-2">
							Confirmar Cancelamento
						</h3>
						<p className="text-slate-500 text-center font-medium mb-8">
							Tem certeza que deseja cancelar este pedido de insumo? Ele será movido para o
							histórico como cancelado.
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={handleCancelOrder}
								className="cursor-pointer w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-100">
								Sim, cancelar pedido
							</button>
							<button
								onClick={() => setOrderToCancel(null)}
								className="cursor-pointer w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all">
								Não, manter pedido
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
