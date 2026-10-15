"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
	doc,
	onSnapshot,
	updateDoc,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	STORE_NAMES,
	StoreId,
	LatestRepositionState,
	normalizeSearchText,
} from "@/types";
import {
	Package,
	Check,
	Plus,
	Minus,
	Search,
	RotateCcw,
	ArrowRight,
} from "lucide-react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// As 3 lojas de destino dos pacotes que saem do Lago
const DESTINATION_STORES: StoreId[] = ["terraco", "conjunto", "noroeste"];

export default function RepositionStorePage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params) as { store: StoreId };
	const router = useRouter();

	const [loading, setLoading] = useState(true);
	const [latestRepo, setLatestRepo] = useState<LatestRepositionState | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [updatingChecklist, setUpdatingChecklist] = useState<Record<string, boolean>>({});

	// Se não for a loja do Lago, redireciona para a página principal de estoque da loja
	useEffect(() => {
		if (store !== "lago") {
			router.replace(`/${store}/estoque`);
		}
	}, [store, router]);

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

	// Movimentações relevantes: estritamente o que sai do Lago para as outras lojas
	const lakeOutgoings = useMemo(() => {
		if (!latestRepo || !latestRepo.movements) return [];
		return latestRepo.movements.filter((m) => m.from === "lago");
	}, [latestRepo]);

	// Agrupamento por cada uma das 3 lojas de destino
	const movementsByDestination = useMemo(() => {
		const map: Record<StoreId, typeof lakeOutgoings> = {
			terraco: [],
			conjunto: [],
			noroeste: [],
			lago: [],
		};

		lakeOutgoings.forEach((m) => {
			if (map[m.to]) {
				map[m.to].push(m);
			}
		});

		return map;
	}, [lakeOutgoings]);

	// Helper para ler estado do checklist salvo no reposicionamento (sem afetar estoque!)
	const getChecklistState = (movementId: string, originalQty: number) => {
		const itemState = latestRepo?.checklist?.[movementId];
		if (!itemState) {
			return {
				separatedQty: 0,
				remainingQty: originalQty,
				isCompleted: false,
			};
		}

		const separatedQty = Math.min(originalQty, Math.max(0, itemState.separatedQty ?? 0));
		const remainingQty = Math.max(0, originalQty - separatedQty);
		const isCompleted = itemState.done || remainingQty === 0;

		return {
			separatedQty,
			remainingQty,
			isCompleted,
		};
	};

	// Atualiza checklist puramente visual no documento latest
	const updateChecklist = async (movementId: string, newSeparatedQty: number, markDone?: boolean) => {
		if (updatingChecklist[movementId]) return;
		setUpdatingChecklist((prev) => ({ ...prev, [movementId]: true }));

		try {
			const repoRef = doc(db, "repositionState", "latest");
			const movement = lakeOutgoings.find((m) => m.id === movementId);
			const originalQty = movement?.qty || 1;

			const clampedSeparated = Math.max(0, Math.min(originalQty, newSeparatedQty));
			const isDone = markDone !== undefined ? markDone : clampedSeparated >= originalQty;

			await updateDoc(repoRef, {
				[`checklist.${movementId}`]: {
					separatedQty: clampedSeparated,
					done: isDone,
				},
			});
		} catch (error) {
			console.error("Erro ao atualizar checklist visual de reposicionamento:", error);
		} finally {
			setUpdatingChecklist((prev) => ({ ...prev, [movementId]: false }));
		}
	};

	// Ações do checklist
	const handleDecrementRemaining = (movementId: string, originalQty: number) => {
		// Dar baixa em 1 pacote restante = aumentar 1 pacote separado
		const current = getChecklistState(movementId, originalQty);
		if (current.remainingQty <= 0) return;
		const nextSeparated = current.separatedQty + 1;
		updateChecklist(movementId, nextSeparated, nextSeparated >= originalQty);
	};

	const handleIncrementRemaining = (movementId: string, originalQty: number) => {
		// Desfazer baixa acidental = reduzir 1 pacote separado
		const current = getChecklistState(movementId, originalQty);
		if (current.separatedQty <= 0) return;
		const nextSeparated = current.separatedQty - 1;
		updateChecklist(movementId, nextSeparated, false);
	};

	const handleToggleCheck = (movementId: string, originalQty: number) => {
		const current = getChecklistState(movementId, originalQty);
		if (current.isCompleted) {
			// Se já estava completo, desmarca e zera as baixas
			updateChecklist(movementId, 0, false);
		} else {
			// Marca como concluído direto (separa todos os pacotes)
			updateChecklist(movementId, originalQty, true);
		}
	};

	if (store !== "lago") {
		return null;
	}

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-slate-400">
				<p className="font-bold">Carregando checklist de reposicionamento...</p>
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

			{/* Header Informativo */}
			<div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
							Checklist de Saída de Pacotes • Lago
						</span>
						{latestRepo?.formattedDate && (
							<span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
								{latestRepo.formattedDate}
							</span>
						)}
					</div>
					<h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
						Pacotes a Enviar para Outras Lojas
					</h2>
					<p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
						Marque os pacotes conforme forem separados para saída. Este checklist é visual e informativo para a equipe.
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

			{/* SEÇÕES DAS 3 LOJAS DE DESTINO: TERRAÇO, CONJUNTO E NOROESTE */}
			<div className="space-y-8">
				{DESTINATION_STORES.map((destinationStoreId) => {
					const destinationName = STORE_NAMES[destinationStoreId];
					const storeMovements = movementsByDestination[destinationStoreId] || [];

					// Filtrar por busca de sabor
					const filteredMovements = storeMovements.filter((m) => {
						if (!searchTerm.trim()) return true;
						const label = STOCK_LABELS[m.itemId] || m.itemName || "";
						return normalizeSearchText(label).includes(normalizeSearchText(searchTerm));
					});

					const totalMovements = filteredMovements.length;
					const completedCount = filteredMovements.filter((m) => {
						const state = getChecklistState(m.id, m.qty);
						return state.isCompleted;
					}).length;

					return (
						<section
							key={destinationStoreId}
							className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
							{/* Cabeçalho da Seção de Destino */}
							<div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-3 h-3 rounded-full bg-red-600" />
									<div className="flex items-center gap-2">
										<span className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
											Enviar para
										</span>
										<ArrowRight size={14} className="text-slate-400" />
										<h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
											{destinationName}
										</h3>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl">
										{completedCount} de {totalMovements} {totalMovements === 1 ? "item pronto" : "itens prontos"}
									</span>
								</div>
							</div>

							{/* Lista de Pacotes a Enviar */}
							{totalMovements === 0 ? (
								<div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">
									Nenhum pacote a ser enviado para {destinationName} neste reposicionamento.
								</div>
							) : (
								<div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2 md:p-4 space-y-3">
									{filteredMovements.map((item) => {
										const itemLabel = STOCK_LABELS[item.itemId] || item.itemName;
										const checklistState = getChecklistState(item.id, item.qty);
										const isDone = checklistState.isCompleted;
										const remaining = checklistState.remainingQty;
										const originalQty = item.qty;
										const isBusy = !!updatingChecklist[item.id];

										return (
											<div
												key={item.id}
												className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
													isDone
														? "opacity-40 grayscale-[40%] bg-slate-100/70 dark:bg-slate-800/30 border-dashed border-slate-300 dark:border-slate-700"
														: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
												}`}>
												{/* Nome do Item e Quantidade */}
												<div className="flex items-center gap-4 min-w-0 flex-1">
													<div className="flex flex-col min-w-0">
														<span className="text-[0.65rem] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
															Saída do Lago
														</span>
														<div className="flex items-baseline gap-3 flex-wrap">
															<span
																className={`text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase transition-all ${
																	isDone ? "line-through text-slate-400 dark:text-slate-500" : ""
																}`}>
																{itemLabel}
															</span>

															{/* Badges de Quantidade Original vs Restante */}
															<div className="flex items-center gap-2">
																<span
																	className={`text-base md:text-lg font-extrabold px-3 py-0.5 rounded-lg whitespace-nowrap transition-all ${
																		isDone
																			? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 line-through"
																			: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40"
																	}`}>
																	{originalQty} {originalQty === 1 ? "pct total" : "pcts total"}
																</span>

																{!isDone && checklistState.separatedQty > 0 && (
																	<span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
																		Faltam {remaining}
																	</span>
																)}
															</div>
														</div>

														{isDone && (
															<span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
																<Check size={14} className="stroke-[3]" />
																Todos os pacotes deste sabor já deram saída
															</span>
														)}
													</div>
												</div>

												{/* Controles de Checklist: -1, +1 e Check */}
												<div className="flex items-center gap-2 self-end sm:self-center shrink-0">
													{/* Botão de Corrigir / +1 Pacote Restante */}
													<button
														type="button"
														disabled={isBusy || checklistState.separatedQty <= 0}
														onClick={() => handleIncrementRemaining(item.id, originalQty)}
														title="Corrigir: adicionar +1 pacote pendente"
														className={`p-2.5 rounded-xl border font-black text-xs transition-all flex items-center gap-1 ${
															checklistState.separatedQty <= 0
																? "opacity-30 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
																: "cursor-pointer bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95"
														}`}>
														<Plus size={16} strokeWidth={3} />
														<span className="hidden sm:inline">1</span>
													</button>

													{/* Botão de Baixa: -1 Pacote Restante */}
													<button
														type="button"
														disabled={isBusy || remaining <= 0}
														onClick={() => handleDecrementRemaining(item.id, originalQty)}
														title="Baixar 1 pacote separado"
														className={`px-3.5 py-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
															remaining <= 0
																? "opacity-30 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
																: "cursor-pointer bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 active:scale-95 shadow-xs"
														}`}>
														<Minus size={16} strokeWidth={3} />
														<span>1 Pacote</span>
													</button>

													{/* Botão de Check / Baixar Todos */}
													<button
														type="button"
														disabled={isBusy}
														onClick={() => handleToggleCheck(item.id, originalQty)}
														title={isDone ? "Desmarcar todos" : "Baixar todos os pacotes deste sabor"}
														className={`p-2.5 md:px-4 md:py-2.5 rounded-xl border font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
															isDone
																? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
																: "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 hover:text-emerald-600 hover:border-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
														}`}>
														<Check size={18} strokeWidth={isDone ? 4 : 3} />
														<span className="hidden md:inline">{isDone ? "Pronto" : "Concluir"}</span>
													</button>
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
