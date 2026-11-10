"use client";

import { useState, useEffect, useMemo } from "react";
import {
	DollarSign,
	TrendingUp,
	TrendingDown,
	Plus,
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Store,
	Filter,
	BarChart3,
	PieChart,
	FileSpreadsheet,
	Layers,
	Receipt,
	ArrowUpRight,
	ArrowDownRight,
	CheckCircle2,
	Clock,
	Sliders,
	Building,
	Percent,
	Sparkles,
} from "lucide-react";
import {
	CustoFinanceiro,
	CustoComRateio,
	FaturamentoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	PeriodoModo,
	SPECIFIC_STORE_IDS,
	isGeneralOnlyCostCategory,
} from "@/types/financeiro-controle";
import {
	subscribeFaturamentos,
	createFaturamento,
	updateFaturamento,
	deleteFaturamento,
	subscribeCustos,
	createCusto,
	updateCusto,
	deleteCusto,
} from "@/lib/financeiro-controle-service";
import {
	calcularProporcoesMensaisFaturamento,
	apportionCustosForStore,
	getMonthRef,
} from "@/lib/financeiro-controle-rateio";

import ControleChart from "./components/controle-chart";
import ControleCalendarioCustos from "./components/controle-calendario-custos";
import FaturamentoModal from "./components/faturamento-modal";
import FaturamentoDetalhesModal from "./components/faturamento-detalhes-modal";
import CustoModal from "./components/custo-modal";
import FaturamentoTable from "./components/faturamento-table";
import CustosTable from "./components/custos-table";
import DreSummary from "./components/dre-summary";

const MESES = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
		maximumFractionDigits: 2,
	}).format(val || 0);
};

