"use client";

import { useEffect, useState, Fragment, useRef } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	getDocs,
	getDoc,
	setDoc,
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
	RepositionMovementItem,
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
	Check,
} from "lucide-react";

interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, number>>;
}

const STORE_ORDER: StoreId[] = ["lago", "terraco", "conjunto", "noroeste"];

export default function EstoqueReposicionarPage() {
	const [loading, setLoading] = useState(true);
	const [allData, setAllData] = useState<FullStoreData[]>([]);
	const isInitialized = useRef(false);

	// Metas Desejáveis obtidas da rota /gerencia/estoque/pedidos (desiredStocks)
	const [storeProportions, setStoreProportions] = useState<Record<StoreId, Partial<StockData>>>({
		lago: {},
		noroeste: {},
		terraco: {},
		conjunto: {},
	});

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
	const [showFinalizedSuccessModal, setShowFinalizedSuccessModal] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(true);

	const [searchTerm, setSearchTerm] = useState("");
	const [hideOpen, setHideOpen] = useState(true);

	const [startingRepo, setStartingRepo] = useState(false);
	const [isFinalizedSession, setIsFinalizedSession] = useState(false);
	const [lastFinalizedDate, setLastFinalizedDate] = useState<string | null>(null);
	const isSavedThisRun = useRef(false);

	const handleCloseSummary = () => {
		setShowSummary(false);
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

			setStoreProportions(propsByStore);
		});

		return () => unsubscribeDesired();
	}, []);

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

	const TARGET_STORES_ORDER: StoreId[] = ["noroeste", "conjunto", "terraco"];

	const calculateOptimizedSummary = () => {
		const movements: { item: keyof StockData; from: StoreId; to: StoreId; qty: number }[] = [];
		const allItems = sortStockEntries(Object.entries(STOCK_LABELS));

		allItems.forEach(([itemKey, _]) => {
			const lagoInitial = allData.find((d) => d.id === "lago")?.stock[itemKey] || 0;

			// Calcula a necessidade física de cada loja de destino (apenas se projetado > inicial)
			const storeNeeds = TARGET_STORES_ORDER.map((storeId) => {
				const initial = allData.find((d) => d.id === storeId)?.stock[itemKey] || 0;
				const projected = projectedStocks[storeId]?.[itemKey] || 0;
				const needed = Math.max(0, projected - initial);
				return { storeId, needed };
			});

			const totalNeeded = storeNeeds.reduce((sum, s) => sum + s.needed, 0);
			if (totalNeeded === 0 || lagoInitial <= 0) {
				return;
			}

			// Se Lago tem estoque suficiente para suprir todas as necessidades das demais lojas:
			if (lagoInitial >= totalNeeded) {
				storeNeeds.forEach(({ storeId, needed }) => {
					if (needed > 0) {
						movements.push({
							item: itemKey,
							from: "lago",
							to: storeId,
							qty: needed,
						});
					}
				});
			} else {
				// Caso o Lago tenha menos estoque do que a soma das necessidades:
				// Distribui o estoque disponível do Lago proporcionalmente
				const allocations: { storeId: StoreId; qty: number; remainder: number }[] = storeNeeds.map(
					({ storeId, needed }) => {
						if (needed === 0) return { storeId, qty: 0, remainder: 0 };
						const raw = (needed / totalNeeded) * lagoInitial;
						const floorQty = Math.floor(raw);
						return {
							storeId,
							qty: floorQty,
							remainder: raw - floorQty,
						};
					}
				);

				let allocatedSum = allocations.reduce((sum, a) => sum + a.qty, 0);
				let unassigned = lagoInitial - allocatedSum;

				// Distribui eventuais unidades restantes para as lojas com maiores frações
				allocations
					.slice()
					.sort((a, b) => b.remainder - a.remainder)
					.forEach((alloc) => {
						if (unassigned > 0 && alloc.remainder > 0) {
							const target = allocations.find((a) => a.storeId === alloc.storeId);
							if (target) {
								target.qty += 1;
								unassigned -= 1;
							}
						}
					});

				TARGET_STORES_ORDER.forEach((sId) => {
					const alloc = allocations.find((a) => a.storeId === sId);
					if (alloc && alloc.qty > 0) {
						movements.push({
							item: itemKey,
							from: "lago",
							to: sId,
							qty: alloc.qty,
						});
					}
				});
			}
		});

		// Ordena os movimentos finais garantindo rigorosamente a sequência: Lago -> Noroeste, Lago -> Conjunto, Lago -> Terraço
		return movements.sort((a, b) => {
			return TARGET_STORES_ORDER.indexOf(a.to) - TARGET_STORES_ORDER.indexOf(b.to);
		});
	};

	const calculateAdjustedPhysicalStocks = () => {
		const movements = calculateOptimizedSummary();
		const adjusted: Record<StoreId, Partial<StockData>> = {
			lago: {},
			noroeste: {},
			conjunto: {},
			terraco: {},
		};

		// Inicia com o estoque real atual de cada loja
		allData.forEach((store) => {
			adjusted[store.id] = { ...store.stock };
		});

		// Aplica apenas as transferências que fisicamente saem do Lago para as demais lojas
		movements.forEach((move) => {
			adjusted[move.from][move.item] = (adjusted[move.from][move.item] || 0) - move.qty;
			adjusted[move.to][move.item] = (adjusted[move.to][move.item] || 0) + move.qty;
		});

		return adjusted;
	};

	const handleRequestFinalize = () => {
		const movements = calculateOptimizedSummary();
		if (movements.length === 0) {
			alert("Não há movimentações para finalizar.");
			return;
		}
		setShowSummary(true);
	};

	const executeFinalizeReposition = async () => {
		const optimizedMovements = calculateOptimizedSummary();
		if (optimizedMovements.length === 0) {
			alert("Não há movimentações para finalizar.");
			return;
		}

		setSavingRepos(true);
		try {
			const adjustedStocks = calculateAdjustedPhysicalStocks();

			await runTransaction(db, async (transaction) => {
				for (const move of optimizedMovements) {
					const newId = doc(collection(db, "unused")).id;
					const historyEntry: RepositionHistory = {
						timestamp: Timestamp.now(),
						itemId: move.item,
						fromStore: move.from,
						toStore: move.to,
						beforeFrom: allData.find((d) => d.id === move.from)?.stock[move.item] || 0,
						afterFrom: adjustedStocks[move.from][move.item] || 0,
						beforeTo: allData.find((d) => d.id === move.to)?.stock[move.item] || 0,
						afterTo: adjustedStocks[move.to][move.item] || 0,
						difference: move.qty,
					};
					transaction.set(doc(db, "stores", move.from, "repositions", newId), historyEntry);
					transaction.set(doc(db, "stores", move.to, "repositions", newId), historyEntry);
				}
			});

			// Salva a versão final do estoque de todas as lojas ajustada à realidade física
			const currentSessionId = localStorage.getItem("repos_session_id") || doc(collection(db, "unused")).id;
			const movementsList: RepositionMovementItem[] = optimizedMovements.map((move) => ({
				id: `${move.from}_${move.to}_${move.item}`,
				itemId: move.item,
				itemName: STOCK_LABELS[move.item],
				from: move.from,
				to: move.to,
				qty: move.qty,
				outConfirmed: false,
				outConfirmedAt: null,
				inConfirmed: false,
				inConfirmedAt: null,
				outDiscarded: false,
				inDiscarded: false,
			}));
			const formattedNow = formatDate(new Date());

			const endState = {
				sessionId: currentSessionId,
				type: "fim",
				timestamp: Timestamp.now(),
				formattedDate: formattedNow,
				stores: {
					lago: {
						stock: adjustedStocks.lago,
						isUnits: allData.find((d) => d.id === "lago")?.isUnits || {},
					},
					conjunto: {
						stock: adjustedStocks.conjunto,
						isUnits: allData.find((d) => d.id === "conjunto")?.isUnits || {},
					},
					terraco: {
						stock: adjustedStocks.terraco,
						isUnits: allData.find((d) => d.id === "terraco")?.isUnits || {},
					},
					noroeste: {
						stock: adjustedStocks.noroeste,
						isUnits: allData.find((d) => d.id === "noroeste")?.isUnits || {},
					},
				},
				movements: movementsList,
			};
			await addDoc(collection(db, "repositionSnapshots"), endState);
			await setDoc(doc(db, "repositionState", "latest"), endState);
			localStorage.removeItem("repos_session_id");

			// Atualiza o estado da tela para o estoque físico ajustado
			setProjectedStocks(adjustedStocks);
			localStorage.setItem("repos_projected_stocks", JSON.stringify(adjustedStocks));

			setLastFinalizedDate(formattedNow);
			localStorage.setItem("repos_last_finalized_date", formattedNow);
			isSavedThisRun.current = true;
			setIsFinalizedSession(true);
			setShowSummary(false);
			setShowFinalizedSuccessModal(true);
		} catch (error) {
			console.error("Erro ao finalizar reposicionamento:", error);
			alert("Erro ao salvar reposicionamento no banco de dados. Verifique o console.");
		} finally {
			setSavingRepos(false);
		}
	};

	const handleAccessLastReposition = async () => {
		setStartingRepo(true);
		try {
			let lastData: any = null;

			// 1. Tentar pegar o documento direto 'latest'
			try {
				const latestDocSnap = await getDoc(doc(db, "repositionState", "latest"));
				if (latestDocSnap.exists()) {
					lastData = latestDocSnap.data();
				}
			} catch (e) {
				console.error("Erro ao ler doc repositionState/latest:", e);
			}

			// 2. Fallback: buscar na coleção repositionSnapshots pelo último com type 'fim'
			if (!lastData) {
				try {
					const q = query(
						collection(db, "repositionSnapshots"),
						where("type", "==", "fim"),
						orderBy("timestamp", "desc"),
						limit(1)
					);
					const querySnap = await getDocs(q);
					if (!querySnap.empty) {
						lastData = querySnap.docs[0].data();
					}
				} catch (e) {
					console.error("Erro ao buscar último snapshot de reposicionamento:", e);
				}
			}

			if (lastData && lastData.stores) {
				const loadedStocks: Record<StoreId, Partial<StockData>> = {
					lago: lastData.stores.lago?.stock || {},
					conjunto: lastData.stores.conjunto?.stock || {},
					terraco: lastData.stores.terraco?.stock || {},
					noroeste: lastData.stores.noroeste?.stock || {},
				};
				setProjectedStocks(loadedStocks);
				localStorage.setItem("repos_projected_stocks", JSON.stringify(loadedStocks));

				const dateStr =
					lastData.formattedDate ||
					(lastData.timestamp?.toDate ? formatDate(lastData.timestamp.toDate()) : null);
				if (dateStr) {
					setLastFinalizedDate(dateStr);
					localStorage.setItem("repos_last_finalized_date", dateStr);
				}
				if (lastData.sessionId) {
					localStorage.setItem("repos_session_id", lastData.sessionId);
				}
				isInitialized.current = true;
				isSavedThisRun.current = true;
				setIsFinalizedSession(true);
			} else {
				// Se não havia nada no banco, mantém o do localStorage (se houver) ou inicializa de allData
				const savedProjected = localStorage.getItem("repos_projected_stocks");
				if (savedProjected) {
					setProjectedStocks(JSON.parse(savedProjected));
					isInitialized.current = true;
				} else if (allData.length > 0) {
					const initialProjected: any = {};
					allData.forEach((store) => {
						initialProjected[store.id] = { ...store.stock };
					});
					setProjectedStocks(initialProjected);
					isInitialized.current = true;
				}
			}
			setShowResetConfirm(false);
		} catch (err) {
			console.error("Erro ao acessar último reposicionamento:", err);
			alert("Erro ao carregar o último reposicionamento da base de dados.");
			setShowResetConfirm(false);
		} finally {
			setStartingRepo(false);
		}
	};

	const renderPrintableReceipt = () => {
		const movements = calculateOptimizedSummary();
		if (movements.length === 0) return null;

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

		const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
			return TARGET_STORES_ORDER.indexOf(a.to) - TARGET_STORES_ORDER.indexOf(b.to);
		});

		return (
			<table className="hidden print:table w-full border-collapse border-none bg-transparent">
				<thead className="print:table-header-group">
					<tr>
						<th className="h-8 print:h-12 border-none bg-transparent p-0"></th>
					</tr>
				</thead>
				<tfoot className="print:table-footer-group">
					<tr>
						<th className="h-6 print:h-8 border-none bg-transparent p-0"></th>
					</tr>
				</tfoot>
				<tbody className="print:table-row-group">
					<tr>
						<td className="border-none bg-transparent p-0">
							<div className="flex flex-col space-y-4 print:space-y-10 w-full pl-2">
								{sortedGroups.map((group, groupIdx) => {
									const totalGroupQty = group.items.reduce((acc, item) => acc + item.qty, 0);

									return (
										<div
											key={`print-${groupIdx}`}
											className="flex flex-row items-stretch gap-3 print:gap-x-6 w-full text-left mb-3 print:mb-8 break-inside-avoid page-break-inside-avoid">
											{[0, 1].map((copyIndex) => (
												<div
													key={`${groupIdx}-${copyIndex}`}
													className="bg-white border border-slate-400 rounded-xl p-3 break-inside-avoid page-break-inside-avoid shadow-none text-left w-[18.5rem] flex flex-col justify-between">
													<div>
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
													<div className="mt-3 pt-1.5 border-t border-slate-400 flex items-center justify-between text-black text-[11pt] font-black">
														<span>Total:</span>
														<span>{totalGroupQty} pacotes</span>
													</div>
												</div>
											))}
										</div>
									);
								})}
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		);
	};

	const handlePrint = () => {
		const movements = calculateOptimizedSummary();
		if (movements.length === 0) return;

		const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
		const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
		const isSmallScreen = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
		const isMobile = isMobileUserAgent || isSmallScreen;

		if (isMobile) {
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

			const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
				return TARGET_STORES_ORDER.indexOf(a.to) - TARGET_STORES_ORDER.indexOf(b.to);
			});

			const printWindow = window.open("", "_blank");
			if (printWindow) {
				const dateStr = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
				const groupsHtml = sortedGroups
					.map((group) => {
						const totalGroupQty = group.items.reduce((acc, item) => acc + item.qty, 0);
						const itemsList = group.items
							.map((item) => `<li style="padding:2px 0; font-size:13px; font-weight:bold;">• <strong>${item.qty}</strong> ${item.label}</li>`)
							.join("");
						return `<div style="border:1px solid #999; border-radius:8px; padding:12px; margin-bottom:12px; page-break-inside:avoid;">
							<div style="font-weight:900; font-size:14px; text-transform:uppercase; border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:8px;">
								${STORE_NAMES[group.from]} → ${STORE_NAMES[group.to]}
							</div>
							<ul style="list-style:none; padding:0; margin:0 0 8px 0;">${itemsList}</ul>
							<div style="font-weight:900; font-size:13px; border-top:1px solid #ccc; padding-top:4px; display:flex; justify-content:space-between;">
								<span>Total:</span><span>${totalGroupQty} pacotes</span>
							</div>
						</div>`;
					})
					.join("");

				printWindow.document.write(`<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>Resumo de Reposicionamento</title>
						<style>
							body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; color: #111; margin: 0; }
							h2 { font-size: 16px; margin: 0 0 4px 0; text-transform: uppercase; }
							p.date { font-size: 11px; color: #666; margin: 0 0 16px 0; }
						</style>
					</head>
					<body>
						<h2>Resumo de Reposicionamento</h2>
						<p class="date">${dateStr}</p>
						${groupsHtml}
						<script>
							window.onload = function() {
								setTimeout(function() {
									window.print();
								}, 300);
							};
						</script>
					</body>
				</html>`);
				printWindow.document.close();
				return;
			}
		}

		window.print();
	};

	const handleWhatsApp = async () => {
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

		const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
			return TARGET_STORES_ORDER.indexOf(a.to) - TARGET_STORES_ORDER.indexOf(b.to);
		});

		let text = `*Resumo de Reposicionamento - ${new Date().toLocaleDateString("pt-BR")}*\n\n`;

		sortedGroups.forEach((group) => {
			text += `*${STORE_NAMES[group.from]} → ${STORE_NAMES[group.to]}:*\n`;
			group.items.forEach((item) => {
				text += `• ${item.qty} ${item.label}\n`;
			});
			text += `\n`;
		});

		// Identifica se é dispositivo móvel / iOS ou tela pequena
		const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
		const isMobileUserAgent = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
		const isSmallScreen = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
		const isMobile = isMobileUserAgent || isSmallScreen;

		// 1. Em displays menores ou dispositivos móveis/iOS: Tentar Web Share API nativa se disponível
		if (isMobile && typeof navigator !== "undefined" && typeof navigator.share === "function") {
			try {
				await navigator.share({
					title: `Resumo de Reposicionamento - ${new Date().toLocaleDateString("pt-BR")}`,
					text: text,
				});
				return;
			} catch (err: any) {
				// Se o usuário apenas cancelou a folha de compartilhamento, encerra
				if (err.name === "AbortError") {
					return;
				}
				console.warn("Navigator share falhou, tentando fallback:", err);
			}
		}

		// 2. Fallback para mobile / telas menores ou fluxo padrão para Desktop
		const encodedText = encodeURIComponent(text);

		if (isMobile) {
			// Em dispositivos móveis sem Web Share ou com falha, abre o aplicativo do WhatsApp
			window.location.href = `whatsapp://send?text=${encodedText}`;
			setTimeout(() => {
				window.location.href = `https://api.whatsapp.com/send?text=${encodedText}`;
			}, 700);
		} else {
			// Em telas maiores / Desktop, abre diretamente o WhatsApp Web com a mensagem preenchida
			window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
		}
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
						size: A4 portrait;
						margin: 15mm !important;
					}
					* {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						color-adjust: exact !important;
						box-sizing: border-box !important;
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
						margin: 0 !important;
					}
					main {
						padding: 0 !important;
						margin: 0 !important;
						width: 100% !important;
					}
					nav, header, footer, .print\\:hidden, button {
						display: none !important;
					}
					/* Quando o modal de resumo estiver aberto, ocultar todo o resto e exibir apenas o container de impressão */
					body:has(#modal-resumo-print) {
						visibility: hidden !important;
					}

					body:has(#modal-resumo-print) #modal-resumo-print,
					body:has(#modal-resumo-print) #modal-resumo-print * {
						visibility: visible !important;
					}

					/* Summary Modal Printing */
					#modal-resumo-print {
						position: absolute !important;
						left: 0 !important;
						top: 0 !important;
						display: block !important;
						width: 100% !important;
						max-width: 100% !important;
						margin: 0 !important;
						padding: 4mm 6mm !important;
						border: none !important;
						box-shadow: none !important;
						background: white !important;
						text-align: left !important;
						z-index: 9999 !important;
						backdrop-filter: none !important;
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
				}
			`,
				}}
			/>
			<div className="space-y-6 print:hidden">
			{/* Filter & Controls Bar */}
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
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
					<button
						onClick={confirmResetProjectedStocks}
						disabled={startingRepo}
						className="flex-1 sm:flex-none justify-center cursor-pointer flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 md:px-6 py-2.5 md:py-3.5 rounded-2xl font-black text-xs transition-all uppercase tracking-widest shadow-sm">
						{startingRepo ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
						{startingRepo ? "Iniciando..." : "Iniciar Novo"}
					</button>
					<button
						onClick={() => setHideOpen(!hideOpen)}
						className="flex-1 sm:flex-none justify-center cursor-pointer flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 px-4 md:px-6 py-2.5 md:py-3.5 rounded-2xl font-black text-xs transition-all border border-slate-200 dark:border-slate-800 uppercase tracking-widest shadow-sm">
						{hideOpen ? <Eye size={14} /> : <EyeOff size={14} />}
						{hideOpen ? "Mostrar Abertos" : "Ocultar Abertos"}
					</button>
				</div>
			</div>

			{/* Botão Topo: Finalizar reposicionamento e Legenda de Proporção */}
			<div className="relative flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4 py-1">
				<button
					onClick={handleRequestFinalize}
					disabled={savingRepos}
					className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 md:px-12 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-blue-500/20 dark:shadow-none hover:shadow-blue-500/30 hover:scale-[1.02] transition-all cursor-pointer uppercase tracking-widest">
					{savingRepos ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
					{savingRepos ? "Processando..." : "Finalizar reposicionamento"}
				</button>
			</div>

			<div className="bg-white dark:bg-slate-900 rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors print:hidden">
				<div className="overflow-x-auto overflow-y-visible">
					<table className="w-full table-fixed border-separate border-spacing-0 min-w-[34rem] md:min-w-[50rem]">
						<thead>
							<tr className="bg-slate-50 dark:bg-slate-800">
								<th className="w-[26%] md:w-[24%] min-w-[7.5rem] md:min-w-[12rem] p-3 md:p-5 text-sm md:text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-50 dark:bg-slate-800 z-20 border-b border-slate-200 dark:border-slate-700 text-center">
									Item
								</th>
								{STORE_ORDER.map((id) => (
									<th
										key={id}
										className="w-[18.5%] md:w-[19%] min-w-[6rem] md:min-w-[9.5rem] p-3 md:p-5 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-l border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
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

								return (
									<Fragment key={itemKey}>
										{showRepeatedHeader && (
											<tr className="bg-slate-100 dark:bg-slate-800/80">
												<th className="p-2 md:p-3 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest sticky left-0 bg-slate-100 dark:bg-slate-800/80 z-20 border-y border-slate-200 dark:border-slate-700">
													Item
												</th>
												{STORE_ORDER.map((id) => (
													<th
														key={`header-${id}-${index}`}
														className="p-2 md:p-3 text-center text-sm md:text-lg font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest border-l border-slate-200 dark:border-slate-700 border-y">
														{STORE_NAMES[id]}
													</th>
												))}
											</tr>
										)}
										<tr
											className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${isExpanded ? "bg-blue-50/30 dark:bg-blue-900/20" : ""}`}>
											<td className="p-3 md:p-4 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-800/50 z-10 border-r border-slate-50 dark:border-slate-800 border-b border-slate-100 dark:border-slate-800">
												<button
													onClick={() => setExpandedItem(isExpanded ? null : itemKey)}
													className="flex items-center gap-1.5 md:gap-2 text-sm md:text-xl font-black text-slate-600 dark:text-slate-400 uppercase hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-left">
													{isExpanded ? <ChevronUp size={16} className="md:w-[18px] md:h-[18px]" /> : <ChevronDown size={16} className="md:w-[18px] md:h-[18px]" />}
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

												const storeProp = storeProportions[id]?.[itemKey] || 0;

												let cellStyle = "relative p-2 md:p-3 text-center border-l border-slate-50 dark:border-slate-800 border-b border-slate-100 dark:border-slate-800 cursor-pointer select-none ";
												if (isSourceCell) {
													cellStyle += "bg-red-50 dark:bg-red-900/30 ring-2 ring-inset ring-red-500";
												} else if (isTargetCell) {
													cellStyle += "bg-emerald-50/70 dark:bg-emerald-900/30 ring-2 ring-inset ring-dashed ring-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50";
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
																className="absolute top-1 right-1 md:top-1.5 md:right-1.5 p-0.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow cursor-pointer z-10"
																title="Cancelar seleção">
																<X size={11} strokeWidth={3} />
															</button>
														)}

														<div className="flex flex-col items-center justify-center h-full min-h-[4.75rem] md:min-h-[5.25rem] gap-1">
															{/* Quantidade atual em estoque na célula com a meta entre parênteses centralizada verticalmente */}
															<div className="flex items-center justify-center gap-1 font-black px-0.5">
																{(v > 0 || initialOpenCount === 0 || hideOpen) && (
																	<span
																		className={`text-lg md:text-3xl font-black leading-none ${(initialOpenCount > 0 && !hideOpen) ? "text-slate-900 dark:text-slate-200" : (v === 0 && (initialOpenCount === 0 || hideOpen)) ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-200"}`}>
																		{v}
																	</span>
																)}
																<span
																	className="text-base md:text-2xl font-bold text-slate-400 dark:text-slate-500 leading-none"
																	title={`Estoque desejável em ${STORE_NAMES[id]}: ${storeProp}`}>
																	({storeProp > 0 ? storeProp : 0})
																</span>
																{!hideOpen && initialOpenCount > 0 && (
																	<span className="text-sm md:text-lg font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap leading-none ml-0.5">
																		+{initialOpenCount}ab
																	</span>
																)}
															</div>

															{/* Badges de Estado / Diferença com chaves estáticas separadas para o React reconciliar sem morph de DOM */}
															{isSourceCell ? (
																<div key={`badge-source-${id}`} className="text-[10px] md:text-xs font-black px-1.5 py-0.5 !mt-2 rounded-md bg-red-600 text-white uppercase tracking-tight inline-flex items-center gap-1 whitespace-nowrap">
																	<span>-{activeSelection.qty} saindo</span>
																</div>
															) : isTargetCell ? (
																<div key={`badge-target-${id}`} className="text-[10px] md:text-xs font-black px-1.5 py-0.5 rounded-md bg-emerald-600 text-white uppercase tracking-tight inline-flex items-center gap-1 whitespace-nowrap">
																	<span>+{activeSelection.qty} enviar</span>
																</div>
															) : (
																(receiving || sending) && (
																	<div key={`badge-diff-${id}`} className={`!mt-1 text-sm md:text-xl font-black leading-none ${receiving ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
																		{receiving ? `+${v - initial}` : `-${initial - v}`}
																	</div>
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

			{/* Botão Rodapé: Finalizar reposicionamento Centralizado */}
			<div className="flex justify-center items-center py-3">
				<button
					onClick={handleRequestFinalize}
					disabled={savingRepos}
					className="flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 md:px-12 py-3.5 md:py-4 rounded-2xl font-black text-xs md:text-sm shadow-xl shadow-blue-500/20 dark:shadow-none hover:shadow-blue-500/30 hover:scale-[1.02] transition-all cursor-pointer uppercase tracking-widest">
					{savingRepos ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
					{savingRepos ? "Processando..." : "Finalizar reposicionamento"}
				</button>
			</div>
			</div>

			{showSummary && (
				<div id="modal-resumo-print" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">

					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">
						<div className="p-3.5 md:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center print:hidden">
							<h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight text-center uppercase">
								Verificação de Reposicionamento - {new Date().toLocaleDateString("pt-BR")}
							</h2>
							<p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1 text-center">
								Confira as transferências calculadas abaixo antes de confirmar o reposicionamento.
							</p>
						</div>

						<div className="p-3.5 md:p-6 overflow-y-auto custom-scrollbar flex-1 print:overflow-visible print:p-0">
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

										const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
											return TARGET_STORES_ORDER.indexOf(a.to) - TARGET_STORES_ORDER.indexOf(b.to);
										});

										return (
											<div className="space-y-4 print:space-y-12 w-full flex flex-col items-stretch print:items-start text-center print:text-left">
												{/* Visualização em tela: Grid multi-colunas responsivo (1 col mobile, 2 col tablet, 3 col desktop) */}
												<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 w-full print:hidden">
													{sortedGroups.map((group, groupIdx) => {
														return (
															<div
																key={`screen-${groupIdx}`}
																className="p-3.5 md:p-4 bg-slate-50/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between text-center">
																<div>
																	<div className="flex items-center justify-center gap-2 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700 text-center">
																		<span className="text-xs md:text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight flex items-center justify-center gap-1.5 text-center whitespace-nowrap">
																			{STORE_NAMES[group.from]}
																			<ArrowRight size={14} className="text-blue-400 dark:text-blue-500 shrink-0" />
																			{STORE_NAMES[group.to]}:
																		</span>
																	</div>
																	<ul className="space-y-1.5 mt-2 flex flex-col items-center">
																		{group.items.map((item, i) => (
																			<li key={i} className="text-slate-700 dark:text-slate-200 font-bold text-xs md:text-sm text-center">
																				<strong className="font-black text-slate-900 dark:text-white mr-1">{item.qty}</strong>
																				{item.label}
																			</li>
																		))}
																	</ul>
																</div>
															</div>
														);
													})}
												</div>

												{renderPrintableReceipt()}
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

						<div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 md:gap-4 transition-colors print:hidden">
							<button
								onClick={() => setShowSummary(false)}
								disabled={savingRepos}
								className="flex-1 sm:flex-none min-w-[200px] px-6 py-3.5 rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 shadow-sm transition-all cursor-pointer text-center">
								Editar reposicionamento
							</button>
							<button
								onClick={executeFinalizeReposition}
								disabled={savingRepos}
								className="flex-1 sm:flex-none min-w-[220px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-8 py-3.5 rounded-2xl font-black text-xs md:text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 dark:shadow-none transition-all cursor-pointer text-center">
								{savingRepos ? <RefreshCw className="animate-spin" size={18} /> : <Check size={18} />}
								{savingRepos ? "Finalizando..." : "Finalizar reposicionamento"}
							</button>
						</div>
					</div>
				</div>
			)}

			{showFinalizedSuccessModal && (
				<div id="modal-resumo-print" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-emerald-200 dark:border-emerald-900/30">
						<div className="p-6 md:p-8 text-center space-y-4 print:hidden">
							<div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
								<Check size={36} className="stroke-[3]" />
							</div>
							<h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
								Reposicionamento Finalizado com Sucesso!
							</h3>
							<p className="text-slate-600 dark:text-slate-300 font-bold text-xs md:text-sm leading-relaxed">
								O reposicionamento foi registrado no banco de dados e já está disponível para outros dispositivos e no select <span className="text-blue-600 dark:text-blue-400 font-black">Comparativo de Estoque</span> na rota de Pedidos.
							</p>
						</div>

						<div className="p-5 md:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3 print:hidden">
							<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full">
								<button
									onClick={handleWhatsApp}
									className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest shadow-md shadow-emerald-500/20 transition-all cursor-pointer">
									<MessageCircle size={16} />
									Enviar no WhatsApp
								</button>
								<button
									onClick={handlePrint}
									className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3.5 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest shadow-md shadow-blue-500/20 transition-all cursor-pointer">
									<Printer size={16} />
									Imprimir
								</button>
							</div>
							<button
								onClick={() => setShowFinalizedSuccessModal(false)}
								className="w-full py-3 rounded-2xl font-black text-xs md:text-[0.75rem] uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
								Fechar
							</button>
						</div>

						{renderPrintableReceipt()}
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
			{showResetConfirm && (
				<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-xl shadow-2xl border border-blue-200 dark:border-blue-900/30 overflow-hidden flex flex-col">
						<div className="p-8 text-center space-y-5">
							<div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
								{startingRepo ? (
									<RefreshCw className="text-blue-600 dark:text-blue-400 animate-spin" size={40} />
								) : (
									<RefreshCw className="text-blue-600 dark:text-blue-400" size={40} />
								)}
							</div>
							<h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight leading-snug">
								Deseja acessar o último reposicionamento ou iniciar um novo?
							</h3>
						</div>
						<div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-4">
							<button 
								onClick={handleAccessLastReposition} 
								disabled={startingRepo}
								className="flex-1 px-6 py-4 rounded-2xl font-black text-sm md:text-base uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 shadow-sm disabled:opacity-50 cursor-pointer text-center transition-all">
								{startingRepo ? "Carregando..." : "Acessar último"}
							</button>
							<button 
								onClick={confirmResetProjectedStocks} 
								disabled={startingRepo}
								className="flex-1 px-6 py-4 rounded-2xl font-black text-sm md:text-base uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg disabled:opacity-50 cursor-pointer text-center transition-all">
								{startingRepo ? "Iniciando..." : "Iniciar novo"}
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
