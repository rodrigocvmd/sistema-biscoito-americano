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
	addDoc,
	serverTimestamp,
	Timestamp,
	orderBy,
	limit,
} from "firebase/firestore";
import {
	StoreId,
	STORE_NAMES,
	SupplyOrder,
	formatDate,
	SupplyOrderSnapshot,
	SupplyOrderSnapshotItem,
	normalizeSearchText,
	UrgencyLevel,
} from "@/types";
import {
	INVENTORY_DATA,
	getInsumoCategory,
} from "@/lib/insumos-data";
import {
	RefreshCw,
	Store,
	ChevronDown,
	ChevronUp,
	Check,
	AlertTriangle,
	Package,
	CheckCircle2,
	Trash2,
	ArrowLeftRight,
	Search,
	X,
	ListChecks,
	Copy,
	ExternalLink,
	Calendar,
	Tag,
	ShoppingCart,
	ArrowUpToLine,
	ArrowDownToLine,
	ArrowUp,
	ArrowDown,
	GripVertical,
	ArrowUpDown,
	Clock,
	Plus,
	Minus,
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	pendingOrders: SupplyOrder[];
	historicalOrders: SupplyOrder[];
	orderSnapshots: SupplyOrderSnapshot[];
	urgentCount: number;
	pendingSupplyCount: number;
	storePendingCount: number;
}

interface DeliveryModalItem {
	id: string;
	name: string;
	urgency: UrgencyLevel;
	quantity: string;
	checked: boolean;
	createdAt?: any;
}

const STORE_ORDER: StoreId[] = ["lago", "terraco", "conjunto", "noroeste"];

