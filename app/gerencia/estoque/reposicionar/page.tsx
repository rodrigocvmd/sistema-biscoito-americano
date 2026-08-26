"use client";

import { useEffect, useState, Fragment, useRef } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	getDocs,
	query,
	orderBy,
	where,
	Timestamp,
	runTransaction,
	doc,
	collectionGroup,
	limit,
	addDoc,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	sortStockEntries,
	StockData,
	STORE_NAMES,
	StoreId,
	formatDate,
	RepositionHistory,
} from "@/types";
import {
	RefreshCw,
	ArrowRight,
	ArrowRightLeft,
	ChevronDown,
	ChevronUp,
	Save,
	Send,
	Printer,
	MessageCircle,
	History,
	Search,
	Eye,
	EyeOff,
	X,
	AlertCircle,
	FileText,
	PieChart,
	Check,
} from "lucide-react";
import { setDoc } from "firebase/firestore";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, number>>;
}

const STORE_ORDER: StoreId[] = ["lago", "noroeste", "terraco", "conjunto"];

export default function EstoqueReposicionarPage() {
	const [activeSubTab, setActiveSubTab] = useState<"reposicionar" | "proporcao">("reposicionar");
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const isInitialized = useRef(false);

	// Proporção Desejável States
	const [desiredTotalData, setDesiredTotalData] = useState<Partial<StockData>>({});
	const [storeProportions, setStoreProportions] = useState<Record<StoreId, Partial<StockData>>>({
		lago: {},
		noroeste: {},
		terraco: {},
		conjunto: {},
	});
	const [localStoreProportions, setLocalStoreProportions] = useState<Record<StoreId, Partial<StockData>>>({
		lago: {},
		noroeste: {},
		terraco: {},
		conjunto: {},
	});
	const [savingProportions, setSavingProportions] = useState(false);
	const [proportionSearchTerm, setProportionSearchTerm] = useState("");

	// Estado da seleção ativa para reposicionamento interativo por cliques
	const [activeSelection, setActiveSelection] = useState<{
		item: keyof StockData;
		fromStore: StoreId;
		qty: number;
	} | null>(null);

	// Modal de aviso quando o clique exceder o estoque disponível na loja de origem
	const [stockWarningModal, setStockWarningModal] = useState<{
		item: keyof StockData;
		fromStore: StoreId;
		intendedQty: number;
		availableStock: number;
	} | null>(null);

	const [projectedStocks, setProjectedStocks] = useState<Record<StoreId, Partial<StockData>>>({
		conjunto: {},
		terraco: {},
		lago: {},
		noroeste: {},
	});
	const [savingRepos, setSavingRepos] = useState(false);
	const [expandedItem, setExpandedItem] = useState<keyof StockData | null>(null);
	const [historyForItem, setHistoryForItem] = useState<RepositionHistory[]>([]);
	const [loadingLastRepo, setLoadingLastRepo] = useState(false);
	const [showAllHistory, setShowAllHistory] = useState(false);
	const [allHistory, setAllHistory] = useState<RepositionHistory[]>([]);
	const [loadingAllHistory, setLoadingAllHistory] = useState(false);
	const [showSummary, setShowSummary] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(false);

	const [searchTerm, setSearchTerm] = useState("");
	const [hideOpen, setHideOpen] = useState(false);

	const [startingRepo, setStartingRepo] = useState(false);
	const [isFinalizedSession, setIsFinalizedSession] = useState(false);
	const [showPostFinalizationBanner, setShowPostFinalizationBanner] = useState(false);
	const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
	const [lastFinalizedDate, setLastFinalizedDate] = useState<string | null>(null);
	const isSavedThisRun = useRef(false);

	const handleCloseSummary = () => {
		setShowSummary(false);
		if (isFinalizedSession) {
			setShowPostFinalizationBanner(true);
		}
	};

	// Sempre que houver qualquer modificação na projeção de estoque, invalidar o status de salvo.
	useEffect(() => {
		if (isInitialized.current) {
			isSavedThisRun.current = false;
		}
	}, [projectedStocks]);

	// Load projected stocks from localStorage on mount
	useEffect(() => {
		const savedProjected = localStorage.getItem("repos_projected_stocks");
		const savedDate = localStorage.getItem("repos_last_finalized_date");
		
		if (savedDate) {
			setLastFinalizedDate(savedDate);
		}
		if (savedProjected) {
			setProjectedStocks(JSON.parse(savedProjected));
			// Se carregamos do localStorage, marcamos como inicializado para evitar sobreposição
			isInitialized.current = true;
		}
	}, []);

	// Save to localStorage on change
	useEffect(() => {
		if (isInitialized.current && Object.keys(projectedStocks.lago).length > 0) {
			localStorage.setItem("repos_projected_stocks", JSON.stringify(projectedStocks));
		}
	}, [projectedStocks]);

	useEffect(() => {
		const unsubscribeStores = onSnapshot(collection(db, "stores"), (storesSnapshot) => {
			const storesMap: Record<string, any> = {};
			storesSnapshot.docs.forEach((doc) => {
				storesMap[doc.id] = doc.data();
			});

			const newFullData = STORE_ORDER.map((id) => {
				const storeDoc = storesMap[id] || {};
				return {
					id,
					name: STORE_NAMES[id],
					lastStockUpdate: storeDoc.lastStockUpdate?.toDate() || null,
					stock: storeDoc.stock || {},
					isUnits: storeDoc.isUnits || {},
				};
			});
			setAllData(newFullData);
			setLoading(false);
		});
		return () => unsubscribeStores();
	}, []);

	// Buscar metas desejáveis (doc 'global') e proporções de cada loja
	useEffect(() => {
		const unsubscribeDesired = onSnapshot(collection(db, "desiredStocks"), (snapshot) => {
			let globalDesired: Partial<StockData> = {};
			const propsByStore: Record<StoreId, Partial<StockData>> = {
				lago: {},
				noroeste: {},
				terraco: {},
				conjunto: {},
			};

			const globalDoc = snapshot.docs.find((d) => d.id === "global");
			if (globalDoc) {
				const data = globalDoc.data();
				globalDesired = data.stock || {};
				if (data.storeProportions) {
					STORE_ORDER.forEach((sId) => {
						propsByStore[sId] = data.storeProportions[sId] || {};
					});
				}
			}

			// Fallback ou dados individuais de cada loja caso salvos por doc
			snapshot.docs.forEach((d) => {
				if (STORE_ORDER.includes(d.id as StoreId)) {
					const sId = d.id as StoreId;
					const storeStock = (d.data().stock || {}) as Partial<StockData>;
					if (Object.keys(storeStock).length > 0) {
						propsByStore[sId] = { ...propsByStore[sId], ...storeStock };
					}
				}
			});

			setDesiredTotalData(globalDesired);
			setStoreProportions(propsByStore);
			setLocalStoreProportions(JSON.parse(JSON.stringify(propsByStore)));
		});

		return () => unsubscribeDesired();
	}, []);

	// Helper para calcular a cor do espectro de vermelho (distante) a verde (ideal)
	const getProportionIndicatorColor = (currentVal: number, targetVal: number) => {
		if (targetVal === 0 && currentVal === 0) {
			return { bg: "bg-emerald-500", style: { backgroundColor: "hsl(142, 76%, 45%)" }, diffText: "0" };
		}
		const diff = Math.abs(currentVal - targetVal);
		// Normalização da distância: quanto maior a discrepância relativa ao alvo (ou a 5 un.), mais próximo de 0 (vermelho)
		const maxRef = Math.max(targetVal, 4);
		const ratio = Math.min(diff / maxRef, 1); // 0 = exato (perfeito), 1 = muito longe
		// Matiz HSL: 142 (verde) quando ratio=0, até 0 (vermelho puro) quando ratio=1
		const hue = Math.round(142 * (1 - ratio));
		return {
			style: {
				backgroundColor: `hsl(${hue}, 85%, 45%)`,
				boxShadow: `0 0 6px hsla(${hue}, 85%, 45%, 0.4)`,
			},
			diffText: diff === 0 ? "0" : (currentVal > targetVal ? `+${diff}` : `-${diff}`),
		};
	};

	const handleLocalProportionChange = (storeId: StoreId, itemKey: keyof StockData, value: string) => {
		if (value === "") {
			setLocalStoreProportions((prev) => ({
				...prev,
				[storeId]: {
					...prev[storeId],
					[itemKey]: undefined,
				},
			}));
			return;
		}

		let inputNum = Math.max(0, parseInt(value) || 0);
		const metaGlobal = desiredTotalData[itemKey] || 0;

		if (metaGlobal > 0) {
			// Soma das outras lojas para este mesmo item
			const sumOtherStores = STORE_ORDER
				.filter((sId) => sId !== storeId)
				.reduce((acc, sId) => acc + (localStoreProportions[sId]?.[itemKey] || 0), 0);

			const maxAllowed = Math.max(0, metaGlobal - sumOtherStores);
			inputNum = Math.min(inputNum, maxAllowed);
		}

		setLocalStoreProportions((prev) => ({
			...prev,
			[storeId]: {
				...prev[storeId],
				[itemKey]: inputNum,
			},
		}));
	};

	const saveProportions = async () => {
		setSavingProportions(true);
		try {
			// Salva no doc global dentro de storeProportions e também individualmente por doc para compatibilidade
			const globalDocRef = doc(db, "desiredStocks", "global");
			await setDoc(globalDocRef, { storeProportions: localStoreProportions }, { merge: true });

			for (const sId of STORE_ORDER) {
				const storeDocRef = doc(db, "desiredStocks", sId);
				await setDoc(storeDocRef, { stock: localStoreProportions[sId] || {} }, { merge: true });
			}

			setActiveSubTab("reposicionar");
		} catch (error) {
			console.error("Erro ao salvar proporções desejáveis:", error);
			alert("Erro ao salvar proporções. Verifique o console.");
		} finally {
			setSavingProportions(false);
		}
	};

	// Inicialização única baseada no allData (apenas se não houver dados no localStorage)
	useEffect(() => {
		if (allData.length > 0 && !isInitialized.current) {
			const initialProjected: any = {};
			allData.forEach((store) => {
				initialProjected[store.id] = { ...store.stock };
			});
			setProjectedStocks(initialProjected);
			
			// Marcamos como inicializado IMEDIATAMENTE após a primeira carga do Firestore
			isInitialized.current = true;
		}
	}, [allData]);

	const resetProjectedStocks = () => {
		setShowResetConfirm(true);
	};

	const confirmResetProjectedStocks = async () => {
		setStartingRepo(true);
		try {
			const newSessionId = doc(collection(db, "unused")).id;
			localStorage.setItem("repos_session_id", newSessionId);

			// Salva a versão do estoque no início do reposicionamento (antes de qualquer alteração)
			const startState = {
				sessionId: newSessionId,
				type: "inicio",
				timestamp: Timestamp.now(),
				stores: {
					lago: {
						stock: allData.find((d) => d.id === "lago")?.stock || {},
						isUnits: allData.find((d) => d.id === "lago")?.isUnits || {},
					},
					conjunto: {
						stock: allData.find((d) => d.id === "conjunto")?.stock || {},
						isUnits: allData.find((d) => d.id === "conjunto")?.isUnits || {},
					},
					terraco: {
						stock: allData.find((d) => d.id === "terraco")?.stock || {},
						isUnits: allData.find((d) => d.id === "terraco")?.isUnits || {},
					},
					noroeste: {
						stock: allData.find((d) => d.id === "noroeste")?.stock || {},
						isUnits: allData.find((d) => d.id === "noroeste")?.isUnits || {},
					},
				},
			};
			await addDoc(collection(db, "repositionSnapshots"), startState);

			const initialProjected: any = {};
			allData.forEach((store) => {
				initialProjected[store.id] = { ...store.stock };
			});
			setProjectedStocks(initialProjected);
			setActiveSelection(null);
			
			// Limpar localStorage para alinhar com o novo início
			localStorage.removeItem("repos_projected_stocks");
			localStorage.removeItem("repos_item_transfers");
			localStorage.removeItem("repos_last_finalized_date");
			isSavedThisRun.current = false;
			setIsFinalizedSession(false);
			setShowPostFinalizationBanner(false);
			setLastFinalizedDate(null);

			setShowResetConfirm(false);
		} catch (error) {
			console.error("Erro ao salvar estado inicial de reposicionamento:", error);
			alert("Erro ao iniciar reposicionamento no banco de dados. Tente novamente.");
		} finally {
			setStartingRepo(false);
		}
	};

	// Manipulação do clique em célula para seleção de origem / incremento / transferência para destino
	const handleCellClick = (itemKey: keyof StockData, storeId: StoreId) => {
		const currentStock = projectedStocks[storeId][itemKey] || 0;

		// 1. Se não houver seleção ativa OU for um item diferente, seleciona esta célula como origem com quantidade 1
		if (!activeSelection || activeSelection.item !== itemKey) {
			if (1 > currentStock) {
				setStockWarningModal({
					item: itemKey,
					fromStore: storeId,
					intendedQty: 1,
					availableStock: currentStock,
				});
			} else {
				setActiveSelection({
					item: itemKey,
					fromStore: storeId,
					qty: 1,
				});
			}
			return;
		}

		// 2. Se a seleção ativa for para a MESMA loja de origem -> incrementa quantidade (+1)
		if (activeSelection.fromStore === storeId) {
			const nextQty = activeSelection.qty + 1;
			if (nextQty > currentStock) {
				setStockWarningModal({
					item: itemKey,
					fromStore: storeId,
					intendedQty: nextQty,
					availableStock: currentStock,
				});
			} else {
				setActiveSelection({
					...activeSelection,
					qty: nextQty,
				});
			}
			return;
		}

		// 3. Se a seleção ativa for para uma LOJA DIVERSA da mesma linha -> realiza a transferência de todos os itens em 1 clique!
		const transferQty = activeSelection.qty;
		const fromStore = activeSelection.fromStore;
		const toStore = storeId;

		setProjectedStocks((prev) => {
			const next = { ...prev };
			const stockFrom = { ...next[fromStore] };
			const stockTo = { ...next[toStore] };

			const vFrom = stockFrom[itemKey] || 0;
			const vTo = stockTo[itemKey] || 0;

			stockFrom[itemKey] = vFrom - transferQty;
			stockTo[itemKey] = vTo + transferQty;

			next[fromStore] = stockFrom;
			next[toStore] = stockTo;
			return next;
		});

		setActiveSelection(null);
	};

	const handleConfirmStockWarning = () => {
		if (stockWarningModal) {
			setActiveSelection({
				item: stockWarningModal.item,
				fromStore: stockWarningModal.fromStore,
				qty: stockWarningModal.intendedQty,
			});
			setStockWarningModal(null);
		}
	};

	const handleCancelStockWarning = () => {
		setStockWarningModal(null);
	};

	const sortedItems = sortStockEntries(Object.entries(STOCK_LABELS))
		.filter(([_, label]) => label.toLowerCase().includes(searchTerm.toLowerCase()));

	const calculateOptimizedSummary = () => {
		const movements: { item: keyof StockData; from: StoreId; to: StoreId; qty: number }[] = [];
		sortedItems.forEach(([itemKey, _]) => {
			const storeChanges: { storeId: StoreId; diff: number }[] = [];
			allData.forEach((store) => {
				const initial = store.stock[itemKey] || 0;
				const projected = projectedStocks[store.id][itemKey] || 0;
				const diff = projected - initial;
				if (diff !== 0) storeChanges.push({ storeId: store.id, diff });
			});
			const sources = storeChanges.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff);
			const sinks = storeChanges.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff);
			let sourceIdx = 0;
			let sinkIdx = 0;
			while (sourceIdx < sources.length && sinkIdx < sinks.length) {
				const source = sources[sourceIdx];
				const sink = sinks[sinkIdx];
				const amountToMove = Math.min(Math.abs(source.diff), sink.diff);
				movements.push({
					item: itemKey,
					from: source.storeId,
					to: sink.storeId,
					qty: amountToMove,
				});
				source.diff += amountToMove;
				sink.diff -= amountToMove;
				if (source.diff === 0) sourceIdx++;
				if (sink.diff === 0) sinkIdx++;
			}
		});
		return movements;
	};

	const finalizeReposition = async () => {
		const optimizedMovements = calculateOptimizedSummary();
		if (optimizedMovements.length === 0) {
			alert("Não há movimentações para finalizar.");
			return;
		}

		if (isSavedThisRun.current) {
			setIsFinalizedSession(true);
			setShowSummary(true);
			return;
		}

		setSavingRepos(true);
		try {
			await runTransaction(db, async (transaction) => {
				for (const move of optimizedMovements) {
					const newId = doc(collection(db, "unused")).id;
					const historyEntry: RepositionHistory = {
						timestamp: Timestamp.now(),
						itemId: move.item,
						fromStore: move.from,
						toStore: move.to,
						beforeFrom: allData.find((d) => d.id === move.from)?.stock[move.item] || 0,
						afterFrom: projectedStocks[move.from][move.item] || 0,
						beforeTo: allData.find((d) => d.id === move.to)?.stock[move.item] || 0,
						afterTo: projectedStocks[move.to][move.item] || 0,
						difference: move.qty,
					};
					transaction.set(doc(db, "stores", move.from, "repositions", newId), historyEntry);
					transaction.set(doc(db, "stores", move.to, "repositions", newId), historyEntry);
				}
			});

			// Salva a versão final do estoque de todas as lojas para futuras comparações
			const currentSessionId = localStorage.getItem("repos_session_id") || doc(collection(db, "unused")).id;
			const endState = {
				sessionId: currentSessionId,
				type: "fim",
				timestamp: Timestamp.now(),
				stores: {
					lago: {
						stock: projectedStocks.lago,
						isUnits: allData.find((d) => d.id === "lago")?.isUnits || {},
					},
					conjunto: {
						stock: projectedStocks.conjunto,
						isUnits: allData.find((d) => d.id === "conjunto")?.isUnits || {},
					},
					terraco: {
						stock: projectedStocks.terraco,
						isUnits: allData.find((d) => d.id === "terraco")?.isUnits || {},
					},
					noroeste: {
						stock: projectedStocks.noroeste,
						isUnits: allData.find((d) => d.id === "noroeste")?.isUnits || {},
					},
				},
			};
			await addDoc(collection(db, "repositionSnapshots"), endState);
			localStorage.removeItem("repos_session_id");

			const formattedNow = formatDate(new Date());
			setLastFinalizedDate(formattedNow);
			localStorage.setItem("repos_last_finalized_date", formattedNow);
			isSavedThisRun.current = true;
			setIsFinalizedSession(true);
			setShowSummary(true);
		} catch (error) {
			console.error("Erro ao finalizar reposicionamento:", error);
			alert("Erro ao salvar no histórico. Verifique o console.");
		} finally {
			setSavingRepos(false);
		}
	};

	const handlePrint = () => {
		window.print();
	};

	const handleWhatsApp = () => {
		const movements = calculateOptimizedSummary();
		if (movements.length === 0) return;

		const grouped = new Map<
			string,
			{ from: StoreId; to: StoreId; items: { label: string; qty: number }[] }
		>();
		movements.forEach((move) => {
			const key = `${move.from}-${move.to}`;
			if (!grouped.has(key)) {
				grouped.set(key, { from: move.from, to: move.to, items: [] });
			}
			grouped.get(key)!.items.push({
				label: STOCK_LABELS[move.item],
				qty: move.qty,
			});
		});

		const storeOrder: StoreId[] = ["lago", "noroeste", "terraco", "conjunto"];

		const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
			const fromDiff = storeOrder.indexOf(a.from) - storeOrder.indexOf(b.from);
			if (fromDiff !== 0) return fromDiff;
			return storeOrder.indexOf(a.to) - storeOrder.indexOf(b.to);
		});

		let text = `*Resumo de Reposicionamento - ${new Date().toLocaleDateString("pt-BR")}*\n\n`;

		sortedGroups.forEach((group) => {
			text += `*${STORE_NAMES[group.from]} → ${STORE_NAMES[group.to]}:*\n`;
			group.items.forEach((item) => {
				text += `• ${item.qty} ${item.label}\n`;
			});
			text += `\n`;
		});

		const encodedText = encodeURIComponent(text);
		window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
	};

	const fetchAllHistory = async () => {
		setLoadingAllHistory(true);
		try {
			const fourWeeksAgo = new Date();
			fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
			const tsLimit = Timestamp.fromDate(fourWeeksAgo);

			const q = query(
				collectionGroup(db, "repositions"),
				where("timestamp", ">=", tsLimit),
				orderBy("timestamp", "desc"),
				limit(200)
			);
			const snap = await getDocs(q);
			const seen = new Set();
			const history = snap.docs
				.map(doc => ({ id: doc.id, ...doc.data() } as RepositionHistory))
				.filter(item => {
					const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
					if (seen.has(uniqueKey)) return false;
					seen.add(uniqueKey);
					return true;
				});
			setAllHistory(history);
			setShowAllHistory(true);
		} catch (error) {
			console.error("Erro ao buscar histórico completo:", error);
			// Fallback: buscar das lojas principais sem orderBy (evita erro de índice)
			try {
				const fourWeeksAgo = new Date();
				fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
				const tsLimit = Timestamp.fromDate(fourWeeksAgo);

				const allRepos: RepositionHistory[] = [];
				for (const storeId of STORE_ORDER) {
					const qStore = query(
						collection(db, "stores", storeId, "repositions"),
						where("timestamp", ">=", tsLimit),
						limit(100)
					);
					const snapStore = await getDocs(qStore);
					snapStore.docs.forEach(doc => {
						allRepos.push({ id: doc.id, ...doc.data() } as RepositionHistory);
					});
				}
				const seen = new Set();
				const sortedUnique = allRepos
					.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
					.filter(item => {
						const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
						if (seen.has(uniqueKey)) return false;
						seen.add(uniqueKey);
						return true;
					});
				setAllHistory(sortedUnique);
				setShowAllHistory(true);
			} catch (err) {
				console.error("Erro no fallback de histórico completo:", err);
				alert("Não foi possível carregar o histórico. Verifique sua conexão.");
			}
		} finally {
			setLoadingAllHistory(false);
		}
	};

	const fetchItemHistory = async (itemId: keyof StockData) => {
		setLoadingLastRepo(true);
		setHistoryForItem([]);
		try {
			const fourWeeksAgo = new Date();
			fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
			const tsLimit = Timestamp.fromDate(fourWeeksAgo);

			// Esta query requer um índice de Collection Group (itemId ASC, timestamp DESC)
			// O link para criação aparece no console do navegador/terminal em caso de erro
			const q = query(
				collectionGroup(db, "repositions"),
				where("itemId", "==", itemId),
				where("timestamp", ">=", tsLimit),
				orderBy("timestamp", "desc"),
				limit(20)
			);
			const snap = await getDocs(q);
			const history = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepositionHistory));
			const seen = new Set();
			const uniqueHistory = history.filter(item => {
				const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
				if (seen.has(uniqueKey)) return false;
				seen.add(uniqueKey);
				return true;
			});
			setHistoryForItem(uniqueHistory);
		} catch (error) {
			console.error("Erro ao buscar histórico do item (tentando fallback):", error);
			// Fallback: buscar por loja e filtrar em memória para evitar erro de índice
			try {
				const fourWeeksAgo = new Date();
				fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
				const tsLimitMillis = fourWeeksAgo.getTime();

				const allRepos: RepositionHistory[] = [];
				for (const storeId of STORE_ORDER) {
					// Consultamos apenas pelo itemId (índice padrão)
					// Filtramos a data em memória para não exigir índice composto (itemId + timestamp)
					const qStore = query(
						collection(db, "stores", storeId, "repositions"),
						where("itemId", "==", itemId),
						limit(50)
					);
					const snapStore = await getDocs(qStore);
					snapStore.docs.forEach(doc => {
						const data = doc.data() as RepositionHistory;
						if (data.timestamp.toMillis() >= tsLimitMillis) {
							allRepos.push({ id: doc.id, ...data });
						}
					});
				}
				const seen = new Set();
				const sortedUnique = allRepos
					.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
					.filter(item => {
						const uniqueKey = `${item.timestamp.toMillis()}-${item.itemId}-${item.fromStore}-${item.toStore}`;
						if (seen.has(uniqueKey)) return false;
						seen.add(uniqueKey);
						return true;
					});
				setHistoryForItem(sortedUnique);
			} catch (err) {
				console.error("Erro no fallback de histórico por item:", err);
			}
		} finally {
			setLoadingLastRepo(false);
		}
	};

	useEffect(() => {
		if (expandedItem) fetchItemHistory(expandedItem);
	}, [expandedItem]);

	if (loading)
		return (
			<div className="flex flex-col items-center justify-center p-12">
				<RefreshCw className="animate-spin text-blue-600 dark:text-blue-400 mb-4" size={48} />
				<p className="text-slate-500 dark:text-slate-400 font-bold">Carregando estoque...</p>
			</div>
		);

	return (
		<>
			<style
				dangerouslySetInnerHTML={{
					__html: `
				@media print {
					@page {
						size: A4;
						margin: 10mm;
					}
					* {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						color-adjust: exact !important;
					}
					html, body, #__next, [data-reactroot] {
						height: auto !important;
						min-height: 0 !important;
						overflow: visible !important;
						margin: 0 !important;
						padding: 0 !important;
						width: 100% !important;
					}
					body {
						background: white !important;
						color: black !important;
						font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
						overflow: visible !important;
						padding: 0 !important;
					}
					main {
						padding: 0 !important;
						margin: 0 !important;
						width: 100% !important;
					}
					nav, header, footer, .print\\:hidden, button {
						display: none !important;
					}
					/* Summary Modal Printing */
					#modal-resumo-print {
						position: static !important;
						display: block !important;
						width: 100% !important;
						max-width: 100% !important;
						margin: 0 !important;
						padding-top: 0 !important;
						border: none !important;
						box-shadow: none !important;
						background: white !important;
						text-align: left !important;
					}
					#modal-resumo-print > div {
						max-width: 100% !important;
						width: 100% !important;
						max-height: none !important;
						height: auto !important;
						overflow: visible !important;
						position: static !important;
						border: none !important;
						box-shadow: none !important;
						background: white !important;
						padding: 0 !important;
						margin: 0 !important;
						text-align: left !important;
					}
					.text-2xl {
						font-size: 15pt !important;
						text-align: left !important;
						margin-bottom: 12px !important;
						color: black !important;
						font-weight: bold !important;
					}
					.text-sm, .text-slate-600 {
						font-size: 10.5pt !important;
						color: black !important;
					}
					.text-xs {
						font-size: 10pt !important;
						color: black !important;
					}
					.bg-slate-50, .dark\\:bg-slate-800, .bg-white, .dark\\:bg-slate-900 {
						background: transparent !important;
					}
					#modal-resumo-print, #modal-resumo-print * {
						text-align: left !important;
					}
					/* Hide other elements that might overlap */
					.fixed.inset-0:not(#modal-resumo-print) {
						display: none !important;
					}
				}
			`,
				}}
			/>
			{/* Sub-tabs Selector */}
			<div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-6 print:hidden max-w-full overflow-x-auto no-scrollbar">
				<button
					onClick={() => setActiveSubTab("reposicionar")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "reposicionar"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<FileText size={16} />
					REPOSICIONAMENTO
				</button>
				<button
					onClick={() => setActiveSubTab("proporcao")}
					className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
						activeSubTab === "proporcao"
							? "bg-slate-105 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700"
							: "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
					}`}>
					<PieChart size={16} />
					PROPORÇÃO DESEJÁVEL
				</button>
			</div>

			{activeSubTab === "reposicionar" ? (
				<div className="space-y-8 print:hidden">
			{/* Action Bar */}
			<div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors print:hidden">
				<div className="flex flex-col gap-1 shrink-0 text-center md:text-left">
					<h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
						Reposicionamento
					</h2>
					<p className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
						Movimente pacotes entre as lojas
					</p>
				</div>
				<div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
					<button
						onClick={resetProjectedStocks}
						className="cursor-pointer flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-5 py-2.5 rounded-xl font-black text-xs md:text-sm shadow-md shadow-emerald-100 dark:shadow-none transition-all uppercase tracking-widest">
						<RefreshCw size={14} />
						Iniciar reposicionamento
					</button>
					<button
						onClick={finalizeReposition}
						disabled={savingRepos}
						className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 md:px-5 py-2.5 rounded-xl font-black text-xs md:text-sm shadow-md shadow-blue-100 dark:shadow-none transition-all cursor-pointer uppercase tracking-widest">
						{savingRepos ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
						{savingRepos ? "Finalizando..." : "Finalizar Reposicionamento"}
					</button>
				</div>
			</div>

			{/* Filter Bar */}
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4 print:hidden">
				<div className="bg-white dark:bg-slate-900 p-2.5 md:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 flex-1 transition-colors">
					<div className="relative flex-1 group">
						<Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
						<input
							type="text"
							placeholder="Filtrar por sabor..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-12 pr-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
						/>
					</div>
				</div>
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<button
						onClick={() => setHideOpen(!hideOpen)}
						className="flex-1 sm:flex-none justify-center cursor-pointer flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 md:px-6 py-2.5 md:py-3.5 rounded-2xl font-black text-xs transition-all border border-slate-200 dark:border-slate-800 uppercase tracking-widest shadow-sm">
						{hideOpen ? <Eye size={14} /> : <EyeOff size={14} />}
						{hideOpen ? "Mostrar Abertos" : "Ocultar Abertos"}
					</button>
					<button
						onClick={fetchAllHistory}
						disabled={loadingAllHistory}
						className="flex-1 sm:flex-none justify-center cursor-pointer flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 md:px-6 py-2.5 md:py-3.5 rounded-2xl font-black text-xs transition-all border border-slate-200 dark:border-slate-800 uppercase tracking-widest disabled:opacity-50 shadow-sm">
						{loadingAllHistory ? <RefreshCw className="animate-spin" size={14} /> : <History size={14} />}
						Histórico
					</button>
				</div>
			</div>

			{showPostFinalizationBanner && (
				<div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-500/50 rounded-2xl p-4 md:p-6 shadow-sm space-y-4 print:hidden animate-in fade-in duration-200 flex flex-col items-center text-center">
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<AlertCircle className="text-red-600 dark:text-red-400 shrink-0" size={28} />
						<p className="text-sm md:text-lg font-black text-red-800 dark:text-red-200 text-center">
							Números abaixo referentes ao último reposicionamento {lastFinalizedDate ? `(${lastFinalizedDate})` : `(${formatDate(new Date())})`} podem estar incorretos devido a movimentações de estoque posteriores.
						</p>
					</div>
					<div className="flex justify-center items-center w-full pt-1">
						<button
							onClick={() => setShowEditConfirmModal(true)}
							className="cursor-pointer bg-red-600 hover:bg-red-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black transition-all uppercase tracking-wider shadow-md shadow-red-200 dark:shadow-none">
							Continuar ou editar último reposicionamento
						</button>
					</div>
				</div>
			)}

			<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors print:hidden">
				<div className="overflow-x-auto overflow-y-visible">
					<table className="w-full table-fixed border-separate border-spacing-0 min-w-[34rem] md:min-w-[50rem]">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800">
								<th className="w-[26%] md:w-[24%] min-w-[7.5rem] md:min-w-[12rem] p-3 md:p-5 text-xs md:text-[1rem] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 border-b border-slate-200 dark:border-slate-700 text-center">
									Item
								</th>
								{STORE_ORDER.map((id) => (
									<th
										key={id}
										className="w-[18.5%] md:w-[19%] min-w-[6rem] md:min-w-[9.5rem] p-3 md:p-5 text-center text-xs md:text-[1rem] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
										{STORE_NAMES[id]}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{sortedItems.map(([key, label], index) => {
								const itemKey = key as keyof StockData;
								const isExpanded = expandedItem === itemKey;
								const showRepeatedHeader = index > 0 && index % 8 === 0;

								// Cálculo da proporção para o item
								const totalProjectedForItem = STORE_ORDER.reduce(
									(acc, sId) => acc + (projectedStocks[sId][itemKey] || 0),
									0
								);
								const sumDefinedProps = STORE_ORDER.reduce(
									(acc, sId) => acc + (storeProportions[sId]?.[itemKey] || 0),
									0
								);
								const baseDesired = desiredTotalData[itemKey] || 0;
								const baseForCalc = sumDefinedProps > 0 ? sumDefinedProps : baseDesired;

								return (
									<Fragment key={itemKey}>
										{showRepeatedHeader && (
											<tr className="bg-slate-100 dark:bg-slate-800/80">
												<th className="p-2 md:p-3 text-center text-xs md:text-[1rem] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-100 dark:bg-slate-800/80 z-20 border-y border-slate-200 dark:border-slate-700">
													Item
												</th>
												{STORE_ORDER.map((id) => (
													<th
														key={`header-${id}-${index}`}
														className="p-2 md:p-3 text-center text-xs md:text-[1rem] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 border-y">
														{STORE_NAMES[id]}
													</th>
												))}
											</tr>
										)}
										<tr
											className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/20" : ""}`}>
											<td className="p-3 md:p-5 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/50 z-10 border-r border-slate-50 dark:border-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors">
												<button
													onClick={() => setExpandedItem(isExpanded ? null : itemKey)}
													className="flex items-center gap-1.5 md:gap-2 text-xs md:text-[1.2rem] font-black text-slate-600 dark:text-slate-400 uppercase hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-left">
													{isExpanded ? <ChevronUp size={14} className="md:w-[16px] md:h-[16px]" /> : <ChevronDown size={14} className="md:w-[16px] md:h-[16px]" />}
													{label}
												</button>
											</td>

											{STORE_ORDER.map((id) => {
												const v = projectedStocks[id][itemKey] || 0;
												const initial = allData.find((d) => d.id === id)?.stock[itemKey] || 0;
												const openVal = allData.find((d) => d.id === id)?.isUnits?.[itemKey];
												const initialOpenCount = typeof openVal === "boolean" ? (openVal ? 1 : 0) : openVal || 0;
												const receiving = v > initial;
												const sending = v < initial;

												const isSourceCell = activeSelection?.item === itemKey && activeSelection?.fromStore === id;
												const isTargetCell = activeSelection?.item === itemKey && activeSelection?.fromStore !== id;

												// Cálculo do alvo proporcional para esta loja
												const storeProp = storeProportions[id]?.[itemKey] || 0;
												const hasProportionDefined = baseForCalc > 0 && storeProp > 0;
												const targetQty = hasProportionDefined && totalProjectedForItem > 0
													? Math.round((storeProp / baseForCalc) * totalProjectedForItem)
													: null;
												const isTargetMet = targetQty !== null && v === targetQty;

												let cellStyle = "relative p-3 md:p-5 text-center border-l border-slate-50 dark:border-slate-800 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all select-none ";
												if (isSourceCell) {
													cellStyle += "bg-red-50 dark:bg-red-900/30 ring-2 ring-red-500 shadow-md";
												} else if (isTargetCell) {
													cellStyle += "bg-emerald-50/70 dark:bg-emerald-900/30 ring-2 ring-dashed ring-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50";
												} else {
													cellStyle += "hover:bg-slate-100/60 dark:hover:bg-slate-800/60";
												}

												return (
													<td
														key={id}
														onClick={() => handleCellClick(itemKey, id)}
														className={cellStyle}>
														{/* Botão X Vermelho para des-selecionar no canto superior direito da loja de origem */}
														{isSourceCell && (
															<button
																onClick={(e) => {
																	e.stopPropagation();
																	setActiveSelection(null);
																}}
																className="absolute top-1 right-1 md:top-2 md:right-2 p-0.5 md:p-1 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md transition-all cursor-pointer z-10"
																title="Cancelar seleção">
																<X size={12} strokeWidth={3} className="md:w-[13px] md:h-[13px]" />
															</button>
														)}

														<div className="flex flex-col items-center justify-center gap-0.5 md:gap-1 min-h-[2.5rem] md:min-h-[3rem]">
															{/* Indicativo de Proporção Desejável (Tag vazia com espectro de vermelho a verde) - Primeiro item no topo */}
															{targetQty !== null && !isSourceCell && !isTargetCell && (() => {
																const indicator = getProportionIndicatorColor(v, targetQty);
																return (
																	<div
																		className="w-7 h-1.5 md:w-9 md:h-2 rounded-full transition-all duration-300 transform mb-0.5 hover:scale-125 cursor-default"
																		style={indicator.style}
																		title={`Proporção ideal: ${targetQty} un. (Atual: ${v} un. | Diferença: ${indicator.diffText})`}
																	/>
																);
															})()}

															{/* Quantidade atual em estoque na célula */}
															<div className="flex items-center gap-1">
																{(v > 0 || initialOpenCount === 0 || hideOpen) && (
																	<span
																		className={`text-base md:text-[1.7rem] font-black ${(initialOpenCount > 0 && !hideOpen) ? "text-slate-900 dark:text-slate-200" : (v === 0 && (initialOpenCount === 0 || hideOpen)) ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-200"}`}>
																		{v}
																	</span>
																)}
																{!hideOpen && initialOpenCount > 0 && (
																	<span className="text-xs md:text-[1.7rem] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
																		{v > 0 ? `+ ${initialOpenCount} ab` : `${initialOpenCount} ab`}
																	</span>
																)}
															</div>

															{/* Badges de Estado */}
															{isSourceCell ? (
																<span className="text-[10px] md:text-xs font-bold px-1.5 md:px-3 py-0.5 md:py-1 rounded-full bg-red-600 text-white shadow-md uppercase tracking-wider animate-in zoom-in-90 duration-150 inline-flex flex-wrap justify-center items-center gap-1">
																	<span className="text-xs md:text-sm font-black text-amber-300 bg-red-800/80 px-1.5 md:px-2 py-0.5 rounded-lg border border-amber-300/40 shadow-inner">
																		{activeSelection.qty}
																	</span>
																	<span>saindo do</span>
																	<span className="text-xs md:text-sm font-black text-white bg-red-800/80 px-1.5 md:px-2 py-0.5 rounded-lg border border-white/40 shadow-inner">
																		{STORE_NAMES[id]}
																	</span>
																</span>
															) : isTargetCell ? (
																<span className="text-[10px] md:text-xs font-bold px-1.5 md:px-3 py-0.5 md:py-1 rounded-full bg-emerald-600 text-white shadow-md uppercase tracking-wider animate-in zoom-in-90 duration-150 inline-flex flex-wrap justify-center items-center gap-1">
																	<span>Enviar</span>
																	<span className="text-xs md:text-sm font-black text-amber-300 bg-emerald-800/80 px-1.5 md:px-2 py-0.5 rounded-lg border border-amber-300/40 shadow-inner">
																		{activeSelection.qty}
																	</span>
																	<span>para o</span>
																	<span className="text-xs md:text-sm font-black text-white bg-emerald-800/80 px-1.5 md:px-2 py-0.5 rounded-lg border border-white/40 shadow-inner">
																		{STORE_NAMES[id]}
																	</span>
																</span>
															) : (
																(receiving || sending) && (
																	<span className={`text-xs md:text-[1.35rem] font-black ${receiving ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
																		{receiving ? `+${v - initial}` : `-${initial - v}`}
																	</span>
																)
															)}
														</div>
													</td>
												);
											})}
										</tr>
										{isExpanded && (
											<tr className="bg-blue-50/20 dark:bg-blue-900/10 transition-colors">
												<td
													colSpan={STORE_ORDER.length + 1}
													className="p-4 border-b border-slate-200 dark:border-slate-800">
													<div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-blue-100 dark:border-blue-900 shadow-sm transition-colors">
														<h4 className="text-[1rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
															Histórico de Reposicionamento (últimas 5)
														</h4>
														{loadingLastRepo ? (
															<div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
																<RefreshCw className="animate-spin" size={16} />
																<span className="text-xs font-bold">Buscando histórico...</span>
															</div>
														) : historyForItem.length > 0 ? (
															<div className="space-y-4">
																{historyForItem.map((item, hIdx) => (
																	<div key={item.id || hIdx} className="flex flex-wrap items-center gap-8 pb-4 border-b border-slate-50 dark:border-slate-700 last:border-0 last:pb-0">
																		<div className="flex flex-col gap-1 min-w-[6.25rem]">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Data
																			</span>
																			<span className="text-lg font-black text-slate-700 dark:text-slate-300">
																				{formatDate(item.timestamp.toDate())}
																			</span>
																		</div>
																		<div className="flex flex-col gap-1 min-w-[9.375rem]">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Movimentação
																			</span>
																			<span className="text-lg font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
																				{STORE_NAMES[item.fromStore]}
																				<ArrowRight size={12} className="text-blue-400 dark:text-blue-500" />
																				{STORE_NAMES[item.toStore]}
																			</span>
																		</div>
																		<div className="flex flex-col gap-1">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Quantidade
																			</span>
																			<span className="text-lg font-black text-green-600 dark:text-green-400">
																				{item.difference} itens
																			</span>
																		</div>
																		<div className="flex flex-col gap-1">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Origem
																			</span>
																			<span className="text-lg font-black text-slate-500 dark:text-slate-400">
																				De {item.beforeFrom} → {item.afterFrom}
																			</span>
																		</div>
																		<div className="flex flex-col gap-1">
																			<span className="text-[0.9rem] font-bold text-slate-400 dark:text-slate-500 uppercase">
																				Destino
																			</span>
																			<span className="text-lg font-black text-slate-500 dark:text-slate-400">
																				De {item.beforeTo} → {item.afterTo}
																			</span>
																		</div>
																	</div>
																))}
															</div>
														) : (
															<p className="text-lg font-bold text-slate-400 dark:text-slate-500">
																Nenhum reposicionamento registrado para este item.
															</p>
														)}
													</div>
												</td>
											</tr>
										)}
									</Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			</div>
			) : (
				// Aba Proporção Desejável
				<div className="space-y-6 print:hidden">
					{(() => {
						const hasProportionChanges = STORE_ORDER.some((sId) => {
							return Object.keys(STOCK_LABELS).some((k) => {
								const key = k as keyof StockData;
								return (localStoreProportions[sId]?.[key] ?? 0) !== (storeProportions[sId]?.[key] ?? 0);
							});
						});

						return (
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 md:gap-4">
								<div className="relative flex-1 max-w-full sm:max-w-md group">
									<Search
										size={18}
										className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
									/>
									<input
										type="text"
										placeholder="Filtrar por sabor..."
										value={proportionSearchTerm}
										onChange={(e) => setProportionSearchTerm(e.target.value)}
										className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 md:py-3 pl-12 pr-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
									/>
								</div>

								<div className="relative" title={!hasProportionChanges && !savingProportions ? "Faça alterações para salvar" : ""}>
									<button
										onClick={saveProportions}
										disabled={!hasProportionChanges || savingProportions}
										className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-2xl font-black transition-all text-xs md:text-sm ${
											hasProportionChanges && !savingProportions
												? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/40 ring-4 ring-emerald-400/40 animate-pulse cursor-pointer scale-105"
												: "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70"
										}`}>
										{savingProportions ? (
											<RefreshCw className="animate-spin" size={18} />
										) : (
											<Save size={18} />
										)}
										SALVAR PROPORÇÕES
									</button>
								</div>
							</div>
						);
					})()}

					<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
						<div className="overflow-x-auto">
							<table className="w-full border-collapse">
								<thead>
									<tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
										<th className="p-3 md:p-6 text-left text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[7.5rem] md:min-w-[11.25rem]">
											SABOR
										</th>
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[6rem] md:min-w-[8rem]">
											META GLOBAL (TOTAL)
										</th>
										{STORE_ORDER.map((sId) => (
											<th
												key={`prop-th-${sId}`}
												className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[6rem] md:min-w-[8.5rem]">
												{STORE_NAMES[sId]}
											</th>
										))}
										<th className="p-3 md:p-6 text-center text-xs md:text-[0.9375rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest min-w-[6rem] md:min-w-[8rem]">
											PACOTES RESTANTES
										</th>
									</tr>
								</thead>
								<tbody>
									{sortStockEntries(Object.entries(STOCK_LABELS))
										.filter(([_, label]) => label.toLowerCase().includes(proportionSearchTerm.toLowerCase()))
										.map(([key, label]) => {
											const itemKey = key as keyof StockData;
											const metaGlobal = desiredTotalData[itemKey] || 0;
											
											const sumDefined = STORE_ORDER.reduce(
												(sum, sId) => sum + (localStoreProportions[sId]?.[itemKey] || 0),
												0
											);

											const remaining = Math.max(0, metaGlobal - sumDefined);

											return (
												<tr
													key={`prop-row-${key}`}
													className="border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors group">
													<td className="p-3 md:p-6 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/20 transition-colors uppercase">
														{label}
													</td>
													<td className="p-3 md:p-6 text-center border-l border-r border-slate-100 dark:border-slate-800">
														<span className="text-base md:text-xl font-black text-slate-800 dark:text-slate-200">
															{metaGlobal > 0 ? metaGlobal : "-"}
														</span>
													</td>
													{STORE_ORDER.map((sId) => {
														const val = localStoreProportions[sId]?.[itemKey] ?? "";
														const otherStoresSum = STORE_ORDER
															.filter((id) => id !== sId)
															.reduce((acc, id) => acc + (localStoreProportions[id]?.[itemKey] || 0), 0);
														const maxForThisInput = metaGlobal > 0 ? Math.max(0, metaGlobal - otherStoresSum) : undefined;

														return (
															<td
																key={`prop-td-${sId}-${key}`}
																className="p-3 md:p-6 text-center border-r border-slate-100 dark:border-slate-800">
																<div className="flex justify-center">
																	<input
																		type="number"
																		min="0"
																		max={maxForThisInput}
																		value={val}
																		placeholder="0"
																		onChange={(e) => handleLocalProportionChange(sId, itemKey, e.target.value)}
																		onFocus={(e) => e.target.select()}
																		onClick={(e) => e.currentTarget.select()}
																		className="w-16 md:w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 md:py-2 px-2 md:px-3 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
																	/>
																</div>
															</td>
														);
													})}
													<td className="p-3 md:p-6 text-center">
														<div className="flex justify-center items-center gap-1">
															<span
																className={`text-base md:text-xl font-black ${
																	remaining > 0
																		? "text-amber-600 dark:text-amber-400"
																		: "text-emerald-600 dark:text-emerald-400"
																}`}>
																{remaining}
															</span>
														</div>
													</td>
												</tr>
											);
										})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			{showSummary && (
				<div id="modal-resumo-print" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">

					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-auto max-w-fit shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
						<div className="p-3.5 md:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center print:hidden whitespace-nowrap">
							<div>
								<h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight text-center">
									Resumo - {new Date().toLocaleDateString("pt-BR")}
								</h2>
							</div>
						</div>

						<div className="p-3.5 md:p-4 overflow-y-auto custom-scrollbar flex-1 print:overflow-visible print:p-0">
							{calculateOptimizedSummary().length > 0 ? (
								<div className="space-y-4 print:space-y-12 print:pt-4 w-full flex flex-col items-start text-left">
									{(() => {
										const grouped = new Map<
											string,
											{ from: StoreId; to: StoreId; items: { label: string; qty: number }[] }
										>();

										const movements = calculateOptimizedSummary();
										movements.forEach((move) => {
											const key = `${move.from}-${move.to}`;
											if (!grouped.has(key)) {
												grouped.set(key, { from: move.from, to: move.to, items: [] });
											}
											grouped.get(key)!.items.push({
												label: STOCK_LABELS[move.item],
												qty: move.qty,
											});
										});

										const storeOrder: StoreId[] = ["lago", "noroeste", "terraco", "conjunto"];

										const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
											const fromDiff = storeOrder.indexOf(a.from) - storeOrder.indexOf(b.from);
											if (fromDiff !== 0) return fromDiff;
											return storeOrder.indexOf(a.to) - storeOrder.indexOf(b.to);
										});

										return (
											<div className="space-y-4 print:space-y-12 w-full flex flex-col items-center print:items-start text-center print:text-left">
												<div className="inline-flex flex-col items-stretch max-w-full space-y-3 print:hidden">
													{sortedGroups.map((group, groupIdx) => {
														return (
															<div
																key={`screen-${groupIdx}`}
																className="p-4 bg-slate-50/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
																<div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700 text-center">
																	<span className="text-xs md:text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight flex items-center justify-center gap-1.5 text-center whitespace-nowrap">
																		{STORE_NAMES[group.from]}
																		<ArrowRight size={14} className="text-blue-400 dark:text-blue-500" />
																		{STORE_NAMES[group.to]}:
																	</span>
																</div>
																<ul className="space-y-1.5 mt-2 flex flex-col items-center">
																	{group.items.map((item, i) => (
																		<li key={i} className="text-slate-700 dark:text-slate-200 font-bold text-xs md:text-sm text-center whitespace-nowrap">
																			<strong className="font-black text-slate-900 dark:text-white mr-1">{item.qty}</strong>
																			{item.label}
																		</li>
																	))}
																</ul>
															</div>
														);
													})}
												</div>

												{/* Visão exclusiva de Impressão: Duplicado (2 vias para corte) alinhadas à esquerda com largura uniforme */}
												<div className="hidden print:flex flex-col space-y-4 print:space-y-12 w-full">
													{sortedGroups.map((group, groupIdx) => (
														<div key={`print-${groupIdx}`} className="flex flex-row items-stretch gap-3 print:gap-x-6 w-full text-left mb-3 print:mb-12">
															{[0, 1].map((copyIndex) => (
																<div
																	key={`${groupIdx}-${copyIndex}`}
																	className="bg-white border border-slate-400 rounded-xl p-3 break-inside-avoid shadow-none text-left w-[18.5rem]">
																	<div className="flex items-center justify-start gap-2 mb-2 pb-1.5 border-b border-slate-300 text-left">
																		<span className="font-black text-black text-[11.5pt] flex items-center gap-1.5 text-left whitespace-nowrap uppercase">
																			{STORE_NAMES[group.from]}
																			<ArrowRight size={14} className="text-black" />
																			{STORE_NAMES[group.to]}:
																		</span>
																	</div>
																	<ul className="space-y-1.5 mt-2 text-left">
																		{group.items.map((item, i) => (
																			<li key={i} className="flex items-center justify-start gap-2 text-black font-bold text-[11pt] text-left whitespace-nowrap">
																				<span className="w-3.5 h-3.5 rounded border border-black flex-shrink-0 inline-block" />
																				<span className="text-left">
																					<strong className="font-black text-black mr-1">{item.qty}</strong>
																					{item.label}
																				</span>
																			</li>
																		))}
																	</ul>
																</div>
															))}
														</div>
													))}
												</div>
											</div>
										);
									})()}
								</div>
							) : (
								<div className="text-center py-10">
									<p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
										Nenhuma movimentação pendente.
									</p>
								</div>
							)}
						</div>

						<div className="p-3.5 md:p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5 transition-colors print:hidden">
							<div className="flex flex-col gap-2 w-full">
								<button
									onClick={handleWhatsApp}
									disabled={calculateOptimizedSummary().length === 0}
									className="w-full flex items-center justify-center gap-2 md:gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
									Enviar no WhatsApp
								</button>
								<button
									onClick={handlePrint}
									disabled={calculateOptimizedSummary().length === 0}
									className="w-full flex items-center justify-center gap-2 md:gap-3 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest shadow-lg shadow-blue-100 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer">
									Imprimir
								</button>
							</div>
							<button
								onClick={handleCloseSummary}
								className="w-full px-4 md:px-6 py-3 md:py-4 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}
			{stockWarningModal && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-red-200 dark:border-red-900/30">
						<div className="p-8 text-center space-y-4">
							<div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
								<AlertCircle className="text-red-600 dark:text-red-400" size={32} />
							</div>
							<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Quantidade Maior que o Estoque</h3>
							<p className="text-slate-600 dark:text-slate-300 font-bold text-sm leading-relaxed">
								A movimentação pretendida (<span className="text-red-600 dark:text-red-400 font-black">{stockWarningModal.intendedQty}</span> un.) é maior que a quantidade disponível no estoque da unidade <span className="font-black text-slate-800 dark:text-slate-100">{STORE_NAMES[stockWarningModal.fromStore]}</span> (<span className="font-black">{stockWarningModal.availableStock}</span> un. de <span className="font-black">{STOCK_LABELS[stockWarningModal.item]}</span>).
							</p>
							<p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Deseja prosseguir mesmo assim?</p>
						</div>
						<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
							<button 
								onClick={handleCancelStockWarning} 
								className="flex-1 px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer">
								Cancelar
							</button>
							<button 
								onClick={handleConfirmStockWarning} 
								className="flex-1 px-6 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100 dark:shadow-none transition-all cursor-pointer">
								Continuar
							</button>
						</div>
					</div>
				</div>
			)}
			{showEditConfirmModal && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-amber-200 dark:border-amber-900/30">
						<div className="p-8 text-center space-y-5">
							<div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
								<AlertCircle className="text-amber-600 dark:text-amber-400" size={40} />
							</div>
							<h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Editar Úlimo Reposicionamento</h3>
							<p className="text-base md:text-xl text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
								Caso o último reposicionamento tenha sido finalizado há um tempo, as atualizações de estoque terão feito os números estarem incorretos. Nesse caso, inicie um novo reposicionamento.
							</p>
							<p className="text-sm md:text-lg font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
								Prossiga apenas se quer editar um reposicionamento recente (que acabou de finalizar).
							</p>
						</div>
						<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-4">
							<button 
								onClick={() => setShowEditConfirmModal(false)} 
								className="flex-1 px-6 py-4 rounded-2xl font-black text-sm md:text-lg uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 dark:shadow-none transition-all cursor-pointer">
								Voltar
							</button>
							<button 
								onClick={() => {
									setShowEditConfirmModal(false);
									setShowPostFinalizationBanner(false);
								}} 
								className="flex-1 px-6 py-4 rounded-2xl font-black text-sm md:text-lg uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 dark:shadow-none transition-all cursor-pointer">
								Prosseguir
							</button>
						</div>
					</div>
				</div>
			)}
			{showResetConfirm && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-blue-200 dark:border-blue-900/30">
						<div className="p-8 text-center space-y-5">
							<div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
								{startingRepo ? (
									<RefreshCw className="text-blue-600 dark:text-blue-400 animate-spin" size={40} />
								) : (
									<RefreshCw className="text-blue-600 dark:text-blue-400" size={40} />
								)}
							</div>
							<h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">Iniciar Reposicionamento</h3>
							<p className="text-base md:text-xl text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
								O resumo anterior será zerado e o estoque será atualizado para o estoque atual informado pelas lojas.
							</p>
						</div>
						<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-4">
							<button 
								onClick={() => setShowResetConfirm(false)} 
								disabled={startingRepo}
								className="flex-1 px-6 py-4 rounded-2xl font-black text-sm md:text-lg uppercase tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-lg disabled:opacity-50 cursor-pointer text-center">
								Cancelar
							</button>
							<button 
								onClick={confirmResetProjectedStocks} 
								disabled={startingRepo}
								className="flex-1 px-6 py-4 rounded-2xl font-black text-sm md:text-lg uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg disabled:opacity-50 cursor-pointer text-center">
								{startingRepo ? "Iniciando..." : "Prosseguir"}
							</button>
						</div>
					</div>
				</div>
			)}
			{showAllHistory && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
						<div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<History className="text-blue-600 dark:text-blue-400" size={24} />
								<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight uppercase">
									Histórico Completo de Reposicionamento
								</h2>
							</div>
							<button onClick={() => setShowAllHistory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
								<ChevronUp size={24} className="rotate-180" />
							</button>
						</div>

						<div className="p-8 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
							{allHistory.length > 0 ? (
								<div className="space-y-4">
									{allHistory.map((item, hIdx) => (
										<div key={item.id || hIdx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-6 transition-all hover:shadow-md">
											<div className="flex flex-col gap-1 min-w-[7.5rem]">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Data</span>
												<span className="text-sm font-black text-slate-700 dark:text-slate-300">{formatDate(item.timestamp.toDate())}</span>
											</div>
											<div className="flex flex-col gap-1 min-w-[11.25rem]">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Item</span>
												<span className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase">{STOCK_LABELS[item.itemId]}</span>
											</div>
											<div className="flex flex-col gap-1 min-w-[11.25rem]">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Movimentação</span>
												<div className="flex items-center gap-2">
													<span className="text-sm font-black text-slate-700 dark:text-slate-200">{STORE_NAMES[item.fromStore]}</span>
													<ArrowRight size={14} className="text-slate-400" />
													<span className="text-sm font-black text-slate-700 dark:text-slate-200">{STORE_NAMES[item.toStore]}</span>
												</div>
											</div>
											<div className="flex flex-col gap-1 items-center">
												<span className="text-[0.625rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Qtd</span>
												<span className="text-lg font-black text-green-600 dark:text-green-400">{item.difference}</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="flex flex-col items-center justify-center p-12 text-slate-400">
									<History size={48} className="mb-4 opacity-20" />
									<p className="font-black uppercase tracking-widest">Nenhum histórico encontrado</p>
								</div>
							)}
						</div>

						<div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center">
							<button
								onClick={() => setShowAllHistory(false)}
								className="px-12 py-4 rounded-2xl font-black text-[0.75rem] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer">
								Fechar Histórico
							</button>
						</div>
					</div>
				</div>
			)}

		</>
	);
}
