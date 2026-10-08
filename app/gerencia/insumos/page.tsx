"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	query,
	where,
	doc,
	updateDoc,
	collectionGroup,
	Timestamp,
	orderBy,
	limit,
} from "firebase/firestore";
import { STOCK_LABELS, StoreId, STORE_NAMES, SupplyOrder, formatDate, SupplyOrderSnapshot } from "@/types";
import {
	RefreshCw,
	Store,
	ChevronDown,
	ChevronUp,
	Check,
	AlertTriangle,
	AlertCircle,
	Hourglass,
	Package,
	CheckCircle2,
	Trash2,
	ArrowLeftRight,
	Search,
	X,
	GripVertical,
	ArrowUpDown,
	ArrowUpToLine,
	ArrowDownToLine,
	ArrowUp,
	ArrowDown,
	ListChecks,
	Copy,
	ExternalLink,
	Calendar,
	Menu,
	Snowflake,
	Warehouse,
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	pendingOrders: SupplyOrder[];
	historicalOrders: SupplyOrder[];
	orderSnapshots: SupplyOrderSnapshot[];
	activeCount: number;
	deliveringCount: number;
}

const STORE_ORDER: StoreId[] = ["lago", "terraco", "conjunto", "noroeste"];

const INSUMO_CATEGORIES = ["Geladeira", "Garagem", "Loja", "Outros"] as const;
type InsumoCategory = (typeof INSUMO_CATEGORIES)[number];
const SECTION_ORDER: InsumoCategory[] = ["Outros", "Geladeira", "Garagem", "Loja"];

const CATEGORY_CONFIG: Record<
	InsumoCategory,
	{
		label: string;
		icon: any;
		badgeBg: string;
		headerBorder: string;
		headerBg: string;
		textColor: string;
	}
> = {
	Geladeira: {
		label: "Geladeira",
		icon: Snowflake,
		badgeBg: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300",
		headerBorder: "border-cyan-200 dark:border-cyan-800/60",
		headerBg: "bg-cyan-50/70 dark:bg-cyan-950/25",
		textColor: "text-cyan-800 dark:text-cyan-300",
	},
	Garagem: {
		label: "Garagem",
		icon: Warehouse,
		badgeBg: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300",
		headerBorder: "border-amber-200 dark:border-amber-800/60",
		headerBg: "bg-amber-50/70 dark:bg-amber-950/25",
		textColor: "text-amber-800 dark:text-amber-300",
	},
	Loja: {
		label: "Loja",
		icon: Store,
		badgeBg: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300",
		headerBorder: "border-indigo-200 dark:border-indigo-800/60",
		headerBg: "bg-indigo-50/70 dark:bg-indigo-950/25",
		textColor: "text-indigo-800 dark:text-indigo-300",
	},
	Outros: {
		label: "Outros",
		icon: Package,
		badgeBg: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
		headerBorder: "border-slate-200 dark:border-slate-700",
		headerBg: "bg-slate-100/70 dark:bg-slate-800/40",
		textColor: "text-slate-700 dark:text-slate-300",
	},
};

