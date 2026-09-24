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
	limit,
} from "firebase/firestore";
import {
	SupplyOrder,
	UrgencyLevel,
	formatDate,
	formatOnlyDate,
	STORE_NAMES,
	StoreId,
	SupplyOrderSnapshot,
} from "@/types";
import { getStoreCycleInfo, formatFullDateBR } from "@/lib/supplies-schedule";
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
	Check,
	X,
	Lock,
	Unlock,
	ListChecks,
	Sparkles,
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
		],
	},
	{
		category: "EMBALAGENS E DESCARTÁVEIS",
		items: [
			"AMERICAN BAG",
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
			"COPO DESCARTÁVEL (180ML)",
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
			"GUARDANAPO",
			"SUPORTE SHAKE",
			"SUPORTE FLURY",
			"COLHER DESCARTÁVEL",
			"MISTURADOR CAFÉ"
		],
	},
	{
		category: "OPERACIONAL E DELIVERY",
		items: [
			"ETIQUETA VERMELHA",
			"ETIQUETA BRANCA",
			"ETIQUETA VALIDADE",
			"BILHETE RECADO DELIVERY",
			"BILHETE TELEFONE DELIVERY",
			"BOBINA IMPRESSORA",
			"BOBINA CIELO",
			"ENVELOPE",
			"TROCO NOTAS",
			"TROCO MOEDAS",
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

	// Cycle and Snapshot State
	const [cycleInfo, setCycleInfo] = useState(() => getStoreCycleInfo(store));
	const [latestSnapshot, setLatestSnapshot] = useState<SupplyOrderSnapshot | null>(null);
	const [isEditingClosedList, setIsEditingClosedList] = useState(false);
	const [confirmCompleteModalOpen, setConfirmCompleteModalOpen] = useState(false);
	const [savingSnapshot, setSavingSnapshot] = useState(false);

	// Atualiza ciclo quando a loja mudar
	useEffect(() => {
		setCycleInfo(getStoreCycleInfo(store));
	}, [store]);

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

	// Listener dos Snapshots de Listas Consolidadas
	useEffect(() => {
		const snapshotsRef = collection(db, "stores", store, "supplyOrderSnapshots");
		const qSnapshots = query(snapshotsRef, orderBy("closedAt", "desc"), limit(10));

		const unsubscribeSnapshots = onSnapshot(
			qSnapshots,
			(snapshot) => {
				const list = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				})) as SupplyOrderSnapshot[];

				if (list.length > 0) {
					// Verifica se existe snapshot salvo para o fechamento deste ciclo
					const currentCycleSnap = list.find((s) => s.cycleClosingDate === cycleInfo.dateKey);
					if (currentCycleSnap) {
						setLatestSnapshot(currentCycleSnap);
					} else {
						setLatestSnapshot(null);
					}
				} else {
					setLatestSnapshot(null);
				}
			},
			(error) => {
				console.error("Erro ao carregar histórico de listas:", error);
			},
		);

		return () => {
			unsubscribeSnapshots();
		};
	}, [store, cycleInfo.dateKey]);

	// Ação de Concluir Lista de Insumos (Salvar Snapshot)
	const handleCompleteOrderList = async () => {
		setSavingSnapshot(true);
		try {
			const snapshotsRef = collection(db, "stores", store, "supplyOrderSnapshots");
			await addDoc(snapshotsRef, {
				storeId: store,
				storeName: STORE_NAMES[store as StoreId] || store,
				cycleClosingDate: cycleInfo.dateKey,
				cycleDeliveryDate: formatFullDateBR(cycleInfo.deliveryDate),
				closedAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
				status: "closed",
				itemsCount: pendingOrders.length,
				items: pendingOrders.map((o) => ({
					id: o.id,
					name: o.name,
					urgency: o.urgency,
					createdAt: o.createdAt || null,
				})),
			});
			setConfirmCompleteModalOpen(false);
			setIsEditingClosedList(false);
		} catch (error) {
			console.error("Erro ao concluir lista de insumos:", error);
			alert("Ocorreu um erro ao salvar o fechamento da lista. Tente novamente.");
		} finally {
			setSavingSnapshot(false);
		}
	};

	// Ação de Atualizar Snapshot após Edição
	const handleSaveEditedSnapshot = async () => {
		if (!latestSnapshot) return;
		setSavingSnapshot(true);
		try {
			const snapRef = doc(db, "stores", store, "supplyOrderSnapshots", latestSnapshot.id);
			await updateDoc(snapRef, {
				itemsCount: pendingOrders.length,
				items: pendingOrders.map((o) => ({
					id: o.id,
					name: o.name,
					urgency: o.urgency,
					createdAt: o.createdAt || null,
				})),
				updatedAt: serverTimestamp(),
				status: "closed",
			});
			setIsEditingClosedList(false);
		} catch (error) {
			console.error("Erro ao salvar alterações da lista:", error);
			alert("Ocorreu um erro ao atualizar a lista salva.");
		} finally {
			setSavingSnapshot(false);
		}
	};

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
			{/* Dynamic Cycle Schedule Banner */}
			<section
				className={`relative overflow-hidden p-6 rounded-3xl border transition-all ${
					cycleInfo.alertVariant === "today"
						? "bg-gradient-to-br from-red-500/10 via-amber-500/10 to-red-500/5 border-red-300 dark:border-red-900/60 shadow-sm"
						: cycleInfo.alertVariant === "tomorrow"
						? "bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border-amber-300 dark:border-amber-900/60 shadow-sm"
						: cycleInfo.alertVariant === "two-days"
						? "bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-blue-500/5 border-blue-200 dark:border-blue-900/50 shadow-sm"
						: "bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800"
				}`}>
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
					<div className="space-y-3 flex-1 min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							{cycleInfo.alertVariant === "today" && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-sm shadow-red-200 dark:shadow-none animate-pulse">
									<AlertCircle size={14} /> Fechamento Hoje
								</span>
							)}
							{cycleInfo.alertVariant === "tomorrow" && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-white shadow-sm">
									<Clock size={14} /> Fechamento Amanhã
								</span>
							)}
							{cycleInfo.alertVariant === "two-days" && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-600 text-white shadow-sm">
									<Calendar size={14} /> Faltam 2 Dias
								</span>
							)}
							{cycleInfo.alertVariant === "normal" && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
									<Calendar size={14} /> Ciclo Semanal
								</span>
							)}

							{latestSnapshot && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
									<CheckCircle2 size={14} /> Lista Concluída ({latestSnapshot.itemsCount} itens)
								</span>
							)}
						</div>

						<div>
							<h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
								{cycleInfo.headline}
							</h2>
							<p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1 font-medium">
								{cycleInfo.subtext}
							</p>
						</div>

						{/* Tags de Data e Entrega */}
						<div className="flex flex-wrap items-center gap-2 pt-1">
							<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-300">
								<Calendar size={14} className="text-red-500" />
								<span>Último dia para pedidos:</span>
								<strong className="text-slate-900 dark:text-white uppercase">{cycleInfo.formattedClosingDate}</strong>
							</div>
							<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-300">
								<Clock size={14} className="text-emerald-600" />
								<span>Entrega:</span>
								<strong className="text-slate-900 dark:text-white uppercase">{cycleInfo.formattedDeliveryDate}</strong>
							</div>
						</div>
					</div>

					{/* Botões contextuais de Ação no Dia de Fechamento */}
					{cycleInfo.isClosingDay && (
						<div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2">
							{!latestSnapshot ? (
								<button
									onClick={() => setConfirmCompleteModalOpen(true)}
									className="cursor-pointer bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black px-6 py-4 rounded-2xl shadow-xl shadow-red-200 dark:shadow-none transition-all flex items-center justify-center gap-2.5 text-base">
									<ListChecks size={22} />
									Concluir lista de insumos
								</button>
							) : !isEditingClosedList ? (
								<button
									onClick={() => setIsEditingClosedList(true)}
									className="cursor-pointer bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-95 text-white font-bold px-5 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-md">
									<Edit2 size={18} />
									Editar insumos pedidos (Adicionar ou Remover)
								</button>
							) : (
								<button
									onClick={handleSaveEditedSnapshot}
									disabled={savingSnapshot}
									className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black px-6 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-100 dark:shadow-none">
									{savingSnapshot ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
									Salvar alterações da lista
								</button>
							)}
						</div>
					)}
				</div>
			</section>

			{/* Add New Section */}
			{latestSnapshot && !isEditingClosedList ? (
				<section className="bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-dashed border-emerald-300 dark:border-emerald-800/60 p-6 md:p-8 rounded-3xl transition-all">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
						<div className="flex items-start sm:items-center gap-4">
							<div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200 dark:shadow-none">
								<Lock size={28} />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
										Lista Concluída para a Entrega Desta Semana
									</h3>
									<span className="hidden sm:inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
										Finalizada
									</span>
								</div>
								<p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
									A lista foi consolidada com {latestSnapshot.itemsCount} itens e já está disponível para o gerente. Se precisar incluir ou retirar algum insumo de última hora, basta clicar abaixo.
								</p>
							</div>
						</div>
						<button
							onClick={() => setIsEditingClosedList(true)}
							className="cursor-pointer whitespace-nowrap bg-emerald-700 hover:bg-emerald-800 text-white font-black px-6 py-4 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-base active:scale-95">
							<Edit2 size={20} />
							Editar insumos pedidos (Adicionar ou Remover)
						</button>
					</div>
				</section>
			) : (
				<section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
					{isEditingClosedList && (
						<div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
									<Edit2 size={20} />
								</div>
								<div>
									<h4 className="font-black text-amber-900 dark:text-amber-200 text-sm">
										Modo de Edição da Lista Concluída Ativado
									</h4>
									<p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
										Adicione ou cancele insumos na lista. Ao terminar, clique em "Salvar alterações da lista".
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2 w-full sm:w-auto">
								<button
									onClick={handleSaveEditedSnapshot}
									disabled={savingSnapshot}
									className="cursor-pointer flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs shadow-md">
									{savingSnapshot ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
									Salvar alterações da lista
								</button>
								<button
									onClick={() => setIsEditingClosedList(false)}
									className="cursor-pointer px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-xs transition-all">
									Fechar edição
								</button>
							</div>
						</div>
					)}
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
			)}

			{/* Pending List */}
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 ml-1">
							<Package className="text-slate-400 dark:text-slate-600" size={20} />
							Insumos Pendentes ({pendingOrders.length})
						</h3>

						{/* Botão de Concluir Lista / Editar junto ao cabeçalho */}
						{cycleInfo.isClosingDay && (
							<div className="ml-2">
								{!latestSnapshot ? (
									<button
										onClick={() => setConfirmCompleteModalOpen(true)}
										className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all shadow-sm">
										<ListChecks size={14} /> Concluir Lista
									</button>
								) : !isEditingClosedList ? (
									<button
										onClick={() => setIsEditingClosedList(true)}
										className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all shadow-sm">
										<Edit2 size={13} /> Editar Insumos
									</button>
								) : (
									<button
										onClick={handleSaveEditedSnapshot}
										disabled={savingSnapshot}
										className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-sm">
										{savingSnapshot ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />} Salvar Lista
									</button>
								)}
							</div>
						)}
					</div>

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

			{/* Modal de Confirmação para Concluir Lista de Insumos */}
			{confirmCompleteModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 mx-auto">
							<ListChecks size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center mb-2">
							Concluir Lista de Insumos?
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium text-sm mb-6">
							Esta ação consolidará a lista de pedidos para a entrega que será feita em{" "}
							<strong className="text-slate-800 dark:text-slate-200 uppercase">{cycleInfo.formattedDeliveryDate}</strong>.
						</p>

						<div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-800 space-y-2">
							<div className="flex items-center justify-between text-sm font-bold">
								<span className="text-slate-500 dark:text-slate-400">Total de insumos na lista:</span>
								<span className="text-slate-800 dark:text-slate-200 text-base">{pendingOrders.length}</span>
							</div>
							<div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-center">
								<div className="p-2 rounded-xl bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
									<p className="text-[10px] font-bold uppercase">Urgente</p>
									<p className="text-lg font-black">{pendingOrders.filter((o) => o.urgency === "Urgente").length}</p>
								</div>
								<div className="p-2 rounded-xl bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
									<p className="text-[10px] font-bold uppercase">Acabando</p>
									<p className="text-lg font-black">{pendingOrders.filter((o) => o.urgency === "Acabando").length}</p>
								</div>
								<div className="p-2 rounded-xl bg-blue-100/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
									<p className="text-[10px] font-bold uppercase">Adiantando</p>
									<p className="text-lg font-black">{pendingOrders.filter((o) => o.urgency === "Adiantando").length}</p>
								</div>
							</div>
						</div>

						<p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-6">
							Após salvar, a lista estará arquivada. Se necessário, você ainda poderá clicar em "Editar insumos pedidos" para alterar qualquer item.
						</p>

						<div className="flex flex-col gap-3">
							<button
								onClick={handleCompleteOrderList}
								disabled={savingSnapshot}
								className="cursor-pointer w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-200 dark:shadow-none flex items-center justify-center gap-2">
								{savingSnapshot ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
								Confirmar e Concluir Lista
							</button>
							<button
								onClick={() => setConfirmCompleteModalOpen(false)}
								disabled={savingSnapshot}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black py-3.5 rounded-2xl transition-all">
								Voltar e Revisar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