export default function ControlePage() {
	// Dados
	const [faturamentos, setFaturamentos] = useState<FaturamentoFinanceiro[]>([]);
	const [custos, setCustos] = useState<CustoFinanceiro[]>([]);
	const [loading, setLoading] = useState(true);

	// Filtros Globais
	const [periodMode, setPeriodMode] = useState<PeriodoModo>("mes");
	const [mesAnoStr, setMesAnoStr] = useState(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	});
	const [lojaFilter, setLojaFilter] = useState<string>("todas");

	// Aba ativa de visualização interna
	const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "faturamento" | "custos" | "dre">("dashboard");

	// Modais
	const [isFatModalOpen, setIsFatModalOpen] = useState(false);
	const [editingFat, setEditingFat] = useState<FaturamentoFinanceiro | null>(null);

	const [isFatDetalhesOpen, setIsFatDetalhesOpen] = useState(false);
	const [selectedFatDetalhes, setSelectedFatDetalhes] = useState<FaturamentoFinanceiro | null>(null);

	const [isCustoModalOpen, setIsCustoModalOpen] = useState(false);
	const [editingCusto, setEditingCusto] = useState<CustoFinanceiro | null>(null);
	const [defaultCategoriaCusto, setDefaultCategoriaCusto] = useState<CategoriaCusto>("cookies");

	// Data e Loja dinâmicas para inicialização dos modais
	const [modalDefaultData, setModalDefaultData] = useState<string | undefined>(undefined);
	const [modalDefaultLoja, setModalDefaultLoja] = useState<StoreIdWithGeral>("geral");

	// Inscrição em Tempo Real (Firestore)
	useEffect(() => {
		const unsubFat = subscribeFaturamentos((data) => {
			setFaturamentos(data);
		});
		const unsubCustos = subscribeCustos((data) => {
			setCustos(data);
			setLoading(false);
		});

		return () => {
			unsubFat();
			unsubCustos();
		};
	}, []);

	// Navegação de Mês e Ano
	const [ano, mes] = useMemo(() => {
		const parts = mesAnoStr.split("-");
		return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
	}, [mesAnoStr]);

	const currentYear = useMemo(() => new Date().getFullYear(), []);
	const currentMonth = useMemo(() => new Date().getMonth() + 1, []);

	// Mês máximo a considerar para o ano selecionado no modo Ano Todo:
	// "ao ano todo (de janeiro até o mês anterior ao atual)"
	const maxMonthForAno = useMemo(() => {
		if (ano === currentYear) {
			return Math.max(1, currentMonth - 1);
		} else if (ano < currentYear) {
			return 12;
		}
		return 0; // ano futuro
	}, [ano, currentYear, currentMonth]);

	const handlePrevMonth = () => {
		let newMes = mes - 1;
		let newAno = ano;
		if (newMes < 1) {
			newMes = 12;
			newAno -= 1;
		}
		setMesAnoStr(`${newAno}-${String(newMes).padStart(2, "0")}`);
	};

	const handleNextMonth = () => {
		let newMes = mes + 1;
		let newAno = ano;
		if (newMes > 12) {
			newMes = 1;
			newAno += 1;
		}
		setMesAnoStr(`${newAno}-${String(newMes).padStart(2, "0")}`);
	};

	const handleCurrentMonth = () => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		setMesAnoStr(`${year}-${month}`);
		setPeriodMode("mes");
	};

	// 0. Proporções mensais do faturamento entre as 4 lojas específicas (base do rateio de Cookies e Insumos)
	const proporcoesMensais = useMemo(() => {
		return calcularProporcoesMensaisFaturamento(faturamentos);
	}, [faturamentos]);

	// 1. Filtragem por Período (antes da filtragem por loja)
	const periodFaturamentos = useMemo(() => {
		return faturamentos.filter((fat) => {
			const ref = getMonthRef(fat);
			if (periodMode === "mes") {
				return ref === mesAnoStr;
			}
			if (periodMode === "ano") {
				if (!ref.startsWith(`${ano}-`)) return false;
				const m = parseInt(ref.split("-")[1], 10);
				return !isNaN(m) && m >= 1 && m <= maxMonthForAno;
			}
			return true;
		});
	}, [faturamentos, periodMode, mesAnoStr, ano, maxMonthForAno]);

	const periodCustos = useMemo(() => {
		return custos.filter((c) => {
			const ref = getMonthRef(c);
			if (periodMode === "mes") {
				return ref === mesAnoStr;
			}
			if (periodMode === "ano") {
				if (!ref.startsWith(`${ano}-`)) return false;
				const m = parseInt(ref.split("-")[1], 10);
				return !isNaN(m) && m >= 1 && m <= maxMonthForAno;
			}
			return true;
		});
	}, [custos, periodMode, mesAnoStr, ano, maxMonthForAno]);

	// 2. Filtragem Final por Loja (com Rateio Proporcional de Cookies e Insumos)
	const filteredFaturamentos = useMemo(() => {
		if (lojaFilter === "todas") return periodFaturamentos;
		return periodFaturamentos.filter((fat) => fat.lojaId === lojaFilter);
	}, [periodFaturamentos, lojaFilter]);

	const filteredCustos: CustoComRateio[] = useMemo(() => {
		return apportionCustosForStore(periodCustos, lojaFilter, proporcoesMensais);
	}, [periodCustos, lojaFilter, proporcoesMensais]);

	// 3. Totais Consolidados do Período
	const totalFaturamento = useMemo(() => {
		return filteredFaturamentos.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
	}, [filteredFaturamentos]);

	const totalCustos = useMemo(() => {
		return filteredCustos.reduce((acc, curr) => acc + (curr.valor || 0), 0);
	}, [filteredCustos]);

	const lucroLiquido = totalFaturamento - totalCustos;
	const margemLiquida = totalFaturamento > 0 ? (lucroLiquido / totalFaturamento) * 100 : 0;
	const percentCustoSobreFat = totalFaturamento > 0 ? (totalCustos / totalFaturamento) * 100 : 0;

	// 4. Dados Preparados para os Gráficos
	// A) Evolução Mensal (mês a mês no ano selecionado)
	const mensalData = useMemo(() => {
		const MES_ABREV = [
			"Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
			"Jul", "Ago", "Set", "Out", "Nov", "Dez"
		];

		const endMonth = periodMode === "ano"
			? maxMonthForAno
			: Math.max(mes, maxMonthForAno, 1);

		const list = [];
		for (let m = 1; m <= endMonth; m++) {
			const mStr = `${ano}-${String(m).padStart(2, "0")}`;

			const fatMes = faturamentos
				.filter((f) => {
					if (lojaFilter !== "todas" && f.lojaId !== lojaFilter) return false;
					return getMonthRef(f) === mStr;
				})
				.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

			const custosDoMes = custos.filter((c) => getMonthRef(c) === mStr);
			const custMes = apportionCustosForStore(
				custosDoMes,
				lojaFilter,
				proporcoesMensais
			).reduce((acc, curr) => acc + (curr.valor || 0), 0);

			list.push({
				mesKey: mStr,
				label: MES_ABREV[m - 1],
				nomeMes: `${MESES[m - 1]} / ${ano}`,
				faturamento: fatMes,
				custos: custMes,
				lucro: fatMes - custMes,
			});
		}

		return list;
	}, [periodMode, maxMonthForAno, mes, ano, faturamentos, custos, lojaFilter, proporcoesMensais]);

	// B) Dados por Categoria de Custo
	const categoriaData = useMemo(() => {
		const catTotals: Record<CategoriaCusto, number> = {
			cookies: 0,
			insumos: 0,
			impostos: 0,
			royalties: 0,
			fundo_promocional: 0,
			aluguel: 0,
			energia: 0,
			contador: 0,
			folha: 0,
			outros: 0,
		};

		filteredCustos.forEach((c) => {
			if (catTotals[c.categoria] !== undefined) {
				catTotals[c.categoria] += c.valor || 0;
			} else {
				catTotals.outros += c.valor || 0;
			}
		});

		const list = Object.entries(catTotals)
			.filter(([, val]) => val > 0)
			.map(([catKey, val]) => {
				const cfg = CATEGORIAS_CUSTO_CONFIG[catKey as CategoriaCusto];
				const percent = totalCustos > 0 ? (val / totalCustos) * 100 : 0;
				return {
					categoria: catKey as CategoriaCusto,
					label: cfg?.label || catKey,
					valor: val,
					percent,
					color: cfg?.color || "#64748b",
				};
			});

		list.sort((a, b) => b.valor - a.valor);
		return list;
	}, [filteredCustos, totalCustos]);

	// C) Dados por Loja (com rateio proporcional de Cookies e Insumos para cada loja específica)
	const lojaData = useMemo(() => {
		const storeEntries = SPECIFIC_STORE_IDS.map((lojaKey) => {
			const fat = periodFaturamentos
				.filter((f) => f.lojaId === lojaKey)
				.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
			const cust = apportionCustosForStore(
				periodCustos,
				lojaKey,
				proporcoesMensais
			).reduce((acc, curr) => acc + (curr.valor || 0), 0);

			return {
				lojaId: lojaKey as string,
				nome: STORE_NAMES_EXTENDED[lojaKey] || lojaKey,
				faturamento: fat,
				custos: cust,
				lucro: fat - cust,
			};
		});

		// Incluir residual "geral" somente caso existam valores ainda não rateados (ex: mês com faturamento total zerado ou histórico legado)
		const totalPeriodoCustos = periodCustos.reduce((acc, curr) => acc + (curr.valor || 0), 0);
		const totalCustos4Lojas = storeEntries.reduce((acc, item) => acc + item.custos, 0);
		const residualGeralCust = Math.max(0, totalPeriodoCustos - totalCustos4Lojas);
		const residualGeralFat = periodFaturamentos
			.filter((f) => !SPECIFIC_STORE_IDS.includes(f.lojaId as any))
			.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

		if (residualGeralFat > 0.01 || residualGeralCust > 0.01) {
			storeEntries.push({
				lojaId: "geral",
				nome: STORE_NAMES_EXTENDED.geral,
				faturamento: residualGeralFat,
				custos: residualGeralCust,
				lucro: residualGeralFat - residualGeralCust,
			});
		}

		return storeEntries;
	}, [periodFaturamentos, periodCustos, proporcoesMensais]);

	// Maior centro de custo
	const topCusto = categoriaData[0];

	// Handlers de Ação
	const handleOpenNewFat = () => {
		setEditingFat(null);
		setModalDefaultLoja(lojaFilter !== "todas" ? (lojaFilter as StoreIdWithGeral) : "geral");
		setModalDefaultData(periodMode === "mes" ? `${mesAnoStr}-01` : undefined);
		setIsFatModalOpen(true);
	};

	const handleOpenNewFatComDia = (diaIso: string, loja: StoreIdWithGeral) => {
		setEditingFat(null);
		setModalDefaultLoja(loja);
		setModalDefaultData(diaIso);
		setIsFatModalOpen(true);
	};

	const handleOpenNewCusto = (categoria?: CategoriaCusto) => {
		setEditingCusto(null);
		if (categoria) setDefaultCategoriaCusto(categoria);
		setModalDefaultLoja(lojaFilter !== "todas" ? (lojaFilter as StoreIdWithGeral) : "geral");
		setModalDefaultData(periodMode === "mes" ? `${mesAnoStr}-01` : undefined);
		setIsCustoModalOpen(true);
	};

	const handleOpenNewCustoComDia = (
		diaIso: string,
		loja: StoreIdWithGeral,
		categoria?: CategoriaCusto
	) => {
		setEditingCusto(null);
		if (categoria) setDefaultCategoriaCusto(categoria);
		setModalDefaultLoja(loja);
		setModalDefaultData(diaIso);
		setIsCustoModalOpen(true);
	};

	const handleOpenEditCusto = (item: CustoFinanceiro) => {
		// Sempre busca o registro original do Firestore para nunca gravar valor proporcional no lugar do valor integral
		const rawCusto = custos.find((raw) => raw.id === item.id) || item;
		setEditingCusto(rawCusto);
		setIsCustoModalOpen(true);
	};

	const handleSaveFat = async (
		data: Omit<FaturamentoFinanceiro, "id" | "createdAt" | "updatedAt">
	) => {
		if (editingFat) {
			await updateFaturamento(editingFat.id, data);
		} else {
			await createFaturamento(data);
		}
	};

	const handleDeleteFat = async (id: string) => {
		if (window.confirm("Deseja realmente excluir este lançamento de faturamento?")) {
			try {
				await deleteFaturamento(id);
			} catch (err) {
				console.error("Erro ao excluir faturamento:", err);
				alert("Erro ao excluir lançamento de faturamento.");
			}
		}
	};

	const handleSaveCusto = async (
		data: Omit<CustoFinanceiro, "id" | "createdAt" | "updatedAt">
	) => {
		if (editingCusto) {
			await updateCusto(editingCusto.id, data);
		} else {
			await createCusto(data);
		}
	};

	const handleDeleteCusto = async (id: string) => {
		const target = custos.find((c) => c.id === id);
		const confirmMessage =
			target && isGeneralOnlyCostCategory(target.categoria) && lojaFilter !== "todas"
				? `Este custo de ${CATEGORIAS_CUSTO_CONFIG[target.categoria]?.label} é um lançamento Geral/Matriz (${formatCurrency(
						target.valor
				  )}) rateado entre as 4 lojas. Deseja realmente excluir o lançamento original?`
				: "Deseja realmente excluir este lançamento de custo?";

		if (window.confirm(confirmMessage)) {
			try {
				await deleteCusto(id);
			} catch (err) {
				console.error("Erro ao excluir custo:", err);
				alert("Erro ao excluir custo.");
			}
		}
	};

	return (
		<div className="space-y-6 pb-12">
			{/* Sub-abas de Visualização do Controle */}
			<div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
				<button
					type="button"
					onClick={() => setActiveSubTab("dashboard")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all ${
						activeSubTab === "dashboard"
							? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
							: "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					}`}>
					<BarChart3 size={15} />
					<span>Lançamentos</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveSubTab("faturamento")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all ${
						activeSubTab === "faturamento"
							? "bg-emerald-600 text-white shadow-sm"
							: "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					}`}>
					<DollarSign size={15} />
					<span>Faturamento ({filteredFaturamentos.length})</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveSubTab("custos")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all ${
						activeSubTab === "custos"
							? "bg-rose-600 text-white shadow-sm"
							: "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					}`}>
					<Receipt size={15} />
					<span>Custos & Despesas ({filteredCustos.length})</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveSubTab("dre")}
					className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all ${
						activeSubTab === "dre"
							? "bg-purple-600 text-white shadow-sm"
							: "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					}`}>
					<FileSpreadsheet size={15} />
					<span>DRE Gerencial</span>
				</button>
			</div>

			{/* Conteúdo Conforme a Sub-Aba Ativa */}
			{activeSubTab === "dashboard" && (
				<div className="space-y-6">
					{/* Visão de Tabela / Calendário: Custos Diários por Categoria com Controle Financeiro Unificado */}
					<ControleCalendarioCustos
						custos={custos}
						faturamentos={faturamentos}
						currentMesAno={mesAnoStr}
						currentLoja={lojaFilter}
						periodMode={periodMode}
						totalFaturamento={totalFaturamento}
						totalCustos={totalCustos}
						lucroLiquido={lucroLiquido}
						margemLiquida={margemLiquida}
						percentCustoSobreFat={percentCustoSobreFat}
						faturamentosCount={filteredFaturamentos.length}
						custosCount={filteredCustos.length}
						onNovoFaturamento={handleOpenNewFat}
						onNovoCusto={handleOpenNewCusto}
						onChangePeriodMode={(mode) => setPeriodMode(mode)}
						onSelectDiaParaCusto={handleOpenNewCustoComDia}
						onSelectDiaParaFaturamento={handleOpenNewFatComDia}
						onEditCusto={handleOpenEditCusto}
						onDeleteCusto={handleDeleteCusto}
						onEditFaturamento={(item) => {
							setSelectedFatDetalhes(item);
							setIsFatDetalhesOpen(true);
						}}
						onDeleteFaturamento={handleDeleteFat}
						onChangeMesAno={(newMesAno) => setMesAnoStr(newMesAno)}
						onChangeLoja={(newLoja) => setLojaFilter(newLoja)}
					/>

					{/* Gráfico Configurável */}
					<ControleChart
						mensalData={mensalData}
						categoriaData={categoriaData}
						lojaData={lojaData}
						totalFaturamento={totalFaturamento}
						totalCustos={totalCustos}
						totalLucro={lucroLiquido}
						isConsolidado={lojaFilter === "todas"}
						currentMesAno={mesAnoStr}
						currentLoja={lojaFilter}
						periodMode={periodMode}
						onChangeMesAno={(newMesAno) => setMesAnoStr(newMesAno)}
						onChangeLoja={(newLoja) => setLojaFilter(newLoja)}
						onChangePeriodMode={(mode) => setPeriodMode(mode)}
					/>

					{/* Atalhos Rápidos por Categorias de Custo */}
					<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 transition-colors">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
									<Receipt size={18} className="text-rose-500" />
									Despesas por Categorias Obrigatórias
								</h3>
								<p className="text-xs text-slate-500 dark:text-slate-400">
									Clique para lançar ou filtrar rapidamente qualquer uma das categorias
								</p>
							</div>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
							{(
								[
									"cookies",
									"insumos",
									"impostos",
									"royalties",
									"fundo_promocional",
									"aluguel",
									"energia",
									"contador",
									"folha",
									"outros",
								] as CategoriaCusto[]
							).map((catKey) => {
								const cfg = CATEGORIAS_CUSTO_CONFIG[catKey];
								const catTotal = filteredCustos
									.filter((c) => c.categoria === catKey)
									.reduce((acc, curr) => acc + (curr.valor || 0), 0);
								const catCount = filteredCustos.filter((c) => c.categoria === catKey).length;

								return (
									<div
										key={catKey}
										className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group">
										<div className="flex items-center justify-between mb-2">
											<span
												className="w-3 h-3 rounded-md"
												style={{ backgroundColor: cfg.color }}
											/>
											<button
												type="button"
												onClick={() => handleOpenNewCusto(catKey)}
												title={`Lançar novo custo em ${cfg.label}`}
												className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors opacity-80 group-hover:opacity-100">
												<Plus size={14} />
											</button>
										</div>
										<div>
											<p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
												{cfg.label}
											</p>
											<p className="text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">
												{formatCurrency(catTotal)}
											</p>
											<span className="text-[10px] text-slate-400 mt-1 block">
												{catCount} {catCount === 1 ? "registro" : "registros"}
												{lojaFilter !== "todas" && isGeneralOnlyCostCategory(catKey) && (
													<span className="text-amber-600 dark:text-amber-400 font-bold">
														{" "}• Rateio
													</span>
												)}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Tabelas Compactas de Últimos Registros */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Faturamentos Recentes */}
						<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
									<DollarSign size={16} className="text-emerald-500" />
									Faturamentos Recentes
								</h3>
								<button
									type="button"
									onClick={() => setActiveSubTab("faturamento")}
									className="text-xs font-bold text-emerald-600 hover:underline">
									Ver todos
								</button>
							</div>

							<div className="divide-y divide-slate-100 dark:divide-slate-800">
								{filteredFaturamentos.slice(0, 5).map((fat) => (
									<div
										key={fat.id}
										onClick={() => {
											setSelectedFatDetalhes(fat);
											setIsFatDetalhesOpen(true);
										}}
										className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
										<div>
											<p className="text-xs font-bold text-slate-800 dark:text-slate-200">
												{fat.descricao || (fat.tipo === "discriminado" ? "Venda Discriminada" : "Faturamento")}
											</p>
											<span className="text-[10px] text-slate-400">
												{fat.data ? fat.data.split("-").reverse().join("/") : "-"} • {STORE_NAMES_EXTENDED[fat.lojaId] || fat.lojaId}
											</span>
										</div>
										<span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
											{formatCurrency(fat.valorTotal)}
										</span>
									</div>
								))}
								{filteredFaturamentos.length === 0 && (
									<p className="text-xs text-slate-400 text-center py-6">
										Nenhum faturamento registrado no período.
									</p>
								)}
							</div>
						</div>

						{/* Custos Recentes */}
						<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
									<Receipt size={16} className="text-rose-500" />
									Custos Recentes (com Dia do Custo)
								</h3>
								<button
									type="button"
									onClick={() => setActiveSubTab("custos")}
									className="text-xs font-bold text-rose-600 hover:underline">
									Ver todos
								</button>
							</div>

							<div className="divide-y divide-slate-100 dark:divide-slate-800">
								{filteredCustos.slice(0, 5).map((custo) => {
									const cfg = CATEGORIAS_CUSTO_CONFIG[custo.categoria];
									return (
										<div
											key={custo.id}
											onClick={() => handleOpenEditCusto(custo)}
											className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
											<div className="min-w-0 pr-2">
												<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
													<span
														className="w-2 h-2 rounded-full inline-block shrink-0"
														style={{ backgroundColor: cfg?.color || "#64748b" }}
													/>
													<span className="truncate">{custo.descricao}</span>
												</p>
												<span className="text-[10px] text-slate-400 block truncate">
													Dia: {custo.data ? custo.data.split("-").reverse().join("/") : "-"} • {cfg?.label} • {STORE_NAMES_EXTENDED[custo.lojaId] || custo.lojaId}
													{custo.isRateio && custo.rateioPercent !== undefined && (
														<> • Rateio {custo.rateioPercent.toFixed(1).replace(".", ",")}% (Orig: {formatCurrency(custo.valorOriginal || 0)})</>
													)}
												</span>
											</div>
											<span className="text-xs font-black text-rose-600 dark:text-rose-400 shrink-0">
												{formatCurrency(custo.valor)}
											</span>
										</div>
									);
								})}
								{filteredCustos.length === 0 && (
									<p className="text-xs text-slate-400 text-center py-6">
										Nenhum custo registrado no período.
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Aba: Faturamento Completo */}
			{activeSubTab === "faturamento" && (
				<FaturamentoTable
					faturamentos={filteredFaturamentos}
					onViewDetails={(item) => {
						setSelectedFatDetalhes(item);
						setIsFatDetalhesOpen(true);
					}}
					onEdit={(item) => {
						setEditingFat(item);
						setIsFatModalOpen(true);
					}}
					onDelete={handleDeleteFat}
				/>
			)}

			{/* Aba: Custos Completo */}
			{activeSubTab === "custos" && (
				<CustosTable
					custos={filteredCustos}
					onEdit={handleOpenEditCusto}
					onDelete={handleDeleteCusto}
				/>
			)}

			{/* Aba: DRE Gerencial */}
			{activeSubTab === "dre" && (
				<DreSummary
					faturamentos={filteredFaturamentos}
					custos={filteredCustos}
					totalFaturamento={totalFaturamento}
					totalCustos={totalCustos}
					lucroLiquido={lucroLiquido}
					margemLiquida={margemLiquida}
				/>
			)}

			{/* Modais */}
			<FaturamentoModal
				isOpen={isFatModalOpen}
				onClose={() => setIsFatModalOpen(false)}
				onSave={handleSaveFat}
				onDelete={handleDeleteFat}
				editingFaturamento={editingFat}
				defaultLoja={modalDefaultLoja}
				defaultData={modalDefaultData}
			/>

			<FaturamentoDetalhesModal
				isOpen={isFatDetalhesOpen}
				faturamento={selectedFatDetalhes}
				onClose={() => {
					setIsFatDetalhesOpen(false);
					setSelectedFatDetalhes(null);
				}}
				onEdit={(item) => {
					setIsFatDetalhesOpen(false);
					setSelectedFatDetalhes(null);
					setEditingFat(item);
					setModalDefaultLoja(item.lojaId);
					setModalDefaultData(item.data);
					setIsFatModalOpen(true);
				}}
				onDelete={(id) => {
					setIsFatDetalhesOpen(false);
					setSelectedFatDetalhes(null);
					handleDeleteFat(id);
				}}
			/>

			<CustoModal
				isOpen={isCustoModalOpen}
				onClose={() => setIsCustoModalOpen(false)}
				onSave={handleSaveCusto}
				onDelete={handleDeleteCusto}
				editingCusto={editingCusto}
				defaultCategoria={defaultCategoriaCusto}
				defaultLoja={modalDefaultLoja}
				defaultData={modalDefaultData}
			/>
		</div>
	);
}