export default function InsumosPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});
	const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
	const [showSnapshotsHistory, setShowSnapshotsHistory] = useState<Record<string, boolean>>({});
	const [selectedSnapshotModal, setSelectedSnapshotModal] = useState<SupplyOrderSnapshot | null>(null);
	const [copiedSnapshotId, setCopiedSnapshotId] = useState<string | null>(null);
	const [insumosSort, setInsumosSort] = useState<"default" | "urgency" | "date" | "alphabetical" | "manual">("urgency");
	const [manualOrderMap, setManualOrderMap] = useState<Record<string, string[]>>({});
	const [searchTerm, setSearchTerm] = useState("");
	const [openMenuOrderId, setOpenMenuOrderId] = useState<string | null>(null);

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
	};

	// Função de ordenação base padrão de acordo com a seleção atual (não-manual)
	const getBaseSortedOrders = (orders: SupplyOrder[], sortType: "default" | "urgency" | "date" | "alphabetical") => {
		return [...orders].sort((a, b) => {
			if (a.checkedByGerencia && !b.checkedByGerencia) return 1;
			if (!a.checkedByGerencia && b.checkedByGerencia) return -1;

			if (sortType === "alphabetical") {
				return a.name.localeCompare(b.name, "pt-BR");
			}
			if (sortType === "urgency") {
				const weight: Record<string, number> = {
					Urgente: 3,
					Acabando: 2,
					Adiantando: 1,
				};
				return (weight[b.urgency] || 0) - (weight[a.urgency] || 0);
			}
			if (sortType === "date") {
				return (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0);
			}
			return 0;
		});
	};

	// Obter a lista final de pedidos de uma loja (aplicando manual se ativo)
	const getStoreDisplayOrders = (store: FullStoreData) => {
		const baseSorted = getBaseSortedOrders(
			store.pendingOrders,
			insumosSort === "manual" ? "urgency" : insumosSort
		);

		if (insumosSort !== "manual" || !manualOrderMap[store.id]) {
			return baseSorted;
		}

		// Ordenação manual: separa pendentes e a entregar
		const pendingList = baseSorted.filter((o) => !o.checkedByGerencia);
		const deliveringList = baseSorted.filter((o) => !!o.checkedByGerencia);

		const orderIds = manualOrderMap[store.id];
		const sortByIds = (list: SupplyOrder[]) => {
			return [...list].sort((a, b) => {
				const idxA = orderIds.indexOf(a.id);
				const idxB = orderIds.indexOf(b.id);
				if (idxA === -1 && idxB === -1) return 0;
				if (idxA === -1) return 1;
				if (idxB === -1) return -1;
				return idxA - idxB;
			});
		};

		return [...sortByIds(pendingList), ...sortByIds(deliveringList)];
	};

	// Estado para drag and drop
	const [draggingItem, setDraggingItem] = useState<{ storeId: StoreId; orderId: string; checked: boolean; category?: string | null } | null>(null);
	const [dragOverItem, setDragOverItem] = useState<string | null>(null);

	// Fechar menu de categoria ao clicar fora
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (openMenuOrderId) {
				const target = e.target as HTMLElement;
				if (!target.closest(`[data-menu-order="${openMenuOrderId}"]`)) {
					setOpenMenuOrderId(null);
				}
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [openMenuOrderId]);

	// Handlers de Drag and Drop
	const handleDragStart = (e: React.DragEvent, storeId: StoreId, orderId: string, isChecked: boolean, category?: string | null) => {
		setDraggingItem({ storeId, orderId, checked: isChecked, category: category || null });
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", orderId);
	};

	const handleDragOver = (e: React.DragEvent, targetOrderId: string, targetChecked: boolean, targetStoreId: StoreId, targetCategory?: string | null) => {
		if (
			draggingItem &&
			draggingItem.storeId === targetStoreId &&
			draggingItem.checked === targetChecked &&
			(draggingItem.category || null) === (targetCategory || null)
		) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			if (dragOverItem !== targetOrderId) {
				setDragOverItem(targetOrderId);
			}
		}
	};

	const handleDragLeave = () => {
		setDragOverItem(null);
	};

	const handleDrop = (e: React.DragEvent, store: FullStoreData, targetOrderId: string, isChecked: boolean) => {
		e.preventDefault();
		setDragOverItem(null);

		if (!draggingItem || draggingItem.storeId !== store.id || draggingItem.orderId === targetOrderId) {
			setDraggingItem(null);
			return;
		}

		const currentOrders = getStoreDisplayOrders(store);
		const sourceOrder = currentOrders.find((o) => o.id === draggingItem.orderId);
		const targetOrder = currentOrders.find((o) => o.id === targetOrderId);
		if (!sourceOrder || !targetOrder) {
			setDraggingItem(null);
			return;
		}

		const sourceCat = sourceOrder.category || null;
		const targetCat = targetOrder.category || null;

		if (sourceCat !== targetCat || isChecked !== !!sourceOrder.checkedByGerencia) {
			setDraggingItem(null);
			return;
		}

		const groupOrders = isChecked
			? currentOrders.filter((o) => !!o.checkedByGerencia)
			: currentOrders.filter((o) => !o.checkedByGerencia && (o.category || null) === targetCat);

		const sourceIndex = groupOrders.findIndex((o) => o.id === draggingItem.orderId);
		const targetIndex = groupOrders.findIndex((o) => o.id === targetOrderId);

		if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
			setDraggingItem(null);
			return;
		}

		const newGroupOrders = [...groupOrders];
		const [movedOrder] = newGroupOrders.splice(sourceIndex, 1);
		newGroupOrders.splice(targetIndex, 0, movedOrder);

		const otherOrders = currentOrders.filter((o) => {
			if (isChecked) return !o.checkedByGerencia;
			return !!o.checkedByGerencia || (o.category || null) !== targetCat;
		});

		const combined = [...otherOrders, ...newGroupOrders];
		const pendingFinal = combined.filter((o) => !o.checkedByGerencia);
		const deliveringFinal = combined.filter((o) => !!o.checkedByGerencia);
		const finalIds = [...pendingFinal.map((o) => o.id), ...deliveringFinal.map((o) => o.id)];

		setManualOrderMap((prev) => {
			const next = { ...prev, [store.id]: finalIds };
			allData.forEach((s) => {
				if (s.id !== store.id && !next[s.id]) {
					next[s.id] = getStoreDisplayOrders(s).map((o) => o.id);
				}
			});
			return next;
		});
		setInsumosSort("manual");
		setDraggingItem(null);
	};

	const handleDragEnd = () => {
		setDraggingItem(null);
		setDragOverItem(null);
	};

	// Reordenar item via botões: topo, subir 1, descer 1, fundo
	const handleReorderOrder = (
		store: FullStoreData,
		orderId: string,
		action: "top" | "up" | "down" | "bottom"
	) => {
		const currentOrders = getStoreDisplayOrders(store);
		const order = currentOrders.find((o) => o.id === orderId);
		if (!order) return;

		const isChecked = !!order.checkedByGerencia;
		const orderCat = order.category || null;

		const groupOrders = isChecked
			? currentOrders.filter((o) => !!o.checkedByGerencia)
			: currentOrders.filter((o) => !o.checkedByGerencia && (o.category || null) === orderCat);

		const currentIndex = groupOrders.findIndex((o) => o.id === orderId);
		if (currentIndex === -1) return;

		let targetIndex = currentIndex;
		if (action === "top") {
			if (currentIndex === 0) return;
			targetIndex = 0;
		} else if (action === "up") {
			if (currentIndex === 0) return;
			targetIndex = currentIndex - 1;
		} else if (action === "down") {
			if (currentIndex === groupOrders.length - 1) return;
			targetIndex = currentIndex + 1;
		} else if (action === "bottom") {
			if (currentIndex === groupOrders.length - 1) return;
			targetIndex = groupOrders.length - 1;
		}

		if (targetIndex === currentIndex) return;

		// Salvar a posição de rolagem exata da janela antes de qualquer alteração no DOM
		const scrollYBefore = typeof window !== "undefined" ? window.scrollY : 0;

		const newGroupOrders = [...groupOrders];
		const [movedOrder] = newGroupOrders.splice(currentIndex, 1);
		newGroupOrders.splice(targetIndex, 0, movedOrder);

		const otherOrders = currentOrders.filter((o) => {
			if (isChecked) return !o.checkedByGerencia;
			return !!o.checkedByGerencia || (o.category || null) !== orderCat;
		});

		const combined = [...otherOrders, ...newGroupOrders];
		const pendingFinal = combined.filter((o) => !o.checkedByGerencia);
		const deliveringFinal = combined.filter((o) => !!o.checkedByGerencia);
		const finalIds = [...pendingFinal.map((o) => o.id), ...deliveringFinal.map((o) => o.id)];

		setManualOrderMap((prev) => {
			const next = { ...prev, [store.id]: finalIds };
			allData.forEach((s) => {
				if (s.id !== store.id && !next[s.id]) {
					next[s.id] = getStoreDisplayOrders(s).map((o) => o.id);
				}
			});
			return next;
		});
		setInsumosSort("manual");

		// No mobile e desktop: focar no card e animar APENAS para os botões "Subir" e "Descer"
		if (action === "up" || action === "down") {
			requestAnimationFrame(() => {
				setTimeout(() => {
					const cardElement = document.getElementById(`order-${store.id}-${orderId}`);
					if (cardElement) {
						cardElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
						cardElement.classList.add("ring-4", "ring-blue-500", "scale-[1.01]");
						setTimeout(() => {
							cardElement.classList.remove("ring-4", "ring-blue-500", "scale-[1.01]");
						}, 450);
					}
				}, 60);
			});
		} else {
			// Para "top" e "bottom": desfocar o elemento ativo e travar o scroll rigorosamente na mesma posição
			if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
			requestAnimationFrame(() => {
				window.scrollTo({ top: scrollYBefore, behavior: "instant" as any });
				setTimeout(() => {
					window.scrollTo({ top: scrollYBefore, behavior: "instant" as any });
				}, 50);
			});
		}
	};

	// Ao trocar para uma ordenação específica, reseta a ordenação manual
	const handleSelectSort = (sort: "default" | "urgency" | "date" | "alphabetical") => {
		setInsumosSort(sort);
		setManualOrderMap({});
		localStorage.removeItem("biscoito_admin_insumos_manual_order");
	};

	// Persistir ordenação
	useEffect(() => {
		const savedSort = localStorage.getItem("biscoito_admin_insumos_sort");
		if (savedSort) setInsumosSort(savedSort as any);
		const savedManual = localStorage.getItem("biscoito_admin_insumos_manual_order");
		if (savedManual) {
			try {
				setManualOrderMap(JSON.parse(savedManual));
			} catch (e) {
				console.error("Erro ao carregar ordem manual de insumos:", e);
			}
		}
	}, []);

	useEffect(() => {
		localStorage.setItem("biscoito_admin_insumos_sort", insumosSort);
	}, [insumosSort]);

	useEffect(() => {
		if (Object.keys(manualOrderMap).length > 0) {
			localStorage.setItem("biscoito_admin_insumos_manual_order", JSON.stringify(manualOrderMap));
		}
	}, [manualOrderMap]);

	const toggleStore = (storeId: string) => {
		setExpandedStores((prev) => ({
			...prev,
			[storeId]: !prev[storeId],
		}));
	};

	const toggleHistory = (storeId: string) => {
		setShowHistory((prev) => ({
			...prev,
			[storeId]: !prev[storeId],
		}));
	};

	const toggleSnapshotsHistory = (storeId: string) => {
		setShowSnapshotsHistory((prev) => ({
			...prev,
			[storeId]: !prev[storeId],
		}));
	};

	const handleCopySnapshot = (snapshot: SupplyOrderSnapshot) => {
		const urgentes = (snapshot.items || []).filter((i) => i.urgency === "Urgente");
		const acabando = (snapshot.items || []).filter((i) => i.urgency === "Acabando");
		const adiantando = (snapshot.items || []).filter((i) => i.urgency === "Adiantando");

		const closedDateStr = snapshot.closedAt?.toDate
			? formatDate(snapshot.closedAt.toDate())
			: snapshot.closedAt
			? formatDate(new Date(snapshot.closedAt))
			: "n/a";

		let text = `📦 *LISTA DE INSUMOS - ${snapshot.storeName.toUpperCase()}*\n`;
		text += `📅 Fechamento: ${snapshot.cycleClosingDate} | Entrega: ${snapshot.cycleDeliveryDate}\n`;
		text += `⏰ Salva em: ${closedDateStr}\n`;
		text += `🔢 Total: ${snapshot.itemsCount} insumos\n\n`;

		if (urgentes.length > 0) {
			text += `🚨 *URGENTE (${urgentes.length}):*\n`;
			urgentes.forEach((item) => {
				text += `• ${item.name}\n`;
			});
			text += `\n`;
		}

		if (acabando.length > 0) {
			text += `⚠️ *ACABANDO (${acabando.length}):*\n`;
			acabando.forEach((item) => {
				text += `• ${item.name}\n`;
			});
			text += `\n`;
		}

		if (adiantando.length > 0) {
			text += `⏳ *ADIANTANDO (${adiantando.length}):*\n`;
			adiantando.forEach((item) => {
				text += `• ${item.name}\n`;
			});
			text += `\n`;
		}

		navigator.clipboard.writeText(text);
		setCopiedSnapshotId(snapshot.id);
		setTimeout(() => setCopiedSnapshotId(null), 2500);
	};

	const handleToggleCheck = async (storeId: string, orderId: string, currentChecked: boolean) => {
		try {
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			const newChecked = !currentChecked;
			const updateData: any = {
				checkedByGerencia: newChecked,
			};
			if (newChecked) {
				updateData.category = null;
			}
			await updateDoc(orderRef, updateData);
		} catch (error) {
			console.error("Erro ao alternar check:", error);
		}
	};

	const handleSetCategory = async (storeId: string, orderId: string, category: string | null) => {
		try {
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			await updateDoc(orderRef, {
				category: category,
			});
			setOpenMenuOrderId(null);
		} catch (error) {
			console.error("Erro ao definir categoria:", error);
		}
	};

	const handleMarkAsDelivered = async (storeId: string, orderId: string) => {
		try {
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
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

	const normalizeUrgency = (
		urgency: string,
	): { label: string; type: "urgente" | "acabando" | "adiantando" } => {
		const u = urgency.toLowerCase();
		if (u.includes("urgente")) return { label: "Urgente", type: "urgente" };
		if (u.includes("acabando") || u.includes("normal"))
			return { label: "Acabando", type: "acabando" };
		return { label: "Adiantando", type: "adiantando" };
	};

	useEffect(() => {
		const storeIds = STORE_ORDER;

		// Query for Pending - CollectionGroup is fine for single field
		const pendingQuery = query(
			collectionGroup(db, "supplyOrders"),
			where("status", "==", "pending"),
		);

		const fourWeeksAgo = new Date();
		fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

		const storePendingData: Record<string, SupplyOrder[]> = {};
		const storeHistoryData: Record<string, SupplyOrder[]> = {};
		const storeSnapshotsData: Record<string, SupplyOrderSnapshot[]> = {};

		const updateAllData = () => {
			setAllData((currentData) => {
				const newFullData = storeIds.map((id) => {
					const sPending = storePendingData[id] || [];
					const sHistory = storeHistoryData[id] || [];
					const sSnapshots = storeSnapshotsData[id] || [];
					const activeCount = sPending.filter((o) => !o.checkedByGerencia).length;
					const deliveringCount = sPending.filter((o) => o.checkedByGerencia === true).length;
					return {
						id,
						name: STORE_NAMES[id],
						pendingOrders: sPending,
						historicalOrders: sHistory,
						orderSnapshots: sSnapshots,
						activeCount,
						deliveringCount,
					};
				});

				if (currentData.length > 0) {
					const currentIdOrder = currentData.map((d) => d.id);
					return currentIdOrder.map((id) => newFullData.find((d) => d.id === id)!);
				}
				return newFullData;
			});
			setLoading(false);
		};

		// 1. Pending Listener (Per store for precise reference matching)
		const pendingUnsubs = storeIds.map((id) => {
			const pendingRef = collection(db, "stores", id, "supplyOrders");
			const qPending = query(pendingRef, where("status", "==", "pending"));

			return onSnapshot(
				qPending,
				(snapshot) => {
					storePendingData[id] = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					})) as SupplyOrder[];
					updateAllData();
				},
				(error) => console.error(`Error fetching pending orders for store ${id}:`, error),
			);
		});

		// 2. History Listeners (Per Store - for exact parity)
		const historyUnsubs = storeIds.map((id) => {
			const historyRef = collection(db, "stores", id, "supplyOrders");
			const qHistory = query(
				historyRef,
				where("status", "in", ["delivered", "cancelled"]),
				where("deliveredAt", ">=", Timestamp.fromDate(fourWeeksAgo)),
				orderBy("deliveredAt", "desc")
			);

			return onSnapshot(qHistory, (snapshot) => {
				storeHistoryData[id] = snapshot.docs.map(doc => ({
					id: doc.id,
					...doc.data()
				})) as SupplyOrder[];
				updateAllData();
			}, (error) => console.error(`Error fetching history for store ${id}:`, error));
		});

		// 3. Snapshots Listeners (Per Store)
		const snapshotUnsubs = storeIds.map((id) => {
			const snapRef = collection(db, "stores", id, "supplyOrderSnapshots");
			const qSnap = query(snapRef, orderBy("closedAt", "desc"), limit(20));

			return onSnapshot(
				qSnap,
				(snapshot) => {
					storeSnapshotsData[id] = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					})) as SupplyOrderSnapshot[];
					updateAllData();
				},
				(error) => console.error(`Error fetching snapshots for store ${id}:`, error),
			);
		});

		return () => {
			pendingUnsubs.forEach(unsub => unsub());
			historyUnsubs.forEach(unsub => unsub());
			snapshotUnsubs.forEach(unsub => unsub());
		};
	}, []);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando insumos...</p>
			</div>
		);
	}

	// Cálculo dos resultados de busca de insumos em pedidos pendentes e a entregar
	const searchResults = (() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return [];

		// Mapeia por nome de insumo quais lojas têm pedidos
		const resultsMap = new Map<string, { storeId: StoreId; storeName: string; orderId: string; checked: boolean }[]>();

		allData.forEach((store) => {
			store.pendingOrders.forEach((order) => {
				if (order.name.toLowerCase().includes(term)) {
					const existing = resultsMap.get(order.name) || [];
					existing.push({
						storeId: store.id,
						storeName: store.name,
						orderId: order.id,
						checked: !!order.checkedByGerencia,
					});
					resultsMap.set(order.name, existing);
				}
			});
		});

		return Array.from(resultsMap.entries()).map(([itemName, stores]) => ({
			itemName,
			stores,
		}));
	})();

	const handleGoToOrder = (storeId: StoreId, orderId: string) => {
		// Abre o toggle da loja
		setExpandedStores((prev) => ({ ...prev, [storeId]: true }));

		// Aguarda o render e rola até o pedido
		setTimeout(() => {
			const element = document.getElementById(`order-${storeId}-${orderId}`);
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "center" });
				element.classList.add("ring-4", "ring-blue-500", "scale-[1.02]");
				setTimeout(() => {
					element.classList.remove("ring-4", "ring-blue-500", "scale-[1.02]");
				}, 2000);
			}
		}, 150);
	};

	return (
		<div className="space-y-8">
			{/* Barra de Pesquisa de Insumos */}
			<div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-all">
				<div className="relative flex-1 group">
					<Search
						size={20}
						className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
					/>
					<input
						type="text"
						placeholder="Pesquisar insumo nos pedidos pendentes e a entregar..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-10 text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-inner"
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
							title="Limpar busca">
							<X size={16} />
						</button>
					)}
				</div>

				{/* Resultados da Busca */}
				{searchTerm.trim() && (
					<div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
						{searchResults.length > 0 ? (
							<div className="space-y-2.5">
								<p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
									Lojas com pedido de &quot;{searchTerm}&quot; (clique para abrir):
								</p>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{searchResults.map(({ itemName, stores }) => (
										<div
											key={itemName}
											className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
											<div className="flex items-center gap-2">
												<Package size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
												<span className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
													{itemName}
												</span>
											</div>
											<div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
												{stores.map((s, idx) => (
													<button
														key={`${s.storeId}-${s.orderId}-${idx}`}
														onClick={() => handleGoToOrder(s.storeId, s.orderId)}
														className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 text-xs md:text-sm font-black border border-slate-200 dark:border-slate-600 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all">
														<span className="text-slate-800 dark:text-slate-200">{s.storeName}</span>
														<span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md ${s.checked ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400" : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"}`}>
															{s.checked ? "A entregar" : "Pendente"}
														</span>
													</button>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="py-4 text-center">
								<p className="text-sm font-bold text-slate-400 dark:text-slate-500">
									Nenhum pedido pendente ou a entregar encontrado para &quot;{searchTerm}&quot;.
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			<div className="flex justify-center items-center pt-2">
				<button
					onClick={rotateStores}
					className="cursor-pointer flex items-center gap-3 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-800 px-6 py-3 rounded-2xl font-black shadow-sm transition-all text-xs uppercase tracking-widest"
					title="Alternar ordem das lojas">
					<ArrowLeftRight size={18} />
					Alternar Ordem das Lojas
				</button>
			</div>

			{allData.map((store) => {
				const activeCount = store.pendingOrders.filter((o) => !o.checkedByGerencia).length;
				const deliveringCount = store.pendingOrders.filter((o) => !!o.checkedByGerencia).length;

				return (
					<div
						key={store.id}
						className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
						<button
							onClick={() => toggleStore(store.id)}
							className="w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group">
							<div className="flex items-center gap-4 text-left">
								<div
									id="insumosStoreIcon"
									className={`${
										activeCount === 0 && deliveringCount === 0
											? "bg-green-600 shadow-green-100 dark:shadow-none"
											: activeCount > 0 || deliveringCount > 0
												? "bg-blue-600 shadow-blue-100 dark:shadow-none"
												: "bg-slate-300 dark:bg-slate-700 shadow-slate-100 dark:shadow-none"
									} text-white p-5 rounded-[24px] shadow-lg group-hover:scale-105 transition-all`}>
									<Store size={36} />
								</div>
								<div>
									<h3 className="text-3xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight leading-none">
										{store.name}
									</h3>
									<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
										{activeCount === 0 && deliveringCount === 0 ? (
											<p className="font-bold uppercase tracking-[0.2em] text-green-600 dark:text-green-400">
												Nada pendente
											</p>
										) : (
											<>
												{activeCount > 0 && (
													<p className="font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
														<span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
															{activeCount}
														</span>{" "}
														{activeCount === 1 ? "Pedido Pendente" : "Pedidos Pendentes"}
													</p>
												)}
												{activeCount > 0 && deliveringCount > 0 && (
													<span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
												)}
												{deliveringCount > 0 && (
													<p className="font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
														<span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
															{deliveringCount}
														</span>{" "}
														{deliveringCount === 1 ? "Pedido a Entregar" : "Pedidos a Entregar"}
													</p>
												)}
											</>
										)}
									</div>
								</div>
							</div>
						<div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-full border border-slate-100 dark:border-slate-700 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-all">
							{expandedStores[store.id] ? (
								<ChevronUp size={24} className="text-blue-600 dark:text-blue-400" />
							) : (
								<ChevronDown size={24} className="text-slate-400 dark:text-slate-500" />
							)}
						</div>
					</button>

					{expandedStores[store.id] && (
						<div className="p-8 pt-0 border-t border-slate-50 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300 [overflow-anchor:none]">
							{store.pendingOrders.length > 0 ? (
								<>
									<div className="flex flex-wrap items-center justify-between gap-4 py-6 border-b border-slate-50 dark:border-slate-800 mb-3">
										<div className="flex flex-wrap items-center gap-3">
											<span className="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
												Ordenar:
											</span>
											<div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl gap-1 w-fit max-w-full">
												{[
													{ id: "default", label: "Padrão" },
													{ id: "urgency", label: "Urgência" },
													{ id: "date", label: "Data" },
													{ id: "alphabetical", label: "Alfabética" },
												].map((sort) => (
													<button
														key={sort.id}
														onClick={() => handleSelectSort(sort.id as any)}
														className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-black transition-all whitespace-nowrap ${insumosSort === sort.id ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
														{sort.label}
													</button>
												))}
											</div>
										</div>

										{insumosSort === "manual" && manualOrderMap[store.id] && (
											<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider animate-in fade-in">
												<ArrowUpDown size={14} />
												<span>Ordem manual personalizada</span>
											</div>
										)}
									</div>

									<div className="space-y-8">
										{(() => {
											const displayOrders = getStoreDisplayOrders(store);
											const pendingOrders = displayOrders.filter((o) => !o.checkedByGerencia);
											const deliveringOrders = displayOrders.filter((o) => !!o.checkedByGerencia);

											const hasCategorized = INSUMO_CATEGORIES.some((cat) =>
												pendingOrders.some((o) => o.category === cat)
											);

											const renderCard = (order: SupplyOrder) => {
												const norm = normalizeUrgency(order.urgency);
												const isChecked = order.checkedByGerencia || false;
												const isBeingDragged = draggingItem?.orderId === order.id;
												const isDropTarget = dragOverItem === order.id;

												const groupOrders = isChecked
													? displayOrders.filter((o) => !!o.checkedByGerencia)
													: displayOrders.filter((o) => !o.checkedByGerencia && (o.category || null) === (order.category || null));
												const groupIndex = groupOrders.findIndex((o) => o.id === order.id);
												const isFirst = groupIndex === 0;
												const isLast = groupIndex === groupOrders.length - 1;

												const isMenuOpen = openMenuOrderId === order.id;

												return (
													<div
														key={order.id}
														id={`order-${store.id}-${order.id}`}
														data-menu-order={order.id}
														draggable={true}
														onDragStart={(e) => handleDragStart(e, store.id, order.id, isChecked, order.category)}
														onDragOver={(e) => handleDragOver(e, order.id, isChecked, store.id, order.category)}
														onDragLeave={handleDragLeave}
														onDrop={(e) => handleDrop(e, store, order.id, isChecked)}
														onDragEnd={handleDragEnd}
														className={`p-6 rounded-[32px] border flex flex-col justify-between gap-4 transition-all duration-200 cursor-grab active:cursor-grabbing select-none outline-none relative ${
															isMenuOpen ? "z-30 ring-2 ring-blue-400/50" : ""
														} ${
															isBeingDragged
																? "opacity-30 scale-95 border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-none"
																: isDropTarget
																	? "ring-4 ring-blue-500 scale-[1.03] bg-blue-50/80 dark:bg-blue-900/40 border-blue-400"
																	: isChecked
																		? "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-80"
																		: "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-xl dark:hover:shadow-none"
														}`}>
														<div className="space-y-4">
															<div className="flex items-center justify-between gap-3">
																<div className="flex items-center gap-2 flex-1 min-w-0">
																	<GripVertical size={20} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 shrink-0" />
																	<p className="text-2xl font-black leading-tight text-slate-800 dark:text-slate-200 truncate" title={order.name}>
																		{order.name}
																	</p>
																</div>

																<div className="flex items-center gap-2 shrink-0">
																	{/* Menu Hamburger para Categorias (Geladeira, Garagem, Loja, Outros) */}
																	{!isChecked && (
																		<div className="relative">
																			<button
																				type="button"
																				onClick={(e) => {
																					e.stopPropagation();
																					setOpenMenuOrderId(isMenuOpen ? null : order.id);
																				}}
																				className={`p-3 rounded-2xl border transition-all cursor-pointer ${
																					order.category
																						? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 shadow-xs"
																						: "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300"
																				}`}
																				title={order.category ? `Seção: ${order.category}` : "Organizar em seção"}>
																				<Menu size={20} />
																			</button>

																			{/* Dropdown Menu */}
																			{isMenuOpen && (
																				<div
																					onClick={(e) => e.stopPropagation()}
																					className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
																					<div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/60 mb-1">
																						Mover para seção
																					</div>
																					<div className="space-y-1">
																						{INSUMO_CATEGORIES.map((cat) => {
																							const catConf = CATEGORY_CONFIG[cat];
																							const isSelected = order.category === cat;
																							const IconComponent = catConf.icon;
																							return (
																								<button
																									key={cat}
																									type="button"
																									onClick={() => handleSetCategory(store.id, order.id, isSelected ? null : cat)}
																									className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
																										isSelected
																											? `${catConf.badgeBg} shadow-xs font-black`
																											: "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70"
																									}`}>
																									<div className="flex items-center gap-2.5">
																										<IconComponent size={16} />
																										<span>{cat}</span>
																									</div>
																									{isSelected && <Check size={14} className="stroke-[3]" />}
																								</button>
																							);
																						})}
																					</div>
																				</div>
																			)}
																		</div>
																	)}

																	{/* Botão de Check */}
																	<button
																		type="button"
																		id="checkBtn"
																		onMouseDown={(e) => e.preventDefault()}
																		onClick={() => handleToggleCheck(store.id, order.id, isChecked)}
																		className={`p-3 rounded-2xl border transition-all shrink-0 cursor-pointer ${
																			isChecked
																				? "bg-green-600 border-green-600 text-white"
																				: "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-green-500 dark:hover:text-green-400"
																		}`}>
																		<Check size={24} strokeWidth={isChecked ? 5 : 3} />
																	</button>
																</div>
															</div>

															<div className="flex items-center justify-between gap-4 mt-8">
																<div className="flex items-center gap-2">
																	<div className="shrink-0 opacity-80">
																		{norm.type === "urgente" ? (
																			<span className="text-red-600 dark:text-red-500">
																				<AlertTriangle size={25} />
																			</span>
																		) : norm.type === "acabando" ? (
																			<span className="text-amber-600 dark:text-amber-500">
																				<AlertCircle size={25} />
																			</span>
																		) : (
																			<span className="text-blue-600 dark:text-blue-500">
																				<Hourglass size={35} />
																			</span>
																		)}
																	</div>
																	<span
																		className={`text-[14px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap ${
																			isChecked
																				? "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
																				: norm.type === "urgente"
																					? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
																					: norm.type === "acabando"
																						? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
																						: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
																		}`}>
																		{norm.label}
																	</span>
																</div>
																<p className="text-lg font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
																	{formatDate(order.createdAt?.toDate())}
																</p>
															</div>

															{/* Botões de Reordenação: Topo, Subir, Descer, Fundo */}
															<div
																className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70"
																onClick={(e) => e.stopPropagation()}
																onMouseDown={(e) => e.stopPropagation()}
																onTouchStart={(e) => e.stopPropagation()}
																draggable={false}>
																<div className="grid grid-cols-4 gap-1.5 w-full bg-slate-100/70 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
																	{/* Topo */}
																	<button
																		type="button"
																		disabled={isFirst}
																		onMouseDown={(e) => {
																			e.preventDefault();
																			(e.currentTarget as HTMLElement)?.blur();
																		}}
																		onClick={(e) => {
																			e.preventDefault();
																			(e.currentTarget as HTMLElement)?.blur();
																			handleReorderOrder(store, order.id, "top");
																		}}
																		title={isFirst ? "Já está no topo" : "Mandar para o topo"}
																		className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-black transition-all select-none ${
																			isFirst
																				? "opacity-25 text-slate-400 dark:text-slate-600 cursor-not-allowed pointer-events-none"
																				: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700 active:scale-95 shadow-xs cursor-pointer"
																		}`}>
																		<ArrowUpToLine size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
																		<span className="text-[10px] md:text-[11px] uppercase tracking-tight">Topo</span>
																	</button>

																	{/* Subir 1 */}
																	<button
																		type="button"
																		disabled={isFirst}
																		onClick={() => handleReorderOrder(store, order.id, "up")}
																		title={isFirst ? "Não pode subir mais" : "Subir 1 posição"}
																		className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-black transition-all select-none ${
																			isFirst
																				? "opacity-25 text-slate-400 dark:text-slate-600 cursor-not-allowed pointer-events-none"
																				: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700 active:scale-95 shadow-xs cursor-pointer"
																		}`}>
																		<ArrowUp size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
																		<span className="text-[10px] md:text-[11px] uppercase tracking-tight">Subir</span>
																	</button>

																	{/* Descer 1 */}
																	<button
																		type="button"
																		disabled={isLast}
																		onClick={() => handleReorderOrder(store, order.id, "down")}
																		title={isLast ? "Não pode descer mais" : "Descer 1 posição"}
																		className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-black transition-all select-none ${
																			isLast
																				? "opacity-25 text-slate-400 dark:text-slate-600 cursor-not-allowed pointer-events-none"
																				: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700 active:scale-95 shadow-xs cursor-pointer"
																		}`}>
																		<ArrowDown size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
																		<span className="text-[10px] md:text-[11px] uppercase tracking-tight">Descer</span>
																	</button>

																	{/* Fundo */}
																	<button
																		type="button"
																		disabled={isLast}
																		onMouseDown={(e) => {
																			e.preventDefault();
																			(e.currentTarget as HTMLElement)?.blur();
																		}}
																		onClick={(e) => {
																			e.preventDefault();
																			(e.currentTarget as HTMLElement)?.blur();
																			handleReorderOrder(store, order.id, "bottom");
																		}}
																		title={isLast ? "Já está no fundo" : "Mandar para o fundo"}
																		className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-xl text-xs font-black transition-all select-none ${
																			isLast
																				? "opacity-25 text-slate-400 dark:text-slate-600 cursor-not-allowed pointer-events-none"
																				: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700 active:scale-95 shadow-xs cursor-pointer"
																		}`}>
																		<ArrowDownToLine size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
																		<span className="text-[10px] md:text-[11px] uppercase tracking-tight">Fundo</span>
																	</button>
																</div>
															</div>

															{isChecked && (
																<div className="pt-2">
																	<button
																		type="button"
																		onClick={() => handleMarkAsDelivered(store.id, order.id)}
																		className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-md transition-all shadow-md shadow-emerald-100 dark:shadow-none cursor-pointer active:scale-95">
																		<CheckCircle2 size={18} />
																		Entregue
																	</button>
																</div>
															)}
														</div>
													</div>
												);
											};

											return (
												<>
													{hasCategorized ? (
														<div className="space-y-8">
															{/* 1. Seções de Categorias na ordem: Outros, Geladeira, Garagem, Loja */}
															{SECTION_ORDER.map((cat) => {
																const catOrders = pendingOrders.filter((o) => o.category === cat);
																if (catOrders.length === 0) return null;
																const catConf = CATEGORY_CONFIG[cat];
																const IconComp = catConf.icon;

																return (
																	<div key={cat} className="space-y-4 animate-in fade-in duration-200">
																		<div className={`flex items-center justify-between p-3.5 px-6 rounded-2xl border ${catConf.headerBorder} ${catConf.headerBg} shadow-xs`}>
																			<div className="flex items-center gap-3">
																				<div className={`p-2 rounded-xl ${catConf.badgeBg}`}>
																					<IconComp size={20} />
																				</div>
																				<h4 className={`text-xl font-black uppercase tracking-tight ${catConf.textColor}`}>
																					{catConf.label}
																				</h4>
																			</div>
																			<span className={`text-xs font-black px-3 py-1 rounded-full ${catConf.badgeBg} uppercase tracking-wider`}>
																				{catOrders.length} {catOrders.length === 1 ? "insumo" : "insumos"}
																			</span>
																		</div>

																		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
																			{catOrders.map(renderCard)}
																		</div>
																	</div>
																);
															})}

															{/* 2. Demais Insumos Pendentes (sem categoria definida) */}
															{(() => {
																const uncategorized = pendingOrders.filter((o) => !o.category);
																if (uncategorized.length === 0) return null;

																return (
																	<div className="space-y-4 pt-2 animate-in fade-in duration-200">
																		<div className="flex items-center justify-between p-3.5 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 shadow-xs">
																			<div className="flex items-center gap-3">
																				<div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
																					<Package size={20} />
																				</div>
																				<h4 className="text-xl font-black uppercase tracking-tight text-slate-700 dark:text-slate-300">
																					Demais Insumos
																				</h4>
																			</div>
																			<span className="text-xs font-black px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
																				{uncategorized.length} {uncategorized.length === 1 ? "insumo" : "insumos"}
																			</span>
																		</div>

																		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
																			{uncategorized.map(renderCard)}
																		</div>
																	</div>
																);
															})()}
														</div>
													) : (
														/* Sem categorias ativas: lista pendente padrão */
														pendingOrders.length > 0 && (
															<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
																{pendingOrders.map(renderCard)}
															</div>
														)
													)}

													{/* 3. Itens Verificados / A Entregar (com Check) no fundo */}
													{deliveringOrders.length > 0 && (
														<div className="space-y-4 pt-4 border-t border-slate-200/70 dark:border-slate-800">
															{hasCategorized && (
																<div className="flex items-center justify-between p-3.5 px-6 rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs">
																	<div className="flex items-center gap-3">
																		<div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
																			<CheckCircle2 size={20} />
																		</div>
																		<h4 className="text-xl font-black uppercase tracking-tight text-emerald-800 dark:text-emerald-300">
																			Itens a Entregar (Verificados)
																		</h4>
																	</div>
																	<span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
																		{deliveringOrders.length} {deliveringOrders.length === 1 ? "insumo" : "insumos"}
																	</span>
																</div>
															)}

															<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
																{deliveringOrders.map(renderCard)}
															</div>
														</div>
													)}
												</>
											);
										})()}
									</div>
								</>
							) : (
								<div className="py-12 text-center">
									<Package className="mx-auto text-slate-200 dark:text-slate-400 mb-4" size={48} />
									<p className="text-slate-400 dark:text-slate-400 font-bold">
										Nenhum pedido de insumo pendente para esta loja.
									</p>
								</div>
							)}

							{/* Saved Order Lists Snapshots Toggle Section */}
							<div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
								<button
									onClick={() => toggleSnapshotsHistory(store.id)}
									className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer group">
									<h4 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
										<ListChecks
											className={`${showSnapshotsHistory[store.id] ? "text-blue-600 dark:text-blue-400" : "text-slate-300 dark:text-slate-500"}`}
											size={32}
										/>
										({(store.orderSnapshots || []).length}) Histórico de Listas de Pedidos Salvas
									</h4>
									<span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
										{showSnapshotsHistory[store.id] ? "Recolher" : "Visualizar"}
									</span>
								</button>

								{showSnapshotsHistory[store.id] && (
									<div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
										{(store.orderSnapshots || []).map((snapshot, idx) => {
											const isLatest = idx === 0;
											const closedDateStr = snapshot.closedAt?.toDate
												? formatDate(snapshot.closedAt.toDate())
												: snapshot.closedAt
												? formatDate(new Date(snapshot.closedAt))
												: "n/a";

											return (
												<div
													key={snapshot.id || idx}
													className={`p-5 rounded-2xl border transition-all ${
														isLatest
															? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 shadow-sm"
															: "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800"
													}`}>
													<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
														<div className="space-y-1.5 flex-1 min-w-0">
															<div className="flex flex-wrap items-center gap-2">
																<h5 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
																	<ListChecks className="text-blue-600 dark:text-blue-400" size={18} />
																	Lista de Fechamento: {snapshot.cycleClosingDate}
																</h5>
																{isLatest && (
																	<span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-sm">
																		Mais Recente
																	</span>
																)}
																{snapshot.updatedAt && (
																	<span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
																		Atualizada após fechamento
																	</span>
																)}
															</div>

															<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
																<span>
																	🚚 Entrega prevista: <strong className="text-slate-700 dark:text-slate-300">{snapshot.cycleDeliveryDate}</strong>
																</span>
																<span>•</span>
																<span>
																	Salva em: <strong className="text-slate-700 dark:text-slate-300">{closedDateStr}</strong>
																</span>
																<span>•</span>
																<span>
																	Total: <strong className="text-slate-700 dark:text-slate-300">{snapshot.itemsCount} insumos</strong>
																</span>
															</div>
														</div>

														<div className="flex items-center gap-2 shrink-0">
															<button
																onClick={() => handleCopySnapshot(snapshot)}
																className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm">
																{copiedSnapshotId === snapshot.id ? (
																	<>
																		<Check className="text-emerald-500" size={14} />
																		<span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
																	</>
																) : (
																	<>
																		<Copy size={14} />
																		<span>Copiar p/ WhatsApp</span>
																	</>
																)}
															</button>

															<button
																onClick={() => setSelectedSnapshotModal(snapshot)}
																className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-200 dark:shadow-none">
																<ExternalLink size={14} />
																<span>Ver Insumos ({snapshot.itemsCount})</span>
															</button>
														</div>
													</div>
												</div>
											);
										})}

										{(store.orderSnapshots || []).length === 0 && (
											<div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
												<ListChecks className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={32} />
												<p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
													Nenhuma lista consolidada salva até o momento para esta loja.
												</p>
											</div>
										)}
									</div>
								)}
							</div>

							{/* History Toggle Section */}
							<div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800">
								<button
									onClick={() => toggleHistory(store.id)}
									className="w-full flex items-center justify-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer group">
									<h4 className="text-lg font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
										<CheckCircle2
											className={`${showHistory[store.id] ? "text-emerald-500" : "text-slate-300 dark:text-slate-500"}`}
											size={32}
										/>
										({store.historicalOrders.length}) Insumos Finalizados (Últimas 4 Semanas)
									</h4>
									{/* <span className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
										{showHistory[store.id] ? "Esconder" : "Mostrar"}
									</span> */}
								</button>

								{showHistory[store.id] && (
									<div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 opacity-70 dark:opacity-80 animate-in fade-in slide-in-from-top-2 duration-300">
										{store.historicalOrders
											.sort((a, b) => (b.deliveredAt?.toMillis() || 0) - (a.deliveredAt?.toMillis() || 0))
											.map((order) => (
											<div
												key={order.id}
												className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
													order.status === "cancelled"
														? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
														: "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
												}`}>
												<div className="min-w-0 flex-1">
													<p
														className={`text-md font-bold truncate ${
															order.status === "cancelled"
																? "text-red-700 dark:text-red-400"
																: "text-slate-700 dark:text-slate-300 line-through decoration-slate-400 dark:decoration-slate-600"
														}`}>
														{order.name}
														{order.status === "cancelled" && " (CANCELADO)"}
													</p>
													<p className="text-sm text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">
														{order.status === "cancelled" ? "Cancelado em: " : "Entregue em: "}
														{formatDate(order.deliveredAt?.toDate())}
													</p>
												</div>
												<div className={`ml-3 shrink-0 ${order.status === "cancelled" ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-500"}`}>
													{order.status === "cancelled" ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
												</div>
											</div>
										))}
										{store.historicalOrders.length === 0 && (
											<div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
												<p className="text-sm text-slate-400 dark:text-slate-500 italic">
													Nenhum histórico recente para exibir.
												</p>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			);
		})}

			{allData.length === 0 && (
				<div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 border-dashed">
					<Package className="mx-auto text-slate-200 dark:text-slate-800 mb-4" size={64} />
					<p className="text-slate-400 dark:text-slate-500 font-bold">
						Nenhum pedido de insumo pendente em nenhuma loja.
					</p>
				</div>
			)}

			{/* Modal para Visualizar Detalhes do Snapshot de Insumos */}
			{selectedSnapshotModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
							<div>
								<h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
									<ListChecks className="text-blue-600 dark:text-blue-400" size={24} />
									Lista de Pedidos • Loja {selectedSnapshotModal.storeName}
								</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
									Fechamento: {selectedSnapshotModal.cycleClosingDate} • Entrega: {selectedSnapshotModal.cycleDeliveryDate} • Salva em:{" "}
									{selectedSnapshotModal.closedAt?.toDate
										? formatDate(selectedSnapshotModal.closedAt.toDate())
										: selectedSnapshotModal.closedAt
										? formatDate(new Date(selectedSnapshotModal.closedAt))
										: "n/a"}
								</p>
							</div>
							<button
								onClick={() => setSelectedSnapshotModal(null)}
								className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
								<X size={20} />
							</button>
						</div>

						<div className="py-4 flex items-center justify-between gap-4">
							<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
								{selectedSnapshotModal.itemsCount} insumos solicitados nesta lista:
							</span>
							<button
								onClick={() => handleCopySnapshot(selectedSnapshotModal)}
								className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all">
								{copiedSnapshotId === selectedSnapshotModal.id ? (
									<>
										<Check className="text-emerald-500" size={14} />
										<span className="text-emerald-600 dark:text-emerald-400 font-bold">Copiado!</span>
									</>
								) : (
									<>
										<Copy size={14} />
										<span>Copiar lista</span>
									</>
								)}
							</button>
						</div>

						<div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[50vh]">
							{selectedSnapshotModal.items && selectedSnapshotModal.items.length > 0 ? (
								selectedSnapshotModal.items.map((item, idx) => (
									<div
										key={item.id || idx}
										className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3">
										<span className="text-sm font-bold text-slate-800 dark:text-slate-200">
											{item.name}
										</span>
										<span
											className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md shrink-0 ${
												item.urgency === "Urgente"
													? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
													: item.urgency === "Acabando"
													? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
													: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
											}`}>
											{item.urgency}
										</span>
									</div>
								))
							) : (
								<p className="text-sm text-slate-400 italic text-center py-6">
									Nenhum insumo registrado nesta lista.
								</p>
							)}
						</div>

						<div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2 flex justify-end">
							<button
								onClick={() => setSelectedSnapshotModal(null)}
								className="cursor-pointer px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm transition-all">
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
