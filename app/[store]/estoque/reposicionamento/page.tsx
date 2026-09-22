"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
	doc,
	onSnapshot,
	runTransaction,
	collection,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	StockData,
	STORE_NAMES,
	StoreId,
	formatDate,
	RepositionMovementItem,
	LatestRepositionState,
} from "@/types";
import {
	RefreshCw,
	CheckCircle2,
	Package,
	Clock,
	Check,
	X,
	RotateCcw,
	Search,
	AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";

const STORE_ORDER: StoreId[] = ["lago", "terraco", "conjunto", "noroeste"];

export default function RepositionStorePage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params) as { store: StoreId };
	const [loading, setLoading] = useState(true);
	const [latestRepo, setLatestRepo] = useState<LatestRepositionState | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
	const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	// Ouvir em tempo real o último estado de reposicionamento
	useEffect(() => {
		const unsubRepo = onSnapshot(doc(db, "repositionState", "latest"), (docSnap) => {
			if (docSnap.exists()) {
				const data = docSnap.data() as LatestRepositionState;
				setLatestRepo(data);
			} else {
				setLatestRepo(null);
			}
			setLoading(false);
		});

		return () => unsubRepo();
	}, []);

	// As outras 3 lojas participantes (seções dedicadas)
	const otherStores = useMemo(() => {
		return STORE_ORDER.filter((sId) => sId !== store);
	}, [store]);

	// Movimentações relevantes para esta loja
	const allMovements = useMemo(() => {
		if (!latestRepo || !latestRepo.movements) return [];
		return latestRepo.movements;
	}, [latestRepo]);

	// Agrupamento por cada uma das outras 3 lojas
	const movementsByStore = useMemo(() => {
		const map: Record<
			StoreId,
			{
				outgoings: RepositionMovementItem[];
				incomings: RepositionMovementItem[];
			}
		> = {
			lago: { outgoings: [], incomings: [] },
			terraco: { outgoings: [], incomings: [] },
			conjunto: { outgoings: [], incomings: [] },
			noroeste: { outgoings: [], incomings: [] },
		};

		allMovements.forEach((m) => {
			if (m.from === store && map[m.to]) {
				map[m.to].outgoings.push(m);
			} else if (m.to === store && map[m.from]) {
				map[m.from].incomings.push(m);
			}
		});

		return map;
	}, [allMovements, store]);

	// Execução Imediata de Confirmação ou Desfazer
	const handleToggleConfirmation = async (
		item: RepositionMovementItem,
		mode: "saida" | "entrada",
		isUndo: boolean
	) => {
		const opKey = `${item.id}_${mode}`;
		if (processingIds[opKey]) return;

		setProcessingIds((prev) => ({ ...prev, [opKey]: true }));
		setStatusMessage(null);

		try {
			const storeRef = doc(db, "stores", store);
			const repoRef = doc(db, "repositionState", "latest");
			const movementsCollectionRef = collection(db, "stores", store, "stockMovements");

			await runTransaction(db, async (transaction) => {
				const storeSnap = await transaction.get(storeRef);
				const repoSnap = await transaction.get(repoRef);

				if (!storeSnap.exists() || !repoSnap.exists()) {
					throw new Error("Dados não encontrados no servidor.");
				}

				const storeData = storeSnap.data();
				const storeStock = (storeData.stock || {}) as Partial<StockData>;
				const storeUnits = (storeData.isUnits || {}) as Partial<Record<keyof StockData, number>>;
				const repoData = repoSnap.data() as LatestRepositionState;
				const currentMovements = [...(repoData.movements || [])];

				const targetIndex = currentMovements.findIndex(
					(m) => m.id === item.id || (m.from === item.from && m.to === item.to && m.itemId === item.itemId)
				);

				if (targetIndex === -1) {
					throw new Error("Movimentação não encontrada.");
				}

				const targetMovement = { ...currentMovements[targetIndex] };
				const itemQty = targetMovement.qty;
				const currentQty = storeStock[item.itemId] || 0;
				let newQty = currentQty;
				let movementLogType: "saida" | "recebido" = "saida";
				let movementLogObs = "";
				const now = Timestamp.now();

				if (mode === "saida") {
					if (!isUndo) {
						// Confirmar saída: subtrai do estoque
						newQty = currentQty - itemQty;
						targetMovement.outConfirmed = true;
						targetMovement.outConfirmedAt = now;
						movementLogType = "saida";
						movementLogObs = `Reposicionamento: Saída para ${STORE_NAMES[item.to]}`;
					} else {
						// Desfazer saída: devolve ao estoque
						newQty = currentQty + itemQty;
						targetMovement.outConfirmed = false;
						targetMovement.outConfirmedAt = null;
						movementLogType = "recebido";
						movementLogObs = `Estorno de saída de reposicionamento para ${STORE_NAMES[item.to]}`;
					}
				} else {
					if (!isUndo) {
						// Confirmar chegada: soma ao estoque
						newQty = currentQty + itemQty;
						targetMovement.inConfirmed = true;
						targetMovement.inConfirmedAt = now;
						movementLogType = "recebido";
						movementLogObs = `Reposicionamento: Chegada de ${STORE_NAMES[item.from]}`;
					} else {
						// Desfazer chegada: subtrai do estoque
						newQty = currentQty - itemQty;
						targetMovement.inConfirmed = false;
						targetMovement.inConfirmedAt = null;
						movementLogType = "saida";
						movementLogObs = `Estorno de chegada de reposicionamento de ${STORE_NAMES[item.from]}`;
					}
				}

				currentMovements[targetIndex] = targetMovement;
				transaction.update(repoRef, { movements: currentMovements });

				// Atualiza estoque da loja
				transaction.update(storeRef, {
					[`stock.${item.itemId}`]: newQty,
					lastStockUpdate: serverTimestamp(),
				});

				// Log de movimentação
				const newMovementDoc = doc(movementsCollectionRef);
				const currentOpen =
					typeof storeUnits[item.itemId] === "boolean"
						? storeUnits[item.itemId]
							? 1
							: 0
						: storeUnits[item.itemId] || 0;

				transaction.set(newMovementDoc, {
					itemId: item.itemId,
					itemName: STOCK_LABELS[item.itemId] || item.itemName,
					type: movementLogType,
					quantity: itemQty,
					beforeStock: currentQty,
					afterStock: newQty,
					beforeOpen: currentOpen,
					afterOpen: currentOpen,
					obs: movementLogObs,
					timestamp: serverTimestamp(),
				});
			});

			const itemLabel = STOCK_LABELS[item.itemId] || item.itemName;
			setStatusMessage({
				type: "success",
				text: isUndo
					? `Estorno de ${itemLabel} realizado com sucesso!`
					: mode === "saida"
					? `Saída de ${item.qty} un. de ${itemLabel} confirmada e subtraída do estoque!`
					: `Chegada de ${item.qty} un. de ${itemLabel} confirmada e somada ao estoque!`,
			});
			setTimeout(() => setStatusMessage(null), 3500);
		} catch (error: any) {
			console.error("Erro ao atualizar:", error);
			setStatusMessage({
				type: "error",
				text: error.message || "Erro ao atualizar. Tente novamente.",
			});
		} finally {
			setProcessingIds((prev) => ({ ...prev, [opKey]: false }));
		}
	};

	// Alternar Descarte / Inoperante (Não mexe no estoque)
	const handleToggleDiscard = async (item: RepositionMovementItem, mode: "saida" | "entrada") => {
		const opKey = `${item.id}_discard_${mode}`;
		if (processingIds[opKey]) return;

		setProcessingIds((prev) => ({ ...prev, [opKey]: true }));
		setStatusMessage(null);

		try {
			const repoRef = doc(db, "repositionState", "latest");

			await runTransaction(db, async (transaction) => {
				const repoSnap = await transaction.get(repoRef);
				if (!repoSnap.exists()) return;

				const repoData = repoSnap.data() as LatestRepositionState;
				const currentMovements = [...(repoData.movements || [])];

				const targetIndex = currentMovements.findIndex(
					(m) => m.id === item.id || (m.from === item.from && m.to === item.to && m.itemId === item.itemId)
				);

				if (targetIndex === -1) return;

				const targetMovement = { ...currentMovements[targetIndex] };

				if (mode === "saida") {
					targetMovement.outDiscarded = !targetMovement.outDiscarded;
				} else {
					targetMovement.inDiscarded = !targetMovement.inDiscarded;
				}

				currentMovements[targetIndex] = targetMovement;
				transaction.update(repoRef, { movements: currentMovements });
			});
		} catch (err: any) {
			console.error("Erro ao alternar descarte:", err);
			setStatusMessage({
				type: "error",
				text: "Não foi possível alterar o estado da movimentação.",
			});
		} finally {
			setProcessingIds((prev) => ({ ...prev, [opKey]: false }));
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p className="font-bold">Carregando reposicionamento...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Tab Switcher */}
			<div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
				<Link
					href={`/${store}/estoque`}
					className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-sm font-black transition-all">
					Movimentações de Estoque
				</Link>
				<Link
					href={`/${store}/estoque2`}
					className="px-6 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-sm font-black transition-all">
					Estoque Atual
				</Link>
				<Link
					href={`/${store}/estoque/reposicionamento`}
					className="px-6 py-2.5 bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 rounded-xl text-sm font-black shadow-sm transition-all">
					Reposicionamento
				</Link>
			</div>

			{/* Mensagem Toast de Feedback */}
			{statusMessage && (
				<div
					className={`p-4 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-sm ${
						statusMessage.type === "success"
							? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
							: "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
					}`}>
					{statusMessage.type === "success" ? (
						<CheckCircle2 className="shrink-0 text-emerald-600 dark:text-emerald-400" size={20} />
					) : (
						<AlertCircle className="shrink-0 text-red-600 dark:text-red-400" size={20} />
					)}
					<span>{statusMessage.text}</span>
				</div>
			)}

			{/* Header Informativo */}
			<div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
							Último Reposicionamento Salvo
						</span>
						{latestRepo?.formattedDate && (
							<span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
								{latestRepo.formattedDate}
							</span>
						)}
					</div>
					<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
						{STORE_NAMES[store]}
					</h2>
					<p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
						Confirmação direta de saídas e chegadas organizadas pelas lojas de origem e destino.
					</p>
				</div>

				{/* Campo de Busca Rápida por Sabor */}
				<div className="relative w-full md:w-72">
					<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Filtrar por sabor..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
					/>
				</div>
			</div>

			{/* 3 SEÇÕES: UMA PARA CADA UMA DAS OUTRAS 3 LOJAS */}
			<div className="space-y-8">
				{otherStores.map((partnerStoreId) => {
					const partnerName = STORE_NAMES[partnerStoreId];
					const storeData = movementsByStore[partnerStoreId] || { outgoings: [], incomings: [] };

					// Filtrar por busca de sabor
					const filteredOutgoings = storeData.outgoings.filter((m) => {
						if (!searchTerm.trim()) return true;
						const label = STOCK_LABELS[m.itemId] || m.itemName || "";
						return label.toLowerCase().includes(searchTerm.toLowerCase());
					});

					const filteredIncomings = storeData.incomings.filter((m) => {
						if (!searchTerm.trim()) return true;
						const label = STOCK_LABELS[m.itemId] || m.itemName || "";
						return label.toLowerCase().includes(searchTerm.toLowerCase());
					});

					const totalMovements = filteredOutgoings.length + filteredIncomings.length;

					return (
						<section
							key={partnerStoreId}
							className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
							{/* Cabeçalho da Seção da Loja Parceira */}
							<div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-3 h-3 rounded-full bg-slate-700 dark:bg-slate-300" />
									<h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
										{partnerName}
									</h3>
								</div>
								<span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl">
									{totalMovements} {totalMovements === 1 ? "movimentação" : "movimentações"}
								</span>
							</div>

							{/* Lista de Movimentações desta Loja */}
							{totalMovements === 0 ? (
								<div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">
									Nenhuma movimentação com {partnerName} neste reposicionamento.
								</div>
							) : (
								<div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2 md:p-4 space-y-3">
									{/* 1. SAÍDAS PARA ESTA LOJA */}
									{filteredOutgoings.map((item) => {
										const itemLabel = STOCK_LABELS[item.itemId] || item.itemName;
										const isConfirmed = !!item.outConfirmed;
										const isDiscarded = !!item.outDiscarded;
										const isOpBusy = !!processingIds[`${item.id}_saida`];

										return (
											<div
												key={`out_${item.id || item.itemId}`}
												className={`p-4 md:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
													isDiscarded
														? "opacity-40 grayscale bg-slate-100/50 dark:bg-slate-800/30 border-dashed border-slate-300 dark:border-slate-700"
														: isConfirmed
														? "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
														: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
												}`}>
												{/* Conteúdo Principal: Sabor e Quantidade com máximo destaque */}
												<div className="flex items-center gap-4 min-w-0">
													<div className="flex flex-col">
														<span className="text-[0.65rem] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
															Saída
														</span>
														<div className="flex items-baseline gap-3 flex-wrap">
															<span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
																{itemLabel}
															</span>
															<span className="text-lg md:text-xl font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 px-3 py-0.5 rounded-lg whitespace-nowrap">
																{item.qty} {item.qty === 1 ? "pacote" : "pacotes"}
															</span>
														</div>

														{isConfirmed && item.outConfirmedAt && (
															<span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
																<Check size={14} className="stroke-[3]" />
																Confirmado em {formatDate(item.outConfirmedAt.toDate ? item.outConfirmedAt.toDate() : new Date())}
															</span>
														)}
														{isDiscarded && (
															<span className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">
																Movimentação descartada (inoperante)
															</span>
														)}
													</div>
												</div>

												{/* Botões de Ação */}
												<div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
													{isDiscarded ? (
														<button
															onClick={() => handleToggleDiscard(item, "saida")}
															disabled={isOpBusy}
															className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">
															Reativar movimentação
														</button>
													) : isConfirmed ? (
														<button
															onClick={() => handleToggleConfirmation(item, "saida", true)}
															disabled={isOpBusy}
															className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-700 transition-all">
															{isOpBusy ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={13} />}
															Desfazer saída
														</button>
													) : (
														<>
															{/* Botão X para descartar / tornar inoperante */}
															<button
																onClick={() => handleToggleDiscard(item, "saida")}
																disabled={isOpBusy}
																title="Descartar movimentação"
																className="cursor-pointer p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
																<X size={16} strokeWidth={2.5} />
															</button>

															{/* Botão Vermelho de Confirmação de Saída imediata */}
															<button
																onClick={() => handleToggleConfirmation(item, "saida", false)}
																disabled={isOpBusy}
																className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
																{isOpBusy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} className="stroke-[3]" />}
																Confirmar Saída
															</button>
														</>
													)}
												</div>
											</div>
										);
									})}

									{/* 2. CHEGADAS VINDAS DESTA LOJA */}
									{filteredIncomings.map((item) => {
										const itemLabel = STOCK_LABELS[item.itemId] || item.itemName;
										const isConfirmed = !!item.inConfirmed;
										const isDiscarded = !!item.inDiscarded;
										const isDispatchedByOrigin = !!item.outConfirmed;
										const isOpBusy = !!processingIds[`${item.id}_entrada`];

										return (
											<div
												key={`in_${item.id || item.itemId}`}
												className={`p-4 md:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
													isDiscarded
														? "opacity-40 grayscale bg-slate-100/50 dark:bg-slate-800/30 border-dashed border-slate-300 dark:border-slate-700"
														: isConfirmed
														? "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
														: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
												}`}>
												{/* Conteúdo Principal: Sabor e Quantidade com máximo destaque */}
												<div className="flex items-center gap-4 min-w-0">
													<div className="flex flex-col">
														<div className="flex items-center gap-2">
															<span className="text-[0.65rem] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
																Chegada / Entrada
															</span>
															{/* Badge de status da origem */}
															<span
																className={`text-[0.65rem] font-bold px-2 py-0.2 rounded-md ${
																	isDispatchedByOrigin
																		? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
																		: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
																}`}>
																{isDispatchedByOrigin ? "✓ Despachado pela origem" : "Aguardando envio pela origem"}
															</span>
														</div>

														<div className="flex items-baseline gap-3 flex-wrap mt-0.5">
															<span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
																{itemLabel}
															</span>
															<span className="text-lg md:text-xl font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 px-3 py-0.5 rounded-lg whitespace-nowrap">
																{item.qty} {item.qty === 1 ? "pacote" : "pacotes"}
															</span>
														</div>

														{isConfirmed && item.inConfirmedAt && (
															<span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
																<Check size={14} className="stroke-[3]" />
																Confirmado em {formatDate(item.inConfirmedAt.toDate ? item.inConfirmedAt.toDate() : new Date())}
															</span>
														)}
														{isDiscarded && (
															<span className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">
																Movimentação descartada (inoperante)
															</span>
														)}
													</div>
												</div>

												{/* Botões de Ação */}
												<div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
													{isDiscarded ? (
														<button
															onClick={() => handleToggleDiscard(item, "entrada")}
															disabled={isOpBusy}
															className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">
															Reativar movimentação
														</button>
													) : isConfirmed ? (
														<button
															onClick={() => handleToggleConfirmation(item, "entrada", true)}
															disabled={isOpBusy}
															className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-200 dark:border-slate-700 transition-all">
															{isOpBusy ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={13} />}
															Desfazer chegada
														</button>
													) : (
														<>
															{/* Botão X para descartar / tornar inoperante */}
															<button
																onClick={() => handleToggleDiscard(item, "entrada")}
																disabled={isOpBusy}
																title="Descartar movimentação"
																className="cursor-pointer p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
																<X size={16} strokeWidth={2.5} />
															</button>

															{/* Botão Verde de Confirmação de Chegada imediata */}
															<button
																onClick={() => handleToggleConfirmation(item, "entrada", false)}
																disabled={isOpBusy}
																className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
																{isOpBusy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} className="stroke-[3]" />}
																Confirmar Chegada
															</button>
														</>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}