export default function InsumosLojasPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});
	const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
	const [showSnapshotsHistory, setShowSnapshotsHistory] = useState<Record<string, boolean>>({});
	const [selectedSnapshotModal, setSelectedSnapshotModal] = useState<SupplyOrderSnapshot | null>(null);
	const [copiedSnapshotId, setCopiedSnapshotId] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [snapshotSearchMap, setSnapshotSearchMap] = useState<Record<string, string>>({});
	const [historySearchMap, setHistorySearchMap] = useState<Record<string, string>>({});
	const [addedToSupplierOrderId, setAddedToSupplierOrderId] = useState<string | null>(null);

	// Estado da ordenação
	const [insumosSort, setInsumosSort] = useState<"urgency" | "date" | "alphabetical" | "manual">("urgency");
	const [manualOrderMap, setManualOrderMap] = useState<Record<string, string[]>>({});

	// Modal de Concluir Entrega
	const [deliveryModal, setDeliveryModal] = useState<{
		storeId: StoreId;
		storeName: string;
		items: DeliveryModalItem[];
	} | null>(null);
	const [savingDelivery, setSavingDelivery] = useState(false);

	// Modal de Cancelar/Deletar Insumo da Loja
	const [orderToCancel, setOrderToCancel] = useState<{
		storeId: StoreId;
		orderId: string;
		orderName?: string;
	} | null>(null);
	const [cancelingOrder, setCancelingOrder] = useState(false);

	// Modal de Adicionar Insumo
	const [addInsumoModalStore, setAddInsumoModalStore] = useState<{
		storeId: StoreId;
		storeName: string;
	} | null>(null);
	const [newInsumoName, setNewInsumoName] = useState("");
	const [newInsumoQuantity, setNewInsumoQuantity] = useState("");
	const [newInsumoIsUrgent, setNewInsumoIsUrgent] = useState(false);
	const [isInsumoDropdownOpen, setIsInsumoDropdownOpen] = useState(false);
	const [addingInsumo, setAddingInsumo] = useState(false);

	const rotateStores = () => {
		setAllData((prev) => {
			if (prev.length < 2) return prev;
			const [first, ...rest] = prev;
			return [...rest, first];
		});
	};

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

	// Persistir ordenação
	useEffect(() => {
		const savedSort = localStorage.getItem("biscoito_admin_insumos_sort");
		if (savedSort === "urgency" || savedSort === "date" || savedSort === "alphabetical" || savedSort === "manual") {
			setInsumosSort(savedSort as any);
		}
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

	// Listeners para Firestore
	useEffect(() => {
		const storeIds = STORE_ORDER;
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
					const urgentCount = sPending.filter((o) => o.urgency === "Urgente").length;
					const pendingSupplyCount = sPending.filter((o) => !!o.isPendingSupply).length;
					const storePendingCount = sPending.filter((o) => !o.isPendingSupply).length;

					return {
						id,
						name: STORE_NAMES[id],
						pendingOrders: sPending,
						historicalOrders: sHistory,
						orderSnapshots: sSnapshots,
						urgentCount,
						pendingSupplyCount,
						storePendingCount,
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

		// 1. Pending Listeners por Loja
		const pendingUnsubs = storeIds.map((id) => {
			const pendingRef = collection(db, "stores", id, "supplyOrders");
			const qPending = query(
				pendingRef,
				where("status", "==", "pending"),
				orderBy("createdAt", "desc"),
			);

			return onSnapshot(
				qPending,
				(snapshot) => {
					storePendingData[id] = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					})) as SupplyOrder[];
					updateAllData();
				},
				(error) => console.error(`Erro ao carregar insumos pendentes da loja ${id}:`, error),
			);
		});

		// 2. Histórico de Insumos Entregues/Cancelados
		const historyUnsubs = storeIds.map((id) => {
			const historyRef = collection(db, "stores", id, "supplyOrders");
			const qHistory = query(
				historyRef,
				where("status", "in", ["delivered", "cancelled"]),
				where("deliveredAt", ">=", Timestamp.fromDate(fourWeeksAgo)),
				orderBy("deliveredAt", "desc"),
			);

			return onSnapshot(
				qHistory,
				(snapshot) => {
					storeHistoryData[id] = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					})) as SupplyOrder[];
					updateAllData();
				},
				(error) => console.error(`Erro ao carregar histórico da loja ${id}:`, error),
			);
		});

		// 3. Snapshots de Listas Salvas
		const snapshotUnsubs = storeIds.map((id) => {
			const snapRef = collection(db, "stores", id, "supplyOrderSnapshots");
			const qSnap = query(snapRef, orderBy("closedAt", "desc"), limit(25));

			return onSnapshot(
				qSnap,
				(snapshot) => {
					storeSnapshotsData[id] = snapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					})) as SupplyOrderSnapshot[];
					updateAllData();
				},
				(error) => console.error(`Erro ao carregar snapshots da loja ${id}:`, error),
			);
		});

		return () => {
			pendingUnsubs.forEach((unsub) => unsub());
			historyUnsubs.forEach((unsub) => unsub());
			snapshotUnsubs.forEach((unsub) => unsub());
		};
	}, []);

	// Ordenação dos pedidos
	const getStoreDisplayOrders = (store: FullStoreData) => {
		const baseSorted = [...store.pendingOrders].sort((a, b) => {
			// Insumos pendentes (aguardando reposição) vão sempre para o fim total da lista
			const isPendA = a.isPendingSupply ? 1 : 0;
			const isPendB = b.isPendingSupply ? 1 : 0;
			if (isPendA !== isPendB) {
				return isPendA - isPendB;
			}

			// Insumos conferidos (checked) ficam abaixo dos não-conferidos (mas acima de pendência)
			const isCheckedA = a.checkedByGerencia ? 1 : 0;
			const isCheckedB = b.checkedByGerencia ? 1 : 0;
			if (isCheckedA !== isCheckedB) {
				return isCheckedA - isCheckedB;
			}

			if (insumosSort === "alphabetical") {
				return a.name.localeCompare(b.name, "pt-BR");
			}
			if (insumosSort === "date") {
				return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
			}

			// Padrão (urgency): Urgente vem sempre PRIMEIRO no topo da lista
			const isUrgentA = a.urgency === "Urgente" ? 1 : 0;
			const isUrgentB = b.urgency === "Urgente" ? 1 : 0;
			if (isUrgentB !== isUrgentA) {
				return isUrgentB - isUrgentA;
			}
			return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
		});

		if (insumosSort !== "manual" || !manualOrderMap[store.id]) {
			return baseSorted;
		}

		const orderIds = manualOrderMap[store.id];
		return [...baseSorted].sort((a, b) => {
			const isPendA = a.isPendingSupply ? 1 : 0;
			const isPendB = b.isPendingSupply ? 1 : 0;
			if (isPendA !== isPendB) {
				return isPendA - isPendB;
			}

			// Insumos conferidos (checked) ficam sempre abaixo dos não-conferidos
			const isCheckedA = a.checkedByGerencia ? 1 : 0;
			const isCheckedB = b.checkedByGerencia ? 1 : 0;
			if (isCheckedA !== isCheckedB) {
				return isCheckedA - isCheckedB;
			}

			const idxA = orderIds.indexOf(a.id);
			const idxB = orderIds.indexOf(b.id);
			if (idxA === -1 && idxB === -1) return 0;
			if (idxA === -1) return 1;
			if (idxB === -1) return -1;
			return idxA - idxB;
		});
	};

	// Reordenar manualmente (Topo, Subir, Descer, Fundo)
	const handleReorderOrder = (
		store: FullStoreData,
		orderId: string,
		action: "top" | "up" | "down" | "bottom",
		e?: React.MouseEvent,
	) => {
		// Impede que o foco/scroll da página pule
		if (e) {
			(e.currentTarget as HTMLElement)?.blur?.();
		}

		// Grava a posição de scroll atual da janela antes de qualquer reordenação
		const scrollY = window.scrollY;

		const currentOrders = getStoreDisplayOrders(store);
		const currentIndex = currentOrders.findIndex((o) => o.id === orderId);
		if (currentIndex === -1) return;

		let targetIndex = currentIndex;
		if (action === "top") {
			if (currentIndex === 0) return;
			targetIndex = 0;
		} else if (action === "up") {
			if (currentIndex === 0) return;
			targetIndex = currentIndex - 1;
		} else if (action === "down") {
			if (currentIndex === currentOrders.length - 1) return;
			targetIndex = currentIndex + 1;
		} else if (action === "bottom") {
			// Deve ir para o final, acima apenas de insumos pendentes e insumos com check
			// Encontra o primeiro índice que é ou pendente ou checked (exceto o próprio item)
			const otherOrders = currentOrders.filter((o) => o.id !== orderId);
			const firstExcludedIdx = otherOrders.findIndex(
				(o) => o.isPendingSupply || o.checkedByGerencia,
			);
			targetIndex = firstExcludedIdx === -1 ? otherOrders.length : firstExcludedIdx;
		}

		const newOrders = [...currentOrders];
		const [movedOrder] = newOrders.splice(currentIndex, 1);
		newOrders.splice(targetIndex, 0, movedOrder);

		const finalIds = newOrders.map((o) => o.id);
		setManualOrderMap((prev) => ({
			...prev,
			[store.id]: finalIds,
		}));
		setInsumosSort("manual");

		if (action === "top") {
			requestAnimationFrame(() => {
				window.scrollTo({ top: scrollY, behavior: "instant" as any });
			});
		}
	};

	// Toggle check simples na visualização da gerência
	const handleToggleCheck = async (
		storeId: string,
		orderId: string,
		currentChecked: boolean,
		store: FullStoreData,
	) => {
		try {
			const willCheck = !currentChecked;
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			await updateDoc(orderRef, {
				checkedByGerencia: willCheck,
			});

			// Se foi marcado como conferido (checked), mover para o final na lista manual
			// ficando acima apenas dos insumos pendentes
			const currentOrders = getStoreDisplayOrders(store);
			const otherIds = currentOrders.filter((o) => o.id !== orderId);

			if (willCheck) {
				// Encontra onde começam os insumos pendentes
				const firstPendingIdx = otherIds.findIndex((o) => o.isPendingSupply);
				const insertIdx = firstPendingIdx === -1 ? otherIds.length : firstPendingIdx;
				otherIds.splice(insertIdx, 0, currentOrders.find((o) => o.id === orderId)!);
				const finalIds = otherIds.map((o) => o.id);
				setManualOrderMap((prev) => ({
					...prev,
					[storeId]: finalIds,
				}));
			}
		} catch (error) {
			console.error("Erro ao alternar check:", error);
		}
	};

	// Alternar status de Pendência (Aguardando reposição de insumo)
	const handleTogglePendingSupply = async (
		storeId: string,
		orderId: string,
		currentPending: boolean,
		store: FullStoreData,
	) => {
		try {
			const nextPending = !currentPending;
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			await updateDoc(orderRef, {
				isPendingSupply: nextPending,
			});

			// Se colocou em pendência e a ordenação for manual, move para o final do array manual também
			if (nextPending && manualOrderMap[storeId]) {
				const currentIds = manualOrderMap[storeId].filter((id) => id !== orderId);
				currentIds.push(orderId);
				setManualOrderMap((prev) => ({
					...prev,
					[storeId]: currentIds,
				}));
			}
		} catch (error) {
			console.error("Erro ao alternar pendência:", error);
		}
	};

	// Adicionar ao pedido de compras (fornecedores)
	const handleAddToSupplierOrders = async (itemName: string, orderId: string) => {
		try {
			const finalName = itemName.trim().toUpperCase();
			const norm = normalizeSearchText(finalName);
			let category = "OUTROS";
			for (const cat of INVENTORY_DATA) {
				for (const item of cat.items) {
					if (normalizeSearchText(item) === norm) {
						category = cat.category;
						break;
					}
				}
			}

			await addDoc(collection(db, "fornecedorPedidos"), {
				name: finalName,
				category,
				status: "pending",
				createdAt: serverTimestamp(),
			});

			setAddedToSupplierOrderId(orderId);
			setTimeout(() => {
				setAddedToSupplierOrderId((prev) => (prev === orderId ? null : prev));
			}, 3000);
		} catch (error) {
			console.error("Erro ao adicionar à lista de compras:", error);
			alert("Erro ao adicionar insumo à lista de compras.");
		}
	};

	// CANCELAR / DELETAR INSUMO DA LOJA
	const handleCancelOrder = async () => {
		if (!orderToCancel) return;
		setCancelingOrder(true);
		try {
			const orderRef = doc(db, "stores", orderToCancel.storeId, "supplyOrders", orderToCancel.orderId);
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
			console.error("Erro ao cancelar pedido de insumo:", error);
			alert("Erro ao cancelar pedido de insumo.");
		} finally {
			setCancelingOrder(false);
		}
	};

	// ABRIR MODAL: ADICIONAR INSUMO NA LOJA
	const handleOpenAddInsumoModal = (storeId: StoreId, storeName: string) => {
		setNewInsumoName("");
		setNewInsumoQuantity("");
		setNewInsumoIsUrgent(false);
		setIsInsumoDropdownOpen(false);
		setAddInsumoModalStore({ storeId, storeName });
	};

	// SALVAR NOVO INSUMO NA LOJA
	const handleSaveNewInsumo = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!addInsumoModalStore || !newInsumoName.trim()) return;

		setAddingInsumo(true);
		try {
			const { storeId } = addInsumoModalStore;
			const trimmedName = newInsumoName.trim().toUpperCase();
			const trimmedQty = newInsumoQuantity.trim();
			const insumoCategory = getInsumoCategory(trimmedName);

			const ordersRef = collection(db, "stores", storeId, "supplyOrders");
			const docRef = await addDoc(ordersRef, {
				name: trimmedName,
				quantity: trimmedQty,
				urgency: newInsumoIsUrgent ? "Urgente" : "Normal",
				status: "pending",
				checkedByGerencia: false,
				isPendingSupply: false,
				category: insumoCategory,
				createdAt: serverTimestamp(),
			});

			// Se o modal de entrega estiver aberto para a mesma loja, inclui imediatamente
			if (deliveryModal && deliveryModal.storeId === storeId) {
				setDeliveryModal({
					...deliveryModal,
					items: [
						...deliveryModal.items,
						{
							id: docRef.id,
							name: trimmedName,
							urgency: newInsumoIsUrgent ? "Urgente" : "Normal",
							quantity: trimmedQty || "1",
							checked: false,
							createdAt: Timestamp.now(),
						},
					],
				});
			}

			setAddInsumoModalStore(null);
			setNewInsumoName("");
			setNewInsumoQuantity("");
			setNewInsumoIsUrgent(false);
		} catch (error) {
			console.error("Erro ao adicionar insumo:", error);
			alert("Erro ao adicionar insumo. Tente novamente.");
		} finally {
			setAddingInsumo(false);
		}
	};

	// ABRIR MODAL: CONCLUIR ENTREGA
	const handleOpenConcluirEntrega = (store: FullStoreData) => {
		const sorted = getStoreDisplayOrders(store);
		const modalItems: DeliveryModalItem[] = sorted.map((o) => ({
			id: o.id,
			name: o.name,
			urgency: o.urgency,
			quantity: o.quantity && o.quantity.trim() !== "" ? o.quantity.trim() : "1",
			checked: !!o.checkedByGerencia,
			createdAt: o.createdAt || null,
		}));

		setDeliveryModal({
			storeId: store.id,
			storeName: store.name,
			items: modalItems,
		});
	};

	// MODAL: ALTERAR QUANTIDADE DE UM ITEM (COM BOTÕES +/-)
	const handleModalStepQuantity = (itemId: string, delta: number) => {
		if (!deliveryModal) return;
		setDeliveryModal({
			...deliveryModal,
			items: deliveryModal.items.map((i) => {
				if (i.id !== itemId) return i;
				const trimmed = (i.quantity || "").trim();

				let nextQty = "1";

				if (delta < 0) {
					// Reduzindo quantidade
					if (trimmed === "1/3") {
						nextQty = "1/3";
					} else if (trimmed === "1/2") {
						nextQty = "1/3";
					} else if (trimmed === "1") {
						nextQty = "1/2";
					} else {
						const currentNum = parseInt(trimmed, 10);
						if (isNaN(currentNum) || currentNum <= 1) {
							nextQty = "1/2";
						} else {
							nextQty = (currentNum - 1).toString();
						}
					}
				} else {
					// Aumentando quantidade
					if (trimmed === "1/3") {
						nextQty = "1/2";
					} else if (trimmed === "1/2") {
						nextQty = "1";
					} else {
						const currentNum = parseInt(trimmed, 10);
						if (isNaN(currentNum) || currentNum < 1) {
							nextQty = "1";
						} else {
							nextQty = (currentNum + 1).toString();
						}
					}
				}

				return { ...i, quantity: nextQty };
			}),
		});
	};

	// MODAL: ALTERAR CHECK DE UM ITEM
	const handleModalToggleCheck = (itemId: string) => {
		if (!deliveryModal) return;
		setDeliveryModal({
			...deliveryModal,
			items: deliveryModal.items.map((i) =>
				i.id === itemId ? { ...i, checked: !i.checked } : i,
			),
		});
	};

	// MODAL: REMOVER ITEM DA ENTREGA
	const handleModalRemoveItem = (itemId: string) => {
		if (!deliveryModal) return;
		setDeliveryModal({
			...deliveryModal,
			items: deliveryModal.items.filter((i) => i.id !== itemId),
		});
	};

	// MODAL: SALVAR E FINALIZAR ENTREGA
	const handleSalvarEFinalizar = async () => {
		if (!deliveryModal || deliveryModal.items.length === 0) {
			alert("Não há itens para salvar nesta entrega.");
			return;
		}

		setSavingDelivery(true);
		try {
			const { storeId, storeName, items } = deliveryModal;
			const deliveredAt = new Date();
			const expireAt = new Date();
			expireAt.setDate(deliveredAt.getDate() + 14);

			// 1. Salva no histórico como SupplyOrderSnapshot entregue
			const snapshotItems: SupplyOrderSnapshotItem[] = items.map((i) => {
				const itemObj: SupplyOrderSnapshotItem = {
					id: i.id || "",
					name: i.name || "",
					urgency: i.urgency || "low",
					category: getInsumoCategory(i.name || "") || "OUTROS",
					checked: !!i.checked,
					createdAt: i.createdAt || null,
				};
				const trimmedQty = i.quantity ? i.quantity.trim() : "";
				if (trimmedQty) {
					itemObj.quantity = trimmedQty;
				}
				return itemObj;
			});

			const snapshotsRef = collection(db, "stores", storeId, "supplyOrderSnapshots");
			await addDoc(snapshotsRef, {
				storeId: storeId || "",
				storeName: storeName || "",
				closedAt: serverTimestamp(),
				deliveredAt: Timestamp.fromDate(deliveredAt),
				status: "delivered",
				itemsCount: snapshotItems.length,
				items: snapshotItems,
			});

			// 2. Atualiza os pedidos entregues no Firestore
			for (const item of items) {
				try {
					const orderRef = doc(db, "stores", storeId, "supplyOrders", item.id);
					await updateDoc(orderRef, {
						status: "delivered",
						deliveredAt: Timestamp.fromDate(deliveredAt),
						expireAt: Timestamp.fromDate(expireAt),
						quantity: item.quantity.trim() || "",
					});
				} catch (e) {
					console.warn("Item não encontrado ao atualizar:", item.id);
				}
			}

			setDeliveryModal(null);
		} catch (error) {
			console.error("Erro ao salvar e finalizar entrega:", error);
			alert("Erro ao salvar e finalizar entrega. Tente novamente.");
		} finally {
			setSavingDelivery(false);
		}
	};

	// Copiar lista para WhatsApp
	const handleCopySnapshot = (snapshot: SupplyOrderSnapshot) => {
		const items = snapshot.items || [];
		let text = `📦 *ENTREGA DE INSUMOS - ${snapshot.storeName.toUpperCase()}*\n`;
		const dateStr = snapshot.deliveredAt?.toDate
			? formatDate(snapshot.deliveredAt.toDate())
			: snapshot.closedAt?.toDate
			? formatDate(snapshot.closedAt.toDate())
			: "Hoje";
		text += `📅 Data: ${dateStr}\n`;
		text += `🔢 Total: ${items.length} insumos\n\n`;

		const categoriesInList = Array.from(
			new Set(items.map((i) => i.category || getInsumoCategory(i.name))),
		);

		categoriesInList.forEach((cat) => {
			const catItems = items.filter(
				(i) => (i.category || getInsumoCategory(i.name)) === cat,
			);
			if (catItems.length === 0) return;

			text += `📂 *${cat.toUpperCase()} (${catItems.length})*\n`;
			catItems.forEach((i) => {
				const checkMark = i.checked ? "✅" : "▫️";
				const qtyStr = i.quantity ? ` • Qtd: ${i.quantity}` : "";
				text += `${checkMark} ${i.name}${qtyStr} [${i.urgency}]\n`;
			});
			text += `\n`;
		});

		navigator.clipboard.writeText(text);
		setCopiedSnapshotId(snapshot.id);
		setTimeout(() => setCopiedSnapshotId(null), 2500);
	};

	// Resultados de busca global
	const searchResults = (() => {
		const term = normalizeSearchText(searchTerm);
		if (!term) return [];

		const resultsMap = new Map<
			string,
			{ storeId: StoreId; storeName: string; orderId: string; quantity?: string }[]
		>();

		allData.forEach((store) => {
			store.pendingOrders.forEach((order) => {
				if (normalizeSearchText(order.name).includes(term)) {
					const existing = resultsMap.get(order.name) || [];
					existing.push({
						storeId: store.id,
						storeName: store.name,
						orderId: order.id,
						quantity: order.quantity,
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
		setExpandedStores((prev) => ({ ...prev, [storeId]: true }));
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

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-16">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-600 dark:text-slate-300 font-bold">Carregando pedidos de insumos...</p>
			</div>
		);
	}

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
						placeholder="Pesquisar insumo nos pedidos..."
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
														{s.quantity && (
															<span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
																({s.quantity})
															</span>
														)}
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
									Nenhum pedido pendente encontrado para &quot;{searchTerm}&quot;.
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Alternar Ordem das Lojas */}
			<div className="flex justify-center items-center">
				<button
					onClick={rotateStores}
					className="cursor-pointer flex items-center gap-2.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-800 px-5 py-2.5 rounded-2xl font-black shadow-xs transition-all text-xs uppercase tracking-widest">
					<ArrowLeftRight size={16} />
					Alternar Ordem das Lojas
				</button>
			</div>

			{/* Lojas Accordion */}
			<div className="space-y-6">
				{allData.map((store) => {
					const isExpanded = !!expandedStores[store.id];
					const totalPendingCount = store.pendingOrders.length;
					const pendingCount = store.storePendingCount;
					const pendingSupplyCount = store.pendingSupplyCount;
					const urgentCount = store.urgentCount;

					return (
						<div
							key={store.id}
							className="bg-white dark:bg-slate-900 rounded-[36px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
							{/* Header da Loja */}
							<div className="p-6 md:p-8 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-all">
								<div
									onClick={() => toggleStore(store.id)}
									className="flex items-center gap-4 text-left cursor-pointer flex-1 min-w-0">
									<div className="p-4 md:p-5 rounded-[24px] text-white shadow-lg shrink-0 transition-all bg-blue-600 shadow-blue-200 dark:shadow-none">
										<Store size={32} />
									</div>

									<div className="min-w-0">
										<div className="flex items-center gap-3 flex-wrap">
											<h3 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
												{store.name}
											</h3>

											{/* INDICAÇÃO VISUAL DE ITENS URGENTES (visível inclusive quando toggle fechado) */}
											{urgentCount > 0 && (
												<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 shadow-xs">
													<AlertTriangle size={14} className="text-red-600" />
													<span>
														{urgentCount} Urgente{urgentCount > 1 ? "s" : ""}
													</span>
												</span>
											)}
										</div>

										<div className="flex flex-col gap-1 mt-2">
											<div className="flex flex-wrap items-center gap-3">
												{pendingCount === 0 ? (
													<p className="font-bold text-sm md:text-base uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
														<CheckCircle2 size={18} /> Tudo entregue
													</p>
												) : (
													<p className="font-bold text-sm md:text-base uppercase tracking-widest text-slate-500 dark:text-slate-400">
														<strong className="text-lg md:text-xl font-black text-blue-600 dark:text-blue-400">
															{pendingCount}
														</strong>{" "}
														{pendingCount === 1 ? "insumo solicitado" : "insumos solicitados"}
													</p>
												)}
											</div>

											{pendingSupplyCount > 0 && (
												<p className="font-bold text-xs md:text-sm uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
													<Clock size={15} />
													<span>
														<strong className="font-black text-lg md:text-xl">
															{pendingSupplyCount}
														</strong>{" "}
														{pendingSupplyCount === 1 ? "sem estoque" : "sem estoque"}
													</span>
												</p>
											)}
										</div>
									</div>
								</div>

								{/* Ações da Loja no Topo: Botão Adicionar Insumo (+) e Expandir/Recolher */}
								<div className="flex items-center gap-2 sm:gap-3 shrink-0 self-center">
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											handleOpenAddInsumoModal(store.id, store.name);
										}}
										className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 dark:shadow-none transition-all cursor-pointer flex items-center justify-center active:scale-95"
										title={`Adicionar Insumo para ${store.name}`}>
										<Plus size={20} strokeWidth={3} />
									</button>

									<button
										onClick={() => toggleStore(store.id)}
										className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
										{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
									</button>
								</div>
							</div>

							{/* Lista Simples de Pedidos da Loja (Quando Aberta) */}
							{isExpanded && (
								<div className="p-6 md:p-8 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-6 animate-in slide-in-from-top-2 duration-300">
									<div className="flex flex-row items-center justify-between gap-2 sm:gap-4 py-3 border-b border-slate-100 dark:border-slate-800">
										{/* Botões de Ordenação Lado a Lado no Mobile */}
										{totalPendingCount > 0 ? (
											<div className="flex justify-start">
												<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-0.5 sm:gap-1">
													{[
														{ id: "urgency", label: "Prior." },
														{ id: "date", label: "Data" },
														{ id: "alphabetical", label: "Alfab." },
													].map((sort) => (
														<button
															key={sort.id}
															onClick={() => setInsumosSort(sort.id as any)}
															className={`cursor-pointer px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
																insumosSort === sort.id
																	? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
																	: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
															}`}>
															{sort.label}
														</button>
													))}
												</div>
											</div>
										) : (
											<div />
										)}

										{/* Botão Adicionar e Botão Concluir Lado a Lado */}
										<div className="flex items-center gap-2 justify-end">
											<button
												onClick={() => handleOpenAddInsumoModal(store.id, store.name)}
												className="cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 sm:px-4 py-2 sm:py-3 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm active:scale-95 whitespace-nowrap"
												title={`Adicionar insumo para ${store.name}`}>
												<Plus size={16} strokeWidth={2.5} />
												<span className="hidden sm:inline">Adicionar</span>
											</button>

											<button
												onClick={() => handleOpenConcluirEntrega(store)}
												disabled={totalPendingCount === 0}
												className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-4 sm:px-6 py-2 sm:py-3 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm active:scale-95 whitespace-nowrap">
												<CheckCircle2 size={16} />
												<span>Concluir</span>
											</button>
										</div>
									</div>

									{totalPendingCount === 0 ? (
										<div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
											<Package className="mx-auto text-slate-300 dark:text-slate-600 mb-2" size={40} />
											<p className="text-slate-500 dark:text-slate-400 font-bold">
												Nenhum pedido de insumo pendente para a loja {store.name}.
											</p>
										</div>
									) : (
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
											{getStoreDisplayOrders(store).map((order) => {
												const isUrgent = order.urgency === "Urgente";
												const isChecked = !!order.checkedByGerencia;
												const isPending = !!order.isPendingSupply;

												return (
													<div
														key={order.id}
														id={`order-${store.id}-${order.id}`}
														className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 group ${
															isPending
																? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 opacity-60 shadow-xs"
																: isUrgent
																? "bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-xs"
																: isChecked
																? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 opacity-80"
																: "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 shadow-sm hover:border-slate-300"
														}`}>
														<div>
															<div className="flex items-center justify-between gap-3">
																{/* Checkbox Simples de Apoio Logístico */}
																<button
																	type="button"
																	onClick={() =>
																		handleToggleCheck(store.id, order.id, isChecked, store)
																	}
																	className={`cursor-pointer p-2.5 rounded-xl border transition-all shrink-0 self-center ${
																		isChecked
																			? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
																			: "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 hover:text-emerald-500 hover:border-emerald-400"
																	}`}
																	title={
																		isChecked
																			? "Conferido (clique para desmarcar)"
																			: "Marcar como conferido"
																	}>
																	<Check size={18} strokeWidth={isChecked ? 4 : 2.5} />
																</button>

																<div className="flex-1 min-w-0 flex flex-col items-start text-left justify-center self-center">
																	<h5
																		className={`text-xl md:text-2xl font-black uppercase break-words leading-tight text-left ${
																			isChecked
																				? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500/60"
																				: isPending
																				? "text-amber-900 dark:text-amber-200"
																				: "text-slate-800 dark:text-slate-100"
																		}`}>
																		{order.name}
																	</h5>

																	<div className="flex flex-wrap items-center gap-2 mt-2">
																		{isPending && (
																			<span className="flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
																				<Clock size={12} /> Pendência (Falta insumo)
																			</span>
																		)}

																		{isUrgent && !isPending && (
																			<span className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
																				<AlertTriangle size={12} /> Urgente
																			</span>
																		)}

																		{order.quantity && (
																			<span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
																				Qtd: {order.quantity}
																			</span>
																		)}
																	</div>
																</div>
															</div>

															{addedToSupplierOrderId === order.id && (
																<div className="mt-2 text-xs font-black text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1 text-center">
																	<Check size={14} />
																	<span>Adicionado à lista de Compras!</span>
																</div>
															)}
														</div>

														<div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-sm text-slate-400 font-bold gap-2">
															<span className="flex items-center gap-1.5 shrink-0">
																<Calendar size={14} />
																{formatDate(order.createdAt?.toDate())}
															</span>

															{/* Botão de Pendência (Sem borda, apenas o ícone de relógio) */}
															<button
																onClick={() =>
																	handleTogglePendingSupply(
																		store.id,
																		order.id,
																		isPending,
																		store,
																	)
																}
																className={`p-1.5 rounded-xl transition-all cursor-pointer shrink-0 ${
																	isPending
																		? "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
																		: "text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
																}`}
																title={
																	isPending
																		? "Marcar como disponível (remover pendência)"
																		: "Marcar como pendente (aguardando reposição)"
																}>
																<Clock size={18} />
															</button>

															{/* Botão de Compra no Centro */}
															<button
																onClick={() =>
																	handleAddToSupplierOrders(order.name, order.id)
																}
																className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-all cursor-pointer shrink-0"
																title="Comprar deste fornecedor (+ Pedido)">
																<ShoppingCart size={18} />
															</button>

															{/* Botão de Deletar / Cancelar Insumo da Loja */}
															<button
																onClick={() =>
																	setOrderToCancel({
																		storeId: store.id,
																		orderId: order.id,
																		orderName: order.name,
																	})
																}
																className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 transition-all cursor-pointer shrink-0"
																title="Deletar/Cancelar insumo da loja">
																<Trash2 size={18} />
															</button>

															{/* Botões de Reordenação Simples */}
															<div className="flex items-center gap-1 shrink-0">
																<button
																	type="button"
																	onClick={(e) => handleReorderOrder(store, order.id, "top", e)}
																	className="p-1.5 hover:text-blue-600 cursor-pointer text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
																	title="Mandar para o topo">
																	<ArrowUpToLine size={16} />
																</button>
																<button
																	type="button"
																	onClick={(e) => handleReorderOrder(store, order.id, "up", e)}
																	className="p-1.5 hover:text-blue-600 cursor-pointer text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
																	title="Subir">
																	<ArrowUp size={16} />
																</button>
																<button
																	type="button"
																	onClick={(e) => handleReorderOrder(store, order.id, "down", e)}
																	className="p-1.5 hover:text-blue-600 cursor-pointer text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
																	title="Descer">
																	<ArrowDown size={16} />
																</button>
																<button
																	type="button"
																	onClick={(e) => handleReorderOrder(store, order.id, "bottom", e)}
																	className="p-1.5 hover:text-blue-600 cursor-pointer text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
																	title="Mandar para o fundo">
																	<ArrowDownToLine size={16} />
																</button>
															</div>
														</div>
													</div>
												);
											})}
										</div>
									)}

									{/* SEÇÃO: HISTÓRICO DE LISTAS SALVAS */}
									<div className="pt-6 border-t border-slate-100 dark:border-slate-800">
										<button
											onClick={() => toggleSnapshotsHistory(store.id)}
											className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer group">
											<h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
												<ListChecks
													className={`${
														showSnapshotsHistory[store.id]
															? "text-blue-600 dark:text-blue-400"
															: "text-slate-400"
													}`}
													size={20}
												/>
												({(store.orderSnapshots || []).length}) Histórico de Entregas Salvas
											</h4>
											<span className="text-slate-400 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-200">
												{showSnapshotsHistory[store.id] ? "Recolher" : "Visualizar"}
											</span>
										</button>

										{showSnapshotsHistory[store.id] && (
											<div className="mt-3 space-y-3 animate-in fade-in duration-200">
												{/* Barra de Pesquisa de Entregas Salvas por Insumo */}
												<div className="relative">
													<Search
														size={16}
														className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
													/>
													<input
														type="text"
														placeholder="Pesquisar insumo nas entregas salvas..."
														value={snapshotSearchMap[store.id] || ""}
														onChange={(e) =>
															setSnapshotSearchMap((prev) => ({
																...prev,
																[store.id]: e.target.value,
															}))
														}
														className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-8 text-xs placeholder:text-[10.5px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
													/>
													{snapshotSearchMap[store.id] && (
														<button
															onClick={() =>
																setSnapshotSearchMap((prev) => ({
																	...prev,
																	[store.id]: "",
																}))
															}
															className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5">
															<X size={14} />
														</button>
													)}
												</div>

												{(() => {
													const term = normalizeSearchText(snapshotSearchMap[store.id] || "");
													const filteredSnapshots = (store.orderSnapshots || []).filter((snapshot) => {
														if (!term) return true;
														return (snapshot.items || []).some((item) =>
															normalizeSearchText(item.name || "").includes(term),
														);
													});

													if (filteredSnapshots.length === 0) {
														return (
															<p className="py-4 text-center text-xs text-slate-400">
																{term
																	? "Nenhuma entrega salva encontrada com este insumo."
																	: "Nenhuma entrega salva até o momento para esta loja."}
															</p>
														);
													}

													return filteredSnapshots.map((snapshot) => {
														const dateStr = snapshot.deliveredAt?.toDate
															? formatDate(snapshot.deliveredAt.toDate())
															: snapshot.closedAt?.toDate
															? formatDate(snapshot.closedAt.toDate())
															: "Data n/a";

														return (
															<div
																key={snapshot.id}
																onClick={() => setSelectedSnapshotModal(snapshot)}
																className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-blue-50/50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 flex items-center justify-between gap-3 cursor-pointer transition-all group shadow-xs">
																<div className="space-y-1 min-w-0">
																	<div className="flex items-center gap-2 flex-wrap">
																		<span className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
																			Entrega {dateStr}
																		</span>
																		<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
																			Finalizada
																		</span>
																	</div>
																	<p className="text-xs text-slate-500">
																		{snapshot.itemsCount} insumos entregues
																	</p>
																</div>

																<div className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0">
																	<ChevronDown size={18} className="-rotate-90" />
																</div>
															</div>
														);
													});
												})()}
											</div>
										)}
									</div>

									{/* SEÇÃO: HISTÓRICO DE INSUMOS INDIVIDUAIS */}
									<div className="pt-3 border-t border-slate-100 dark:border-slate-800">
										<button
											onClick={() => toggleHistory(store.id)}
											className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer group">
											<h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
												<CheckCircle2
													className={`${
														showHistory[store.id] ? "text-emerald-500" : "text-slate-400"
													}`}
													size={16}
												/>
												({store.historicalOrders.length}) Insumos Finalizados (Últimas 4 Semanas)
											</h4>
											<span className="text-slate-400 font-bold text-xs uppercase tracking-widest group-hover:text-slate-600 dark:group-hover:text-slate-200">
												{showHistory[store.id] ? "Recolher" : "Visualizar"}
											</span>
										</button>

										{showHistory[store.id] && (
											<div className="mt-3 space-y-3 animate-in fade-in duration-300">
												{/* Barra de Pesquisa de Insumos Finalizados */}
												<div className="relative">
													<Search
														size={16}
														className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
													/>
													<input
														type="text"
														placeholder="Pesquisar nos insumos finalizados..."
														value={historySearchMap[store.id] || ""}
														onChange={(e) =>
															setHistorySearchMap((prev) => ({
																...prev,
																[store.id]: e.target.value,
															}))
														}
														className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-8 text-xs placeholder:text-[10.5px] font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
													/>
													{historySearchMap[store.id] && (
														<button
															onClick={() =>
																setHistorySearchMap((prev) => ({
																	...prev,
																	[store.id]: "",
																}))
															}
															className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5">
															<X size={14} />
														</button>
													)}
												</div>

												{(() => {
													const term = normalizeSearchText(historySearchMap[store.id] || "");
													const filteredOrders = store.historicalOrders.filter((order) => {
														if (!term) return true;
														return normalizeSearchText(order.name || "").includes(term);
													});

													if (filteredOrders.length === 0) {
														return (
															<p className="py-4 text-center text-xs text-slate-400 italic">
																{term
																	? "Nenhum insumo finalizado encontrado."
																	: "Nenhum histórico recente."}
															</p>
														);
													}

													return (
														<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 opacity-80">
															{filteredOrders.map((order) => (
																<div
																	key={order.id}
																	className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
																		order.status === "cancelled"
																			? "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
																			: "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60"
																	}`}>
																	<div className="min-w-0 flex-1">
																		<p
																			className={`font-bold truncate ${
																				order.status === "cancelled"
																					? "text-red-700 dark:text-red-400"
																					: "text-slate-700 dark:text-slate-300 line-through"
																			}`}>
																			{order.name}
																			{order.quantity && ` (${order.quantity})`}
																		</p>
																		<p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
																			{order.status === "cancelled"
																				? "Cancelado em: "
																				: "Entregue em: "}
																			{formatDate(order.deliveredAt?.toDate())}
																		</p>
																	</div>
																	<div className="shrink-0">
																		{order.status === "cancelled" ? (
																			<Trash2 size={14} className="text-red-500" />
																		) : (
																			<CheckCircle2 size={14} className="text-emerald-500" />
																		)}
																	</div>
																</div>
															))}
														</div>
													);
												})()}
											</div>
										)}
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* MODAL: CONCLUIR ENTREGA */}
			{deliveryModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
						{/* Cabeçalho do Modal */}
						<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
							<div className="flex items-center gap-3">
								<div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-black">
									<CheckCircle2 size={24} />
								</div>
								<div>
									<h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">
										Concluir Entrega • Loja {deliveryModal.storeName}
									</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
										Insira ou edite as quantidades (opcionalmente) e remova os itens que não serão entregues.
									</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => handleOpenAddInsumoModal(deliveryModal.storeId, deliveryModal.storeName)}
									className="cursor-pointer p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center active:scale-95"
									title={`Adicionar insumo para ${deliveryModal.storeName}`}>
									<Plus size={18} strokeWidth={3} />
								</button>
								<button
									onClick={() => setDeliveryModal(null)}
									className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
									<X size={20} />
								</button>
							</div>
						</div>

						{/* Lista de Itens no Modal */}
						<div className="flex-1 overflow-y-auto py-4 pr-1 space-y-3 max-h-[55vh]">
							{deliveryModal.items.length === 0 ? (
								<div className="py-12 text-center text-slate-400">
									<p className="font-bold">Todos os itens foram removidos desta entrega.</p>
								</div>
							) : (
								deliveryModal.items.map((item) => {
									const hasQty = !!item.quantity && item.quantity.trim() !== "";
									const isAtMin = item.quantity === "1/3";

									return (
										<div
											key={item.id}
											className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
												item.checked
													? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
													: "bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
											}`}>
											{/* Topo do card: Checkbox e Nome do Insumo Centralizado Horizontalmente */}
											<div className="flex items-center justify-between gap-3 w-full">
												<button
													type="button"
													onClick={() => handleModalToggleCheck(item.id)}
													className={`cursor-pointer p-2.5 rounded-xl border transition-all shrink-0 ${
														item.checked
															? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
															: "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 hover:text-emerald-500"
													}`}
													title={item.checked ? "Conferido" : "Marcar conferido"}>
													<Check size={18} strokeWidth={item.checked ? 4 : 2.5} />
												</button>

												<div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1">
													<p
														className={`text-lg md:text-xl font-black uppercase break-words text-center leading-tight ${
															item.checked
																? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500"
																: "text-slate-800 dark:text-slate-100"
														}`}>
														{item.name}
													</p>
													{item.urgency === "Urgente" && (
														<span className="mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
															Urgente
														</span>
													)}
												</div>

												{/* Espaçador invisível para manter o nome centralizado perfeitamente */}
												<div className="w-[42px] shrink-0" />
											</div>

											{/* Base do card: Quantidade com botões +/- e Botão de Excluir */}
											<div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 w-full mt-1">
												<div className="flex items-center gap-2">
													<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
														Qtd:
													</span>
													<div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
														<button
															type="button"
															onClick={() => handleModalStepQuantity(item.id, -1)}
															disabled={isAtMin}
															className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all cursor-pointer">
															<Minus size={14} />
														</button>
														<span className="min-w-[28px] text-center text-xs font-black text-slate-800 dark:text-slate-100">
															{hasQty ? item.quantity : "-"}
														</span>
														<button
															type="button"
															onClick={() => handleModalStepQuantity(item.id, 1)}
															className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all cursor-pointer">
															<Plus size={14} />
														</button>
													</div>
												</div>

												<button
													type="button"
													onClick={() => handleModalRemoveItem(item.id)}
													className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shrink-0"
													title="Remover item da entrega (permanecerá pendente na loja)">
													<Trash2 size={18} />
												</button>
											</div>
										</div>
									);
								})
							)}
						</div>

						{/* Rodapé com botão Salvar e Finalizar */}
						<div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
							<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
								Total para entrega: <strong>{deliveryModal.items.length} itens</strong>
							</span>

							<div className="flex items-center gap-2 w-full sm:w-auto">
								<button
									onClick={() => setDeliveryModal(null)}
									className="cursor-pointer flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm transition-all">
									Cancelar
								</button>

								<button
									onClick={handleSalvarEFinalizar}
									disabled={savingDelivery || deliveryModal.items.length === 0}
									className="cursor-pointer flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-sm active:scale-95">
									{savingDelivery ? (
										<RefreshCw className="animate-spin" size={16} />
									) : (
										<CheckCircle2 size={18} />
									)}
									<span>Salvar e Finalizar</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* MODAL: VISUALIZAR DETALHES DE UMA LISTA SALVA NO HISTÓRICO */}
			{selectedSnapshotModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
						<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
							<div>
								<h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
									<ListChecks className="text-blue-600" size={22} />
									Entrega • Loja {selectedSnapshotModal.storeName}
								</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
									Entregue em:{" "}
									{selectedSnapshotModal.deliveredAt?.toDate
										? formatDate(selectedSnapshotModal.deliveredAt.toDate())
										: selectedSnapshotModal.closedAt?.toDate
										? formatDate(selectedSnapshotModal.closedAt.toDate())
										: "n/a"}
								</p>
							</div>
							<button
								onClick={() => setSelectedSnapshotModal(null)}
								className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
								<X size={20} />
							</button>
						</div>

						<div className="py-4 flex items-center justify-between">
							<span className="text-xs font-black text-slate-500 uppercase tracking-wider">
								{selectedSnapshotModal.itemsCount} insumos entregues:
							</span>
							<button
								onClick={() => handleCopySnapshot(selectedSnapshotModal)}
								className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
								{copiedSnapshotId === selectedSnapshotModal.id ? (
									<>
										<Check className="text-emerald-500" size={14} />
										<span className="text-emerald-600">Copiado!</span>
									</>
								) : (
									<>
										<Copy size={14} />
										<span>Copiar Lista</span>
									</>
								)}
							</button>
						</div>

						{/* Itens */}
						<div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[50vh]">
							{(selectedSnapshotModal.items || []).map((item, idx) => (
								<div
									key={item.id || idx}
									className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs">
									<span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
										{item.name}
									</span>
									<div className="flex items-center gap-2">
										{item.quantity && (
											<span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
												Qtd: {item.quantity}
											</span>
										)}
										{item.urgency === "Urgente" && (
											<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
												Urgente
											</span>
										)}
									</div>
								</div>
							))}
						</div>

						<div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex justify-end">
							<button
								onClick={() => setSelectedSnapshotModal(null)}
								className="cursor-pointer px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm">
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL: CONFIRMAR CANCELAMENTO / EXCLUSÃO DE INSUMO DA LOJA */}
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
							Tem certeza que deseja cancelar esta solicitação de insumo
							{orderToCancel.orderName ? ` (${orderToCancel.orderName})` : ""}? Ela será movida para o histórico como cancelada.
						</p>
						<div className="flex flex-col gap-3">
							<button
								onClick={handleCancelOrder}
								disabled={cancelingOrder}
								className="cursor-pointer w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-red-100 dark:shadow-none flex items-center justify-center gap-2">
								{cancelingOrder ? <RefreshCw className="animate-spin" size={18} /> : null}
								<span>Sim, cancelar pedido</span>
							</button>
							<button
								onClick={() => setOrderToCancel(null)}
								disabled={cancelingOrder}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-600 dark:text-slate-400 font-black py-3.5 rounded-2xl transition-all">
								Não, manter
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL: ADICIONAR INSUMO NA LOJA */}
			{addInsumoModalStore && (() => {
				const currentStoreData = allData.find((d) => d.id === addInsumoModalStore.storeId);
				const existingPendingOrders = currentStoreData ? currentStoreData.pendingOrders : [];
				const normalizedQuery = normalizeSearchText(newInsumoName);

				const filteredInventory = INVENTORY_DATA.map((cat) => ({
					...cat,
					items: cat.items
						.filter((item) => normalizeSearchText(item).includes(normalizedQuery))
						.filter(
							(item) =>
								!existingPendingOrders.some(
									(order) => normalizeSearchText(order.name) === normalizeSearchText(item),
								),
						),
				})).filter((cat) => cat.items.length > 0);

				return (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
						<div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
							{/* Cabeçalho */}
							<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
								<div className="flex items-center gap-3">
									<div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-black">
										<Plus size={24} />
									</div>
									<div>
										<h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">
											Adicionar Insumo • {addInsumoModalStore.storeName}
										</h3>
										<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
											Selecione ou digite o insumo que deseja solicitar para a loja.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setAddInsumoModalStore(null)}
									className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
									<X size={20} />
								</button>
							</div>

							{/* Formulário */}
							<form onSubmit={handleSaveNewInsumo} className="flex flex-col gap-5 py-4 overflow-y-visible">
								{/* Campo Insumo */}
								<div className="space-y-1 relative">
									<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
										Insumo *
									</label>
									<div className="relative">
										<input
											type="text"
											required
											autoFocus
											placeholder="BUSCAR OU DIGITAR INSUMO..."
											value={newInsumoName}
											onFocus={() => setIsInsumoDropdownOpen(true)}
											onBlur={() => setTimeout(() => setIsInsumoDropdownOpen(false), 250)}
											onChange={(e) => {
												setNewInsumoName(e.target.value.toUpperCase());
												setIsInsumoDropdownOpen(true);
											}}
											autoComplete="off"
											className="w-full h-[50px] px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-800 dark:text-slate-200 font-bold placeholder:font-medium uppercase text-sm"
										/>
										<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
											<ChevronDown size={18} />
										</div>

										{/* Dropdown Results */}
										{isInsumoDropdownOpen && (
											<div className="absolute z-50 left-0 right-0 mt-2 max-h-[240px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
												{filteredInventory.length > 0 ? (
													filteredInventory.map((category) => (
														<div key={category.category}>
															<div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-y border-slate-100 dark:border-slate-800 first:border-t-0">
																{category.category}
															</div>
															{category.items.map((item) => (
																<div
																	key={item}
																	onMouseDown={(e) => {
																		e.preventDefault();
																		setNewInsumoName(item);
																		setIsInsumoDropdownOpen(false);
																	}}
																	className="px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between group">
																	<span>{item}</span>
																	<Plus
																		size={14}
																		className="opacity-0 group-hover:opacity-100 transition-opacity"
																	/>
																</div>
															))}
														</div>
													))
												) : (
													newInsumoName.trim() !== "" && (
														<div className="px-4 py-4 text-center">
															<p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
																Adicionar item personalizado:
															</p>
															<p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
																&quot;{newInsumoName}&quot;
															</p>
														</div>
													)
												)}
											</div>
										)}
									</div>
								</div>

								{/* Campo Quantidade e Prioridade */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									{/* Quantidade */}
									<div className="space-y-1">
										<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
											Qtd (opcional)
										</label>
										<div className="flex items-center justify-between w-full h-[50px] px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
											<button
												type="button"
												onClick={() => {
													const cur = parseInt(newInsumoQuantity, 10);
													if (isNaN(cur) || cur <= 1) {
														setNewInsumoQuantity("");
													} else {
														setNewInsumoQuantity((cur - 1).toString());
													}
												}}
												disabled={!newInsumoQuantity || parseInt(newInsumoQuantity, 10) <= 0}
												className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer transition-all">
												<Minus size={16} />
											</button>

											<span className="text-sm font-black text-slate-800 dark:text-slate-100 select-none">
												{newInsumoQuantity ? (
													newInsumoQuantity
												) : (
													<span className="text-slate-400 font-bold text-xs">-</span>
												)}
											</span>

											<button
												type="button"
												onClick={() => {
													const cur = parseInt(newInsumoQuantity, 10);
													if (isNaN(cur) || cur <= 0) {
														setNewInsumoQuantity("1");
													} else {
														setNewInsumoQuantity((cur + 1).toString());
													}
												}}
												className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xs cursor-pointer transition-all">
												<Plus size={16} />
											</button>
										</div>
									</div>

									{/* Prioridade */}
									<div className="space-y-1">
										<label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-1">
											Prioridade
										</label>
										<button
											type="button"
											onClick={() => setNewInsumoIsUrgent(!newInsumoIsUrgent)}
											className={`w-full h-[50px] rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
												newInsumoIsUrgent
													? "bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-md shadow-red-200 dark:shadow-none animate-pulse"
													: "bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-red-600 hover:border-red-300"
											}`}>
											<AlertTriangle size={16} />
											<span>{newInsumoIsUrgent ? "🚨 Urgente" : "Urgente?"}</span>
										</button>
									</div>
								</div>

								{/* Ações */}
								<div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 mt-2">
									<button
										type="button"
										onClick={() => setAddInsumoModalStore(null)}
										className="cursor-pointer px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm transition-all">
										Cancelar
									</button>

									<button
										type="submit"
										disabled={addingInsumo || !newInsumoName.trim()}
										className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-sm active:scale-95">
										{addingInsumo ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} strokeWidth={3} />}
										<span>Adicionar Insumo</span>
									</button>
								</div>
							</form>
						</div>
					</div>
				);
			})()}
		</div>
	);
}
