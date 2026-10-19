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
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	pendingOrders: SupplyOrder[];
	historicalOrders: SupplyOrder[];
	orderSnapshots: SupplyOrderSnapshot[];
	urgentCount: number;
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

					return {
						id,
						name: STORE_NAMES[id],
						pendingOrders: sPending,
						historicalOrders: sHistory,
						orderSnapshots: sSnapshots,
						urgentCount,
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
	) => {
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
			if (currentIndex === currentOrders.length - 1) return;
			targetIndex = currentOrders.length - 1;
		}

		if (targetIndex === currentIndex) return;

		const newOrders = [...currentOrders];
		const [movedOrder] = newOrders.splice(currentIndex, 1);
		newOrders.splice(targetIndex, 0, movedOrder);

		const finalIds = newOrders.map((o) => o.id);
		setManualOrderMap((prev) => ({
			...prev,
			[store.id]: finalIds,
		}));
		setInsumosSort("manual");
	};

	// Toggle check simples na visualização da gerência
	const handleToggleCheck = async (storeId: string, orderId: string, currentChecked: boolean) => {
		try {
			const orderRef = doc(db, "stores", storeId, "supplyOrders", orderId);
			await updateDoc(orderRef, {
				checkedByGerencia: !currentChecked,
			});
		} catch (error) {
			console.error("Erro ao alternar check:", error);
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

	// ABRIR MODAL: CONCLUIR ENTREGA
	const handleOpenConcluirEntrega = (store: FullStoreData) => {
		const sorted = getStoreDisplayOrders(store);
		const modalItems: DeliveryModalItem[] = sorted.map((o) => ({
			id: o.id,
			name: o.name,
			urgency: o.urgency,
			quantity: o.quantity || "",
			checked: !!o.checkedByGerencia,
			createdAt: o.createdAt || null,
		}));

		setDeliveryModal({
			storeId: store.id,
			storeName: store.name,
			items: modalItems,
		});
	};

	// MODAL: ALTERAR QUANTIDADE DE UM ITEM
	const handleModalUpdateQuantity = (itemId: string, newQty: string) => {
		if (!deliveryModal) return;
		setDeliveryModal({
			...deliveryModal,
			items: deliveryModal.items.map((i) =>
				i.id === itemId ? { ...i, quantity: newQty } : i,
			),
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
			const snapshotItems: SupplyOrderSnapshotItem[] = items.map((i) => ({
				id: i.id,
				name: i.name,
				urgency: i.urgency,
				quantity: i.quantity.trim() || undefined,
				category: getInsumoCategory(i.name),
				checked: i.checked,
				createdAt: i.createdAt || null,
			}));

			const snapshotsRef = collection(db, "stores", storeId, "supplyOrderSnapshots");
			await addDoc(snapshotsRef, {
				storeId,
				storeName,
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
						placeholder="Pesquisar insumo nos pedidos pendentes das lojas..."
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
					const pendingCount = store.pendingOrders.length;
					const urgentCount = store.urgentCount;

					return (
						<div
							key={store.id}
							className="bg-white dark:bg-slate-900 rounded-[36px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
							{/* Header da Loja */}
							<div className="p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-all">
								<div
									onClick={() => toggleStore(store.id)}
									className="flex items-center gap-4 text-left cursor-pointer flex-1 min-w-0">
									<div
										className={`p-4 md:p-5 rounded-[24px] text-white shadow-lg shrink-0 transition-all ${
											urgentCount > 0
												? "bg-red-600 shadow-red-200 dark:shadow-none animate-pulse"
												: pendingCount > 0
												? "bg-blue-600 shadow-blue-200 dark:shadow-none"
												: "bg-emerald-600 shadow-emerald-200 dark:shadow-none"
										}`}>
										<Store size={32} />
									</div>

									<div className="min-w-0">
										<div className="flex items-center gap-3 flex-wrap">
											<h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
												{store.name}
											</h3>

											{/* INDICAÇÃO VISUAL DE ITENS URGENTES (visível inclusive quando toggle fechado) */}
											{urgentCount > 0 && (
												<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse shadow-xs">
													<AlertTriangle size={14} className="text-red-600" />
													<span>
														{urgentCount} Urgente{urgentCount > 1 ? "s" : ""}
													</span>
												</span>
											)}
										</div>

										<div className="flex flex-wrap items-center gap-3 mt-2">
											{pendingCount === 0 ? (
												<p className="font-bold text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
													<CheckCircle2 size={16} /> Nada pendente
												</p>
											) : (
												<p className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
													<strong className="text-base font-black text-blue-600 dark:text-blue-400">
														{pendingCount}
													</strong>{" "}
													{pendingCount === 1 ? "insumo solicitado" : "insumos solicitados"}
												</p>
											)}
										</div>
									</div>
								</div>

								{/* Ações da Loja no Topo: Botão "Concluir Entrega" */}
								<div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
									<button
										onClick={() => handleOpenConcluirEntrega(store)}
										disabled={pendingCount === 0}
										className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center gap-2.5 text-sm active:scale-95">
										<CheckCircle2 size={20} />
										<span>Concluir Entrega</span>
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
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800">
										<h4 className="text-base font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
											<Package className="text-blue-600" size={18} />
											Pedidos de Insumos da Loja ({pendingCount})
										</h4>

										{pendingCount > 0 && (
											<div className="flex items-center gap-2">
												<span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
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
															onClick={() => setInsumosSort(sort.id as any)}
															className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
																insumosSort === sort.id
																	? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
																	: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
															}`}>
															{sort.label}
														</button>
													))}
												</div>
											</div>
										)}
									</div>

									{pendingCount === 0 ? (
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

												return (
													<div
														key={order.id}
														id={`order-${store.id}-${order.id}`}
														className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 group ${
															isUrgent
																? "bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-900/60 shadow-xs"
																: isChecked
																? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 opacity-80"
																: "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 shadow-sm hover:border-slate-300"
														}`}>
														<div>
															<div className="flex items-start justify-between gap-3">
																{/* Checkbox Simples de Apoio Logístico */}
																<button
																	type="button"
																	onClick={() =>
																		handleToggleCheck(store.id, order.id, isChecked)
																	}
																	className={`cursor-pointer p-2.5 rounded-xl border transition-all shrink-0 ${
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

																<div className="flex-1 min-w-0">
																	<h5
																		className={`text-base md:text-lg font-black uppercase break-words leading-tight ${
																			isChecked
																				? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500/60"
																				: "text-slate-800 dark:text-slate-100"
																		}`}>
																		{order.name}
																	</h5>

																	<div className="flex flex-wrap items-center gap-2 mt-2">
																		{isUrgent && (
																			<span className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs animate-pulse">
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

																<button
																	onClick={() =>
																		handleAddToSupplierOrders(order.name, order.id)
																	}
																	className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-all cursor-pointer shrink-0"
																	title="Comprar deste fornecedor (+ Pedido)">
																	<ShoppingCart size={16} />
																</button>
															</div>

															{addedToSupplierOrderId === order.id && (
																<div className="mt-2 text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1">
																	<Check size={12} />
																	<span>Adicionado à lista de Compras!</span>
																</div>
															)}
														</div>

														<div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-400 font-bold">
															<span className="flex items-center gap-1">
																<Calendar size={12} />
																{formatDate(order.createdAt?.toDate())}
															</span>

															{/* Botões de Reordenação Simples */}
															<div className="flex items-center gap-1">
																<button
																	onClick={() => handleReorderOrder(store, order.id, "top")}
																	className="p-1 hover:text-blue-600 cursor-pointer"
																	title="Mandar para o topo">
																	<ArrowUpToLine size={14} />
																</button>
																<button
																	onClick={() => handleReorderOrder(store, order.id, "up")}
																	className="p-1 hover:text-blue-600 cursor-pointer"
																	title="Subir">
																	<ArrowUp size={14} />
																</button>
																<button
																	onClick={() => handleReorderOrder(store, order.id, "down")}
																	className="p-1 hover:text-blue-600 cursor-pointer"
																	title="Descer">
																	<ArrowDown size={14} />
																</button>
																<button
																	onClick={() => handleReorderOrder(store, order.id, "bottom")}
																	className="p-1 hover:text-blue-600 cursor-pointer"
																	title="Mandar para o fundo">
																	<ArrowDownToLine size={14} />
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
												{(store.orderSnapshots || []).map((snapshot) => {
													const dateStr = snapshot.deliveredAt?.toDate
														? formatDate(snapshot.deliveredAt.toDate())
														: snapshot.closedAt?.toDate
														? formatDate(snapshot.closedAt.toDate())
														: "Data n/a";

													return (
														<div
															key={snapshot.id}
															className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
															<div className="space-y-1">
																<div className="flex items-center gap-2">
																	<span className="text-sm font-black text-slate-800 dark:text-slate-100">
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

															<div className="flex items-center gap-2">
																<button
																	onClick={() => handleCopySnapshot(snapshot)}
																	className="cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
																	{copiedSnapshotId === snapshot.id ? (
																		<>
																			<Check className="text-emerald-500" size={14} />
																			<span>Copiado!</span>
																		</>
																	) : (
																		<>
																			<Copy size={14} />
																			<span>WhatsApp</span>
																		</>
																	)}
																</button>

																<button
																	onClick={() => setSelectedSnapshotModal(snapshot)}
																	className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs">
																	<ExternalLink size={14} />
																	<span>Ver Itens ({snapshot.itemsCount})</span>
																</button>
															</div>
														</div>
													);
												})}

												{(store.orderSnapshots || []).length === 0 && (
													<p className="py-4 text-center text-xs text-slate-400">
														Nenhuma entrega salva até o momento para esta loja.
													</p>
												)}
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
											<div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 opacity-80 animate-in fade-in duration-300">
												{store.historicalOrders.map((order) => (
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
												{store.historicalOrders.length === 0 && (
													<p className="col-span-full py-4 text-center text-xs text-slate-400 italic">
														Nenhum histórico recente.
													</p>
												)}
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
							<button
								onClick={() => setDeliveryModal(null)}
								className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
								<X size={20} />
							</button>
						</div>

						{/* Lista de Itens no Modal */}
						<div className="flex-1 overflow-y-auto py-4 pr-1 space-y-3 max-h-[55vh]">
							{deliveryModal.items.length === 0 ? (
								<div className="py-12 text-center text-slate-400">
									<p className="font-bold">Todos os itens foram removidos desta entrega.</p>
								</div>
							) : (
								deliveryModal.items.map((item) => (
									<div
										key={item.id}
										className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
											item.checked
												? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
												: "bg-slate-50/70 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
										}`}>
										<div className="flex items-center gap-3 flex-1 min-w-0">
											<button
												type="button"
												onClick={() => handleModalToggleCheck(item.id)}
												className={`cursor-pointer p-2 rounded-xl border transition-all shrink-0 ${
													item.checked
														? "bg-emerald-600 border-emerald-600 text-white"
														: "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-300 hover:text-emerald-500"
												}`}
												title={item.checked ? "Conferido" : "Marcar conferido"}>
												<Check size={16} strokeWidth={item.checked ? 4 : 2.5} />
											</button>

											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2 flex-wrap">
													<p
														className={`text-sm md:text-base font-black uppercase truncate ${
															item.checked
																? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500"
																: "text-slate-800 dark:text-slate-100"
														}`}>
														{item.name}
													</p>
													{item.urgency === "Urgente" && (
														<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
															Urgente
														</span>
													)}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
											<div className="flex items-center gap-1.5">
												<label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">
													Qtd:
												</label>
												<input
													type="text"
													placeholder="Ex: 2 un, 1 cx"
													value={item.quantity}
													onChange={(e) => handleModalUpdateQuantity(item.id, e.target.value)}
													className="w-32 px-3 py-1.5 text-xs font-black text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
												/>
											</div>

											<button
												type="button"
												onClick={() => handleModalRemoveItem(item.id)}
												className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shrink-0"
												title="Remover item da entrega (permanecerá pendente na loja)">
												<Trash2 size={16} />
											</button>
										</div>
									</div>
								))
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
		</div>
	);
}
