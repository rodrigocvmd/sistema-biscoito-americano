"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Plus,
	Store,
	DollarSign,
	Receipt,
	ArrowUpRight,
	ArrowDownRight,
	Sparkles,
	X,
	Edit2,
	Trash2,
	CheckCircle2,
	TrendingUp,
	TrendingDown,
	Percent,
} from "lucide-react";
import {
	CustoFinanceiro,
	FaturamentoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	PeriodoModo,
} from "@/types/financeiro-controle";

interface ControleCalendarioCustosProps {
	custos: CustoFinanceiro[];
	faturamentos: FaturamentoFinanceiro[];
	currentMesAno: string; // "YYYY-MM"
	currentLoja: string; // "todas" | StoreIdWithGeral
	periodMode?: PeriodoModo;
	totalFaturamento?: number;
	totalCustos?: number;
	lucroLiquido?: number;
	margemLiquida?: number;
	percentCustoSobreFat?: number;
	faturamentosCount?: number;
	custosCount?: number;
	onNovoFaturamento?: () => void;
	onNovoCusto?: (categoria?: CategoriaCusto) => void;
	onChangePeriodMode?: (mode: PeriodoModo) => void;
	onSelectDiaParaCusto: (
		diaIso: string,
		loja: StoreIdWithGeral,
		categoria?: CategoriaCusto
	) => void;
	onSelectDiaParaFaturamento: (
		diaIso: string,
		loja: StoreIdWithGeral
	) => void;
	onEditCusto?: (custo: CustoFinanceiro) => void;
	onDeleteCusto?: (id: string) => void;
	onEditFaturamento?: (faturamento: FaturamentoFinanceiro) => void;
	onDeleteFaturamento?: (id: string) => void;
	onChangeMesAno?: (mesAno: string) => void;
	onChangeLoja?: (loja: string) => void;
}

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

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_EXTENSO = [
	"Domingo",
	"Segunda-feira",
	"Terça-feira",
	"Quarta-feira",
	"Quinta-feira",
	"Sexta-feira",
	"Sábado",
];

const CATEGORIAS_ORDEM: CategoriaCusto[] = [
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
];

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
		maximumFractionDigits: 2,
	}).format(val || 0);
};

const formatCellCurrency = (val: number) => {
	if (!val || val === 0) return "-";
	if (val >= 100000) {
		return `R$ ${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
	}
	if (val >= 10000) {
		return `R$ ${(val / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
	}
	return `R$ ${Math.round(val).toLocaleString("pt-BR")}`;
};

export default function ControleCalendarioCustos({
	custos,
	faturamentos,
	currentMesAno,
	currentLoja,
	periodMode = "mes",
	totalFaturamento,
	totalCustos,
	lucroLiquido,
	margemLiquida,
	percentCustoSobreFat,
	faturamentosCount,
	custosCount,
	onNovoFaturamento,
	onNovoCusto,
	onChangePeriodMode,
	onSelectDiaParaCusto,
	onSelectDiaParaFaturamento,
	onEditCusto,
	onDeleteCusto,
	onEditFaturamento,
	onDeleteFaturamento,
	onChangeMesAno,
	onChangeLoja,
}: ControleCalendarioCustosProps) {
	// Filtros internos sincronizados
	const [localMesAno, setLocalMesAno] = useState(currentMesAno);
	const [localLoja, setLocalLoja] = useState(currentLoja);

	useEffect(() => {
		setLocalMesAno(currentMesAno);
	}, [currentMesAno]);

	useEffect(() => {
		setLocalLoja(currentLoja);
	}, [currentLoja]);

	const handleSetMesAno = (newStr: string) => {
		setLocalMesAno(newStr);
		onChangeMesAno?.(newStr);
	};

	const handleSetLoja = (newLoja: string) => {
		setLocalLoja(newLoja);
		onChangeLoja?.(newLoja);
	};

	// Ano e Mês
	const [ano, mes] = useMemo(() => {
		const parts = localMesAno.split("-");
		return [parseInt(parts[0], 10) || 2026, parseInt(parts[1], 10) || 1];
	}, [localMesAno]);

	// Navegação de Mês
	const handlePrevMonth = () => {
		let newMes = mes - 1;
		let newAno = ano;
		if (newMes < 1) {
			newMes = 12;
			newAno -= 1;
		}
		handleSetMesAno(`${newAno}-${String(newMes).padStart(2, "0")}`);
	};

	const handleNextMonth = () => {
		let newMes = mes + 1;
		let newAno = ano;
		if (newMes > 12) {
			newMes = 1;
			newAno += 1;
		}
		handleSetMesAno(`${newAno}-${String(newMes).padStart(2, "0")}`);
	};

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;
	const maxMonthForAno = Math.max(1, currentMonth - 1);

	// Dias no mês selecionado
	const daysInMonth = useMemo(() => {
		return new Date(ano, mes, 0).getDate();
	}, [ano, mes]);

	const daysArray = useMemo(() => {
		const arr: number[] = [];
		for (let d = 1; d <= daysInMonth; d++) {
			arr.push(d);
		}
		return arr;
	}, [daysInMonth]);

	// Dia atual (Hoje)
	const todayIso = useMemo(() => {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	}, []);

	// Referência do scroll da tabela
	const tableContainerRef = useRef<HTMLDivElement>(null);
	const todayColRef = useRef<HTMLTableCellElement>(null);

	// Estado para hover cruzado (linha e coluna)
	const [hoveredCell, setHoveredCell] = useState<{
		rowKey: string | null;
		colDay: number | null;
	}>({ rowKey: null, colDay: null });

	// Auto-scroll suave com mouse nas bordas esquerda/direita da tabela
	const scrollAnimationRef = useRef<number | null>(null);

	const stopEdgeScroll = () => {
		if (scrollAnimationRef.current !== null) {
			cancelAnimationFrame(scrollAnimationRef.current);
			scrollAnimationRef.current = null;
		}
	};

	const handleTableMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		const container = tableContainerRef.current;
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const containerWidth = rect.width;

		// Zona de ativação de 90px nas extremidades com aceleração suave
		const EDGE_ZONE = 90;
		let speed = 0;

		if (mouseX < EDGE_ZONE && mouseX >= 0) {
			// Mais perto da borda esquerda = scroll mais rápido (até -24px por frame)
			const intensity = 1 - mouseX / EDGE_ZONE;
			speed = -Math.max(4, intensity * 24);
		} else if (mouseX > containerWidth - EDGE_ZONE && mouseX <= containerWidth) {
			// Mais perto da borda direita = scroll mais rápido (até +24px por frame)
			const intensity = 1 - (containerWidth - mouseX) / EDGE_ZONE;
			speed = Math.max(4, intensity * 24);
		}

		if (speed !== 0) {
			stopEdgeScroll();
			const step = () => {
				if (tableContainerRef.current) {
					tableContainerRef.current.scrollLeft += speed;
					scrollAnimationRef.current = requestAnimationFrame(step);
				}
			};
			scrollAnimationRef.current = requestAnimationFrame(step);
		} else {
			stopEdgeScroll();
		}
	};

	useEffect(() => {
		return () => {
			stopEdgeScroll();
		};
	}, []);

	const scrollToToday = () => {
		if (todayColRef.current && tableContainerRef.current) {
			const colLeft = todayColRef.current.offsetLeft;
			tableContainerRef.current.scrollTo({
				left: Math.max(0, colLeft - 220),
				behavior: "smooth",
			});
		}
	};

	// 1. Filtragem dos Custos para o Mês e Loja
	const monthCustos = useMemo(() => {
		return custos.filter((c) => {
			if (localLoja !== "todas" && c.lojaId !== localLoja) return false;
			const ref = c.mesReferencia || (c.data ? c.data.slice(0, 7) : "");
			return ref === localMesAno;
		});
	}, [custos, localLoja, localMesAno]);

	// 2. Filtragem dos Faturamentos para o Mês e Loja
	const monthFaturamentos = useMemo(() => {
		return faturamentos.filter((f) => {
			if (localLoja !== "todas" && f.lojaId !== localLoja) return false;
			const ref = f.mesReferencia || (f.data ? f.data.slice(0, 7) : "");
			return ref === localMesAno;
		});
	}, [faturamentos, localLoja, localMesAno]);

	// 3. Matriz de Custos por Categoria e Dia
	// custoMatrix[categoria][day] = { total: number, items: CustoFinanceiro[] }
	const custoMatrix = useMemo(() => {
		const matrix: Record<
			CategoriaCusto,
			Record<number, { total: number; items: CustoFinanceiro[] }>
		> = {} as any;

		CATEGORIAS_ORDEM.forEach((cat) => {
			matrix[cat] = {};
			for (let d = 1; d <= daysInMonth; d++) {
				matrix[cat][d] = { total: 0, items: [] };
			}
		});

		monthCustos.forEach((c) => {
			let dayNum = 1;
			if (c.data && c.data.startsWith(localMesAno)) {
				const dayPart = parseInt(c.data.split("-")[2], 10);
				if (!isNaN(dayPart) && dayPart >= 1 && dayPart <= daysInMonth) {
					dayNum = dayPart;
				}
			}

			const catKey: CategoriaCusto = CATEGORIAS_ORDEM.includes(c.categoria)
				? c.categoria
				: "outros";

			if (matrix[catKey] && matrix[catKey][dayNum]) {
				matrix[catKey][dayNum].total += c.valor || 0;
				matrix[catKey][dayNum].items.push(c);
			}
		});

		return matrix;
	}, [monthCustos, daysInMonth, localMesAno]);

	// 4. Totais por Dia (Custos, Faturamento e Saldo)
	const dailyTotals = useMemo(() => {
		const costs: Record<number, number> = {};
		const fats: Record<number, number> = {};
		const balances: Record<number, number> = {};

		for (let d = 1; d <= daysInMonth; d++) {
			costs[d] = 0;
			fats[d] = 0;
		}

		CATEGORIAS_ORDEM.forEach((cat) => {
			for (let d = 1; d <= daysInMonth; d++) {
				costs[d] += custoMatrix[cat]?.[d]?.total || 0;
			}
		});

		monthFaturamentos.forEach((f) => {
			let dayNum = 1;
			if (f.data && f.data.startsWith(localMesAno)) {
				const dayPart = parseInt(f.data.split("-")[2], 10);
				if (!isNaN(dayPart) && dayPart >= 1 && dayPart <= daysInMonth) {
					dayNum = dayPart;
				}
			}
			fats[dayNum] = (fats[dayNum] || 0) + (f.valorTotal || 0);
		});

		for (let d = 1; d <= daysInMonth; d++) {
			balances[d] = fats[d] - costs[d];
		}

		return { costs, fats, balances };
	}, [daysInMonth, custoMatrix, monthFaturamentos, localMesAno]);

	// 5. Totais do Mês por Categoria
	const categoryMonthTotals = useMemo(() => {
		const totals: Record<CategoriaCusto, number> = {} as any;
		CATEGORIAS_ORDEM.forEach((cat) => {
			let sum = 0;
			for (let d = 1; d <= daysInMonth; d++) {
				sum += custoMatrix[cat]?.[d]?.total || 0;
			}
			totals[cat] = sum;
		});
		return totals;
	}, [custoMatrix, daysInMonth]);

	// 6. Totais Consolidados Gerais do Mês
	const grandTotals = useMemo(() => {
		let totalCost = 0;
		let totalFat = 0;

		for (let d = 1; d <= daysInMonth; d++) {
			totalCost += dailyTotals.costs[d] || 0;
			totalFat += dailyTotals.fats[d] || 0;
		}

		return {
			custos: totalCost,
			faturamento: totalFat,
			saldo: totalFat - totalCost,
		};
	}, [dailyTotals, daysInMonth]);

	// Modal de Lançamento / Detalhes de um Dia Específico
	const [selectedDayInfo, setSelectedDayInfo] = useState<{
		dayNum: number;
		diaIso: string;
		categoriaPre?: CategoriaCusto;
	} | null>(null);

	// Modal de Escolha entre Editar Custo Existente ou Inserir Novo Custo
	const [custoChoiceModal, setCustoChoiceModal] = useState<{
		item: CustoFinanceiro;
		diaIso: string;
		loja: StoreIdWithGeral;
		categoria: CategoriaCusto;
		diaNum: number;
	} | null>(null);

	const handleOpenDayModal = (dayNum: number, cat?: CategoriaCusto) => {
		const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
		setSelectedDayInfo({
			dayNum,
			diaIso,
			categoriaPre: cat,
		});
	};

	const handleCellCustoClick = (d: number, catKey: CategoriaCusto) => {
		const cellData = custoMatrix[catKey]?.[d];
		const items = cellData?.items || [];
		const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		const targetLoja: StoreIdWithGeral =
			localLoja === "todas" ? "geral" : (localLoja as StoreIdWithGeral);

		if (items.length === 1 && onEditCusto) {
			// Se já existe custo cadastrado, abre opção para escolher entre editar ou inserir novo custo
			setCustoChoiceModal({
				item: items[0],
				diaIso,
				loja: targetLoja,
				categoria: catKey,
				diaNum: d,
			});
		} else if (items.length > 1) {
			// Se houver múltiplos custos nesta mesma categoria/dia, abre o modal do dia pré-filtrando a categoria
			handleOpenDayModal(d, catKey);
		} else {
			// Se não houver nenhum, abre diretamente o modal de lançamento de custo para esta categoria e dia
			onSelectDiaParaCusto(diaIso, targetLoja, catKey);
		}
	};

	const handleCellFaturamentoClick = (d: number) => {
		const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		const targetLoja: StoreIdWithGeral =
			localLoja === "todas" ? "geral" : (localLoja as StoreIdWithGeral);

		const dayFats = monthFaturamentos.filter((f) => {
			if (f.data) return f.data === diaIso;
			return d === 1;
		});

		if (dayFats.length === 1 && onEditFaturamento) {
			// Se já existe 1 faturamento, abre detalhes/edição dele
			onEditFaturamento(dayFats[0]);
		} else if (dayFats.length > 1) {
			// Se houver mais de 1, abre o modal do dia para o usuário escolher
			handleOpenDayModal(d);
		} else {
			// Se não houver, abre diretamente o modal de novo faturamento para o dia
			onSelectDiaParaFaturamento(diaIso, targetLoja);
		}
	};

	// Itens do dia selecionado
	const selectedDayCustos = useMemo(() => {
		if (!selectedDayInfo) return [];
		return monthCustos.filter((c) => {
			if (c.data) return c.data === selectedDayInfo.diaIso;
			return selectedDayInfo.dayNum === 1;
		});
	}, [selectedDayInfo, monthCustos]);

	const selectedDayFats = useMemo(() => {
		if (!selectedDayInfo) return [];
		return monthFaturamentos.filter((f) => {
			if (f.data) return f.data === selectedDayInfo.diaIso;
			return selectedDayInfo.dayNum === 1;
		});
	}, [selectedDayInfo, monthFaturamentos]);

	// Valores agregados para os KPIs executivos (com fallback para os totais calculados no calendário)
	const displayFaturamento = totalFaturamento ?? grandTotals.faturamento;
	const displayCustos = totalCustos ?? grandTotals.custos;
	const displayLucro = lucroLiquido ?? (displayFaturamento - displayCustos);
	const displayMargem = margemLiquida ?? (displayFaturamento > 0 ? (displayLucro / displayFaturamento) * 100 : 0);
	const displayPercentCusto = percentCustoSobreFat ?? (displayFaturamento > 0 ? (displayCustos / displayFaturamento) * 100 : 0);
	const displayFatCount = faturamentosCount ?? monthFaturamentos.length;
	const displayCustoCount = custosCount ?? monthCustos.length;

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 transition-colors">
			{/* Cabeçalho do Calendário / Tabela */}
			<div className="flex flex-col gap-5 pb-5 border-b border-slate-100 dark:border-slate-800">
				{/* Topo: Título à esquerda e Botões de Lançamento no topo direito */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center gap-2.5">
						<span className="p-2.5 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 shadow-xs">
							<CalendarIcon size={20} />
						</span>
						<div>
							<h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
								Custos Diários por Categoria
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
								Calendário analítico de despesas por dia do mês com somatório e lançamentos rápidos
							</p>
						</div>
					</div>

					{/* Botões de Ação Rápida no Topo Direito (em cima da data) */}
					<div className="flex items-center gap-2.5 flex-wrap">
						{onNovoFaturamento && (
							<button
								type="button"
								onClick={onNovoFaturamento}
								className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black tracking-wide shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer">
								<Plus size={16} />
								<span>Novo Faturamento</span>
							</button>
						)}

						{onNovoCusto && (
							<button
								type="button"
								onClick={() => onNovoCusto()}
								className="px-4 py-2.5 rounded-2xl bg-orange-300 hover:bg-orange-400 dark:bg-orange-400 dark:hover:bg-orange-300 text-orange-950 text-xs font-black tracking-wide shadow-md shadow-orange-300/30 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer">
								<Plus size={16} />
								<span>Novo Custo</span>
							</button>
						)}
					</div>
				</div>

				{/* Controles de Filtro: Abas de Troca de Loja, Nome no Centro e Seletor de Período/Data */}
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
					{/* Abas de Seleção de Loja */}
					<div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto scrollbar-none shadow-xs shrink-0">
						<button
							type="button"
							onClick={() => handleSetLoja("todas")}
							className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
								localLoja === "todas"
									? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
									: "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60"
							}`}>
							<Store size={15} />
							<span>Consolidado</span>
						</button>
						{(["lago", "terraco", "conjunto", "noroeste"] as const).map((sId) => (
							<button
								key={sId}
								type="button"
								onClick={() => handleSetLoja(sId)}
								className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
									localLoja === sId
										? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
										: "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60"
								}`}>
								<span>{STORE_NAMES_EXTENDED[sId]}</span>
							</button>
						))}
					</div>

					{/* No centro e no topo, entre a seleção da loja e a seleção do mês: nome da loja (ou consolidado) selecionada como uma string simples, mas grande */}
					<div className="flex-1 flex justify-center items-center py-1">
						<span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight text-center">
							{localLoja === "todas"
								? "Consolidado"
								: STORE_NAMES_EXTENDED[localLoja as StoreIdWithGeral] || localLoja}
						</span>
					</div>

					{/* Controles de Período: Seletor Mês Específico / Ano Todo e Data */}
					<div className="flex items-center gap-2 flex-wrap shrink-0 justify-end">
						{/* Seletor de Modo: Mês Específico vs Ano Todo */}
						<div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold shadow-xs">
							<button
								type="button"
								onClick={() => onChangePeriodMode?.("mes")}
								className={`px-3 py-1.5 rounded-xl transition-all ${
									periodMode === "mes"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								Mês Específico
							</button>
							<button
								type="button"
								onClick={() => onChangePeriodMode?.("ano")}
								className={`px-3 py-1.5 rounded-xl transition-all ${
									periodMode === "ano"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								Ano Todo
							</button>
						</div>

						{/* Navegador e Seleção: Mês Específico */}
						{periodMode === "mes" && (
							<div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
								<button
									type="button"
									onClick={handlePrevMonth}
									title="Mês Anterior"
									className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-95">
									<ChevronLeft size={18} />
								</button>

								<select
									value={mes}
									aria-label="Selecionar mês da tabela"
									onChange={(e) => {
										const newMes = parseInt(e.target.value, 10);
										handleSetMesAno(`${ano}-${String(newMes).padStart(2, "0")}`);
									}}
									className="bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 border-none outline-hidden cursor-pointer px-2 py-1 hover:text-blue-600 transition-colors">
									{MESES.map((nome, idx) => (
										<option key={idx + 1} value={idx + 1} className="dark:bg-slate-900">
											{nome}
										</option>
									))}
								</select>

								<span className="text-slate-400 font-bold text-sm">/</span>

								<select
									value={ano}
									aria-label="Selecionar ano da tabela"
									onChange={(e) => {
										const newAno = parseInt(e.target.value, 10);
										handleSetMesAno(`${newAno}-${String(mes).padStart(2, "0")}`);
									}}
									className="bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 border-none outline-hidden cursor-pointer px-2 py-1 hover:text-blue-600 transition-colors">
									{[2024, 2025, 2026, 2027, 2028].map((y) => (
										<option key={y} value={y} className="dark:bg-slate-900">
											{y}
										</option>
									))}
								</select>

								<button
									type="button"
									onClick={handleNextMonth}
									title="Próximo Mês"
									className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-95">
									<ChevronRight size={18} />
								</button>
							</div>
						)}

						{/* Navegador e Indicador: Ano Todo */}
						{periodMode === "ano" && (
							<div className="flex items-center gap-2">
								<div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
									<button
										type="button"
										onClick={() => handleSetMesAno(`${ano - 1}-${String(mes).padStart(2, "0")}`)}
										title="Ano Anterior"
										className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-95">
										<ChevronLeft size={18} />
									</button>

									<select
										value={ano}
										aria-label="Selecionar ano da tabela"
										onChange={(e) => {
											const newAno = parseInt(e.target.value, 10);
											handleSetMesAno(`${newAno}-${String(mes).padStart(2, "0")}`);
										}}
										className="bg-transparent text-sm font-black text-slate-900 dark:text-slate-100 border-none outline-hidden cursor-pointer px-2 py-1 hover:text-blue-600 transition-colors">
										{[2024, 2025, 2026, 2027, 2028].map((y) => (
											<option key={y} value={y} className="dark:bg-slate-900">
												{y}
											</option>
										))}
									</select>

									<button
										type="button"
										onClick={() => handleSetMesAno(`${ano + 1}-${String(mes).padStart(2, "0")}`)}
										title="Próximo Ano"
										className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-95">
										<ChevronRight size={18} />
									</button>
								</div>

								{/* Indicador do período anual coberto */}
								<div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-900/50">
									<span>
										{ano === currentYear
											? `Jan a ${MESES[maxMonthForAno - 1] || "Jan"}`
											: `Jan a Dez`}
									</span>
									{ano === currentYear && (
										<span className="text-[10px] text-blue-500 dark:text-blue-400 font-normal hidden sm:inline">
											(até mês anterior)
										</span>
									)}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* KPI Cards: Substituem os antigos cards de resumo - Faturamento Bruto, Custos & Despesas, Resultado Líquido */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{/* 1. Faturamento Total */}
				<div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Faturamento Bruto
						</span>
						<span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
							<TrendingUp size={16} />
						</span>
					</div>
					<div>
						<h4 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
							{formatCurrency(displayFaturamento)}
						</h4>
						<div className="flex items-center gap-2 mt-1">
							<span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
								<ArrowUpRight size={12} /> {displayFatCount} registros
							</span>
							<span className="text-[11px] text-slate-400">no período</span>
						</div>
					</div>
				</div>

				{/* 2. Custos Totais */}
				<div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Custos & Despesas
						</span>
						<span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
							<TrendingDown size={16} />
						</span>
					</div>
					<div>
						<h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
							{formatCurrency(displayCustos)}
						</h4>
						<div className="flex items-center gap-2 mt-1">
							<span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
								{displayPercentCusto.toFixed(1)}% do faturamento
							</span>
							<span className="text-[11px] text-slate-400">({displayCustoCount} lançamentos)</span>
						</div>
					</div>
				</div>

				{/* 3. Lucro Líquido Operacional */}
				<div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Resultado Líquido
						</span>
						<span
							className={`p-2 rounded-xl ${
								displayLucro >= 0
									? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
									: "bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400"
							}`}>
							<Percent size={16} />
						</span>
					</div>
					<div>
						<h4
							className={`text-2xl font-black tracking-tight ${
								displayLucro >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
							}`}>
							{formatCurrency(displayLucro)}
						</h4>
						<div className="flex items-center gap-2 mt-1">
							<span
								className={`inline-flex items-center gap-0.5 text-[11px] font-black ${
									displayLucro >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
								}`}>
								Margem: {displayMargem.toFixed(1)}%
							</span>
							<span className="text-[11px] text-slate-400">
								{displayLucro >= 0 ? "Operação Superavitária" : "Déficit no Período"}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* TABELA / CALENDÁRIO: DIAS POR COLUNA & TIPOS DE CUSTO POR LINHA */}
			<div
				ref={tableContainerRef}
				onMouseMove={handleTableMouseMove}
				onMouseLeave={() => {
					stopEdgeScroll();
					setHoveredCell({ rowKey: null, colDay: null });
				}}
				className="relative overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[640px] overflow-y-auto select-none shadow-xs">
				<table className="w-full text-left border-collapse text-xs">
					{/* Cabeçalho da Tabela */}
					<thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
						<tr>
							{/* Coluna 1 Fixa: Tipo de Custo */}
							<th
								onMouseEnter={() => setHoveredCell((prev) => ({ ...prev, colDay: null }))}
								className={`sticky left-0 top-0 z-40 border-r border-b border-slate-200 dark:border-slate-800 min-w-[150px] sm:min-w-[180px] max-w-[150px] sm:max-w-[180px] p-3 text-sm font-black shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] transition-colors duration-150 ${
									hoveredCell.rowKey !== null
										? "bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-50 ring-1 ring-inset ring-blue-400/50"
										: "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
								}`}>
								<span>Tipo de Custo</span>
							</th>

							{/* Colunas dos Dias do Mês */}
							{daysArray.map((d) => {
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;
								const dayOfWeek = new Date(ano, mes - 1, d).getDay();
								const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
								const isColHovered = hoveredCell.colDay === d;

								return (
									<th
										key={d}
										ref={isToday ? todayColRef : undefined}
										onClick={() => handleOpenDayModal(d)}
										onMouseEnter={() => setHoveredCell((prev) => ({ ...prev, colDay: d }))}
										title={`Clique para lançar no Dia ${String(d).padStart(2, "0")}/${String(mes).padStart(2, "0")}`}
										className={`border-r border-b border-slate-200 dark:border-slate-700/80 min-w-[70px] w-[70px] sm:min-w-[76px] sm:w-[76px] p-2 text-center cursor-pointer group transition-all duration-150 ${
											isColHovered
												? "bg-blue-200/70 dark:bg-blue-900/60 ring-2 ring-inset ring-blue-400/50 text-blue-950 dark:text-blue-50"
												: isToday
												? "bg-blue-100/70 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 font-black"
												: isWeekend
												? "bg-slate-100/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
												: "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300"
										} hover:bg-blue-100 dark:hover:bg-blue-900/50`}>
										<div className="flex flex-col items-center justify-center">
											<span className={`text-[10px] uppercase font-bold transition-colors ${
												isColHovered ? "text-blue-700 dark:text-blue-300" : "text-slate-400 group-hover:text-blue-600"
											}`}>
												{DIAS_SEMANA_ABREV[dayOfWeek]}
											</span>
											<span
												className={`text-sm font-black px-1.5 py-0.5 rounded-lg transition-all ${
													isToday
														? "bg-blue-600 text-white shadow-xs"
														: isColHovered
														? "text-blue-800 dark:text-blue-200 scale-105"
														: "group-hover:text-blue-600"
												}`}>
												{String(d).padStart(2, "0")}
											</span>
											<span className="text-[9px] font-black text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex items-center gap-0.5">
												<Plus size={10} /> Lançar
											</span>
										</div>
									</th>
								);
							})}

							{/* Coluna Fixa à Direita: Total Mês */}
							<th className="sticky right-0 top-0 z-40 bg-slate-100 dark:bg-slate-900 border-l border-b border-slate-200 dark:border-slate-800 min-w-[100px] sm:min-w-[110px] p-3 text-right text-sm font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100">
								Total Mês
							</th>
						</tr>
					</thead>

					{/* Corpo da Tabela: Linhas dos Tipos de Custo */}
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
						{CATEGORIAS_ORDEM.map((catKey) => {
							const cfg = CATEGORIAS_CUSTO_CONFIG[catKey];
							const catMonthTotal = categoryMonthTotals[catKey] || 0;
							const isRowHovered = hoveredCell.rowKey === catKey;

							return (
								<tr
									key={catKey}
									className={`transition-colors duration-150 ${
										isRowHovered
											? "bg-blue-50/50 dark:bg-blue-950/25"
											: "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
									}`}>
									{/* Coluna 1 Fixa: Nome da Categoria */}
									<td
										onMouseEnter={() => setHoveredCell({ rowKey: catKey, colDay: null })}
										className={`sticky left-0 z-20 border-r border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.04)] transition-colors duration-150 ${
											isRowHovered
												? "bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-50 ring-1 ring-inset ring-blue-400/50"
												: "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
										}`}>
										<span className="font-black text-sm text-slate-900 dark:text-slate-100 truncate block">
											{cfg.label}
										</span>
									</td>

									{/* Colunas dos Dias do Mês */}
									{daysArray.map((d) => {
										const cellData = custoMatrix[catKey]?.[d];
										const val = cellData?.total || 0;
										const itemCount = cellData?.items?.length || 0;
										const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
										const isToday = diaIso === todayIso;
										const isColHovered = hoveredCell.colDay === d;
										const isIntersected = isRowHovered && isColHovered;

										return (
											<td
												key={d}
												onClick={() => handleCellCustoClick(d, catKey)}
												onMouseEnter={() => setHoveredCell({ rowKey: catKey, colDay: d })}
												title={`${cfg.label} no Dia ${String(d).padStart(2, "0")}: ${
													val > 0 ? formatCurrency(val) : "Nenhum custo"
												} (Clique para lançar ou editar custo)`}
												className={`border-r border-slate-100 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-all duration-150 ${
													isIntersected
														? "bg-blue-200/90 dark:bg-blue-900/80 ring-2 ring-inset ring-blue-500 scale-[1.03] shadow-xs z-10"
														: isRowHovered || isColHovered
														? "bg-blue-100/60 dark:bg-blue-950/45"
														: isToday
														? "bg-blue-50/30 dark:bg-blue-950/20"
														: ""
												} hover:bg-blue-200/80 dark:hover:bg-blue-900/70 active:scale-95`}>
												{val > 0 ? (
													<div className="flex flex-col items-center justify-center">
														<span className="font-black text-slate-900 dark:text-slate-100 text-xs leading-tight">
															{formatCellCurrency(val)}
														</span>
														{itemCount > 1 && (
															<span className="text-[10px] text-slate-400 leading-none mt-0.5">
																{itemCount}x
															</span>
														)}
													</div>
												) : (
													<span className="text-slate-300 dark:text-slate-700 font-light hover:text-blue-500">
														-
													</span>
												)}
											</td>
										);
									})}

									{/* Coluna Fixa à Direita: Total da Categoria no Mês */}
									<td
										className={`sticky right-0 z-20 border-l border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.04)] text-slate-900 dark:text-slate-100 text-xs sm:text-sm transition-colors duration-150 ${
											isRowHovered
												? "bg-blue-200 dark:bg-blue-900"
												: "bg-white dark:bg-slate-900"
										}`}>
										{catMonthTotal > 0 ? formatCurrency(catMonthTotal) : "-"}
									</td>
								</tr>
							);
						})}
					</tbody>

					{/* Rodapé da Tabela: Linhas de Somatório Diário */}
					<tfoot className="sticky bottom-0 z-30 border-t-2 border-slate-200 dark:border-slate-800">
						{/* Linha 1: Total de Custos do Dia */}
						<tr
							className={`font-black transition-colors duration-150 ${
								hoveredCell.rowKey === "total_custos"
									? "bg-blue-100/70 dark:bg-blue-950/60"
									: "bg-slate-50 dark:bg-slate-900"
							}`}>
							<td
								onMouseEnter={() => setHoveredCell({ rowKey: "total_custos", colDay: null })}
								className={`sticky left-0 z-40 border-r border-b border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100 text-sm font-black transition-colors duration-150 ${
									hoveredCell.rowKey === "total_custos"
										? "bg-blue-200 dark:bg-blue-900 ring-1 ring-inset ring-blue-400/50 text-blue-950 dark:text-blue-50"
										: "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
								}`}>
								<div className="flex items-center gap-1.5">
									<Receipt size={14} className="text-rose-500 shrink-0" />
									<span>Total Custos</span>
								</div>
							</td>

							{daysArray.map((d) => {
								const val = dailyTotals.costs[d] || 0;
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;
								const isColHovered = hoveredCell.colDay === d;
								const isRowHovered = hoveredCell.rowKey === "total_custos";
								const isIntersected = isRowHovered && isColHovered;

								return (
									<td
										key={d}
										onClick={() => handleOpenDayModal(d)}
										onMouseEnter={() => setHoveredCell({ rowKey: "total_custos", colDay: d })}
										title={`Total de custos no Dia ${d}: ${formatCurrency(val)}`}
										className={`border-r border-b border-slate-200/80 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-colors duration-150 ${
											isIntersected
												? "bg-blue-300/90 dark:bg-blue-800/90 ring-2 ring-inset ring-blue-500 scale-[1.03]"
												: isRowHovered || isColHovered
												? "bg-blue-200/80 dark:bg-blue-900/70"
												: isToday
												? "bg-blue-50/80 dark:bg-blue-950/40"
												: val > 0
												? "bg-rose-50/40 dark:bg-rose-950/20"
												: "bg-slate-50/40 dark:bg-slate-900/40"
										} hover:bg-rose-100/60 dark:hover:bg-rose-900/30`}>
										<span
											className={`text-xs font-black ${
												val > 0
													? "text-slate-900 dark:text-slate-100"
													: "text-slate-300 dark:text-slate-600 font-normal"
											}`}>
											{formatCellCurrency(val)}
										</span>
									</td>
								);
							})}

							<td className={`sticky right-0 z-40 border-l border-b border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100 text-xs sm:text-sm transition-colors duration-150 ${
								hoveredCell.rowKey === "total_custos"
									? "bg-blue-200 dark:bg-blue-900"
									: "bg-slate-100 dark:bg-slate-900"
							}`}>
								{formatCurrency(grandTotals.custos)}
							</td>
						</tr>

						{/* Linha 2: Faturamento do Dia */}
						<tr
							className={`font-black transition-colors duration-150 ${
								hoveredCell.rowKey === "faturamento"
									? "bg-blue-100/70 dark:bg-blue-950/60"
									: "bg-slate-50 dark:bg-slate-900"
							}`}>
							<td
								onMouseEnter={() => setHoveredCell({ rowKey: "faturamento", colDay: null })}
								className={`sticky left-0 z-40 border-r border-b border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100 text-sm font-black transition-colors duration-150 ${
									hoveredCell.rowKey === "faturamento"
										? "bg-blue-200 dark:bg-blue-900 ring-1 ring-inset ring-blue-400/50 text-blue-950 dark:text-blue-50"
										: "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
								}`}>
								<div className="flex items-center gap-1.5">
									<DollarSign size={14} className="text-emerald-500 shrink-0" />
									<span>Faturamento</span>
								</div>
							</td>

							{daysArray.map((d) => {
								const val = dailyTotals.fats[d] || 0;
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;
								const isColHovered = hoveredCell.colDay === d;
								const isRowHovered = hoveredCell.rowKey === "faturamento";
								const isIntersected = isRowHovered && isColHovered;

								return (
									<td
										key={d}
										onClick={() => handleCellFaturamentoClick(d)}
										onMouseEnter={() => setHoveredCell({ rowKey: "faturamento", colDay: d })}
										title={`Faturamento no Dia ${d}: ${formatCurrency(val)} (Clique para abrir faturamento)`}
										className={`border-r border-b border-slate-200/80 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-colors duration-150 ${
											isIntersected
												? "bg-blue-300/90 dark:bg-blue-800/90 ring-2 ring-inset ring-blue-500 scale-[1.03]"
												: isRowHovered || isColHovered
												? "bg-blue-200/80 dark:bg-blue-900/70"
												: isToday
												? "bg-blue-50/80 dark:bg-blue-950/40"
												: val > 0
												? "bg-emerald-50/40 dark:bg-emerald-950/20"
												: "bg-slate-50/40 dark:bg-slate-900/40"
										} hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30`}>
										<span
											className={`text-xs font-black ${
												val > 0
													? "text-emerald-600 dark:text-emerald-400"
													: "text-slate-300 dark:text-slate-600 font-normal"
											}`}>
											{formatCellCurrency(val)}
										</span>
									</td>
								);
							})}

							<td className={`sticky right-0 z-40 border-l border-b border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm transition-colors duration-150 ${
								hoveredCell.rowKey === "faturamento"
									? "bg-blue-200 dark:bg-blue-900"
									: "bg-slate-100 dark:bg-slate-900"
							}`}>
								{formatCurrency(grandTotals.faturamento)}
							</td>
						</tr>

						{/* Linha 3: Saldo Diário (Líquido) */}
						<tr
							className={`font-black transition-colors duration-150 ${
								hoveredCell.rowKey === "saldo_diario"
									? "bg-blue-100/70 dark:bg-blue-950/60"
									: "bg-slate-100 dark:bg-slate-900"
							}`}>
							<td
								onMouseEnter={() => setHoveredCell({ rowKey: "saldo_diario", colDay: null })}
								className={`sticky left-0 z-40 border-r border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100 text-sm font-black transition-colors duration-150 ${
									hoveredCell.rowKey === "saldo_diario"
										? "bg-blue-200 dark:bg-blue-900 ring-1 ring-inset ring-blue-400/50 text-blue-950 dark:text-blue-50"
										: "bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
								}`}>
								<div className="flex items-center gap-1.5">
									<TrendingUp size={14} className="text-blue-500 shrink-0" />
									<span>Saldo Diário</span>
								</div>
							</td>

							{daysArray.map((d) => {
								const val = dailyTotals.balances[d] || 0;
								const hasMov =
									(dailyTotals.fats[d] || 0) > 0 || (dailyTotals.costs[d] || 0) > 0;
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;
								const isColHovered = hoveredCell.colDay === d;
								const isRowHovered = hoveredCell.rowKey === "saldo_diario";
								const isIntersected = isRowHovered && isColHovered;

								return (
									<td
										key={d}
										onClick={() => handleOpenDayModal(d)}
										onMouseEnter={() => setHoveredCell({ rowKey: "saldo_diario", colDay: d })}
										title={`Saldo no Dia ${d}: ${formatCurrency(val)}`}
										className={`border-r border-slate-200/80 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-colors duration-150 ${
											isIntersected
												? "bg-blue-300/90 dark:bg-blue-800/90 ring-2 ring-inset ring-blue-500 scale-[1.03]"
												: isRowHovered || isColHovered
												? "bg-blue-200/80 dark:bg-blue-900/70"
												: isToday
												? "bg-blue-100/70 dark:bg-blue-950/50"
												: hasMov
												? val >= 0
													? "bg-blue-50/40 dark:bg-blue-950/20"
													: "bg-red-50/40 dark:bg-red-950/20"
												: "bg-slate-100/40 dark:bg-slate-900/40"
										} hover:bg-blue-100/50 dark:hover:bg-blue-900/30`}>
										{hasMov ? (
											<span
												className={`text-xs font-black ${
													val >= 0
														? "text-blue-600 dark:text-blue-400"
														: "text-red-600 dark:text-red-400"
												}`}>
												{formatCellCurrency(val)}
											</span>
										) : (
											<span className="text-slate-300 dark:text-slate-600 font-normal">
												-
											</span>
										)}
									</td>
								);
							})}

							<td
								className={`sticky right-0 z-40 border-l border-slate-200 dark:border-slate-800 p-2.5 text-right font-black text-xs sm:text-sm shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] transition-colors duration-150 ${
									hoveredCell.rowKey === "saldo_diario"
										? "bg-blue-200 dark:bg-blue-900"
										: "bg-slate-100 dark:bg-slate-900"
								} ${
									grandTotals.saldo >= 0
										? "text-blue-600 dark:text-blue-400"
										: "text-red-600 dark:text-red-400"
								}`}>
								{formatCurrency(grandTotals.saldo)}
							</td>
						</tr>
					</tfoot>
				</table>
			</div>

			{/* MODAL / POPOVER DE AÇÃO NO DIA CLICADO */}
			{selectedDayInfo && (
				<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
						{/* Header do Dia */}
						<div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
							<div className="flex items-center gap-2.5">
								<span className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
									<CalendarIcon size={20} />
								</span>
								<div>
									<h3 className="text-base font-black text-slate-900 dark:text-slate-100">
										Dia {String(selectedDayInfo.dayNum).padStart(2, "0")} de{" "}
										{MESES[mes - 1]} de {ano}
									</h3>
									<div className="flex items-center gap-2 mt-0.5">
										<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
											{DIAS_SEMANA_EXTENSO[new Date(ano, mes - 1, selectedDayInfo.dayNum).getDay()]}
										</span>
										<span className="text-xs text-slate-300 dark:text-slate-600">•</span>
										<span className="text-xs font-black text-blue-600 dark:text-blue-400">
											{localLoja === "todas"
												? "Consolidado (Todas as Lojas)"
												: STORE_NAMES_EXTENDED[localLoja as StoreIdWithGeral]}
										</span>
									</div>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setSelectedDayInfo(null)}
								className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
								<X size={20} />
							</button>
						</div>

						{/* Corpo com Ações e Registros Existentes */}
						<div className="p-6 space-y-5 overflow-y-auto flex-1">
							{/* Botões de Ação para Adicionar */}
							<div>
								<span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-2.5">
									Lançar para este dia
								</span>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{/* Botão Novo Custo (Laranja Pastel) */}
									<button
										type="button"
										onClick={() => {
											if (!selectedDayInfo) return;
											const targetLoja: StoreIdWithGeral =
												localLoja === "todas" ? "geral" : (localLoja as StoreIdWithGeral);
											onSelectDiaParaCusto(
												selectedDayInfo.diaIso,
												targetLoja,
												selectedDayInfo.categoriaPre
											);
											setSelectedDayInfo(null);
										}}
										className="p-3.5 rounded-2xl bg-orange-300 hover:bg-orange-400 dark:bg-orange-400 dark:hover:bg-orange-300 text-orange-950 font-black text-xs tracking-wide shadow-md shadow-orange-300/30 transition-all flex items-center justify-center gap-2 active:scale-95 text-center">
										<Plus size={16} />
										<span>
											{selectedDayInfo.categoriaPre
												? `Novo Custo (${CATEGORIAS_CUSTO_CONFIG[selectedDayInfo.categoriaPre]?.label})`
												: "Novo Custo"}
										</span>
									</button>

									{/* Botão Novo Faturamento (Esmeralda) */}
									<button
										type="button"
										onClick={() => {
											if (!selectedDayInfo) return;
											const targetLoja: StoreIdWithGeral =
												localLoja === "todas" ? "geral" : (localLoja as StoreIdWithGeral);
											onSelectDiaParaFaturamento(selectedDayInfo.diaIso, targetLoja);
											setSelectedDayInfo(null);
										}}
										className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs tracking-wide shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-center">
										<Plus size={16} />
										<span>Novo Faturamento</span>
									</button>
								</div>
							</div>

							{/* Lista de Custos Registrados no Dia */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
										<Receipt size={14} className="text-rose-500" />
										Custos no Dia ({selectedDayCustos.length})
									</span>
									<span className="text-xs font-black text-rose-600 dark:text-rose-400">
										{formatCurrency(
											selectedDayCustos.reduce((acc, c) => acc + (c.valor || 0), 0)
										)}
									</span>
								</div>

								<div className="space-y-2">
									{selectedDayCustos.map((custo) => {
										const cfg = CATEGORIAS_CUSTO_CONFIG[custo.categoria];
										return (
											<div
												key={custo.id}
												onClick={() => {
													if (onEditCusto) {
														onEditCusto(custo);
														setSelectedDayInfo(null);
													}
												}}
												className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer group">
												<div className="flex items-center gap-2 min-w-0">
													<span
														className="w-2.5 h-2.5 rounded-full shrink-0"
														style={{ backgroundColor: cfg?.color || "#64748b" }}
													/>
													<div className="truncate">
														<p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
															{custo.descricao}
														</p>
														<span className="text-[10px] text-slate-400">
															{cfg?.label} • {STORE_NAMES_EXTENDED[custo.lojaId] || custo.lojaId}
														</span>
													</div>
												</div>
												<div className="flex items-center gap-1.5 shrink-0">
													<span className="text-xs font-black text-slate-900 dark:text-slate-100">
														{formatCurrency(custo.valor)}
													</span>
													<button
														type="button"
														title="Editar custo"
														onClick={(e) => {
															e.stopPropagation();
															if (onEditCusto) {
																onEditCusto(custo);
																setSelectedDayInfo(null);
															}
														}}
														className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
														<Edit2 size={13} />
													</button>
													{onDeleteCusto && (
														<button
															type="button"
															title="Excluir custo"
															onClick={(e) => {
																e.stopPropagation();
																onDeleteCusto(custo.id);
															}}
															className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
															<Trash2 size={13} />
														</button>
													)}
												</div>
											</div>
										);
									})}

									{selectedDayCustos.length === 0 && (
										<p className="text-xs text-slate-400 italic py-2 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
											Nenhum custo registrado neste dia.
										</p>
									)}
								</div>
							</div>

							{/* Lista de Faturamentos Registrados no Dia */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
										<DollarSign size={14} className="text-emerald-500" />
										Faturamentos no Dia ({selectedDayFats.length})
									</span>
									<span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
										{formatCurrency(
											selectedDayFats.reduce((acc, f) => acc + (f.valorTotal || 0), 0)
										)}
									</span>
								</div>

								<div className="space-y-2">
									{selectedDayFats.map((fat) => (
										<div
											key={fat.id}
											onClick={() => {
												if (onEditFaturamento) {
													onEditFaturamento(fat);
													setSelectedDayInfo(null);
												}
											}}
											className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer group">
											<div className="flex items-center gap-2 min-w-0">
												<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
												<div className="truncate">
													<p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
														{fat.descricao || (fat.tipo === "discriminado" ? "Venda Discriminada" : "Faturamento Geral")}
													</p>
													<span className="text-[10px] text-slate-400">
														{STORE_NAMES_EXTENDED[fat.lojaId] || fat.lojaId}
													</span>
												</div>
											</div>
											<div className="flex items-center gap-1.5 shrink-0">
												<span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
													{formatCurrency(fat.valorTotal)}
												</span>
												<button
													type="button"
													title="Editar faturamento"
													onClick={(e) => {
														e.stopPropagation();
														if (onEditFaturamento) {
															onEditFaturamento(fat);
															setSelectedDayInfo(null);
														}
													}}
													className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
													<Edit2 size={13} />
												</button>
												{onDeleteFaturamento && (
													<button
														type="button"
														title="Excluir faturamento"
														onClick={(e) => {
															e.stopPropagation();
															onDeleteFaturamento(fat.id);
														}}
														className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
														<Trash2 size={13} />
													</button>
												)}
											</div>
										</div>
									))}

									{selectedDayFats.length === 0 && (
										<p className="text-xs text-slate-400 italic py-2 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
											Nenhum faturamento registrado neste dia.
										</p>
									)}
								</div>
							</div>
						</div>

						{/* Footer com botão de Fechar */}
						<div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
							<button
								type="button"
								onClick={() => setSelectedDayInfo(null)}
								className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Modal de Escolha: Editar Custo Existente ou Inserir Novo Custo */}
			{custoChoiceModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
						{/* Cabeçalho */}
						<div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span className="p-2.5 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
									<Receipt size={20} />
								</span>
								<div>
									<h4 className="text-base font-black text-slate-900 dark:text-slate-100">
										{CATEGORIAS_CUSTO_CONFIG[custoChoiceModal.categoria]?.label || "Custo"}
									</h4>
									<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
										Dia {custoChoiceModal.diaNum} de {MESES[mes - 1]} de {ano}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setCustoChoiceModal(null)}
								className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
								<X size={18} />
							</button>
						</div>

						{/* Resumo do custo atual */}
						<div className="p-6 space-y-4">
							<div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
								<div className="truncate mr-3">
									<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
										Custo Já Cadastrado
									</span>
									<p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate mt-0.5">
										{custoChoiceModal.item.descricao || "Sem descrição"}
									</p>
									<span className="text-[11px] text-slate-500 dark:text-slate-400">
										Loja: {STORE_NAMES_EXTENDED[custoChoiceModal.item.lojaId] || custoChoiceModal.item.lojaId}
									</span>
								</div>
								<span className="text-sm font-black text-rose-600 dark:text-rose-400 shrink-0">
									{formatCurrency(custoChoiceModal.item.valor)}
								</span>
							</div>

							<p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
								O que deseja fazer com esta célula?
							</p>

							{/* Opções de Ação */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
								{/* Opção 1: Editar o Custo Existente */}
								<button
									type="button"
									onClick={() => {
										const current = custoChoiceModal;
										setCustoChoiceModal(null);
										onEditCusto?.(current.item);
									}}
									className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-900 dark:text-slate-100 font-black text-xs tracking-wide shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
									<Edit2 size={16} className="text-blue-600 dark:text-blue-400" />
									<span>Editar Este Custo</span>
								</button>

								{/* Opção 2: Inserir Novo Custo */}
								<button
									type="button"
									onClick={() => {
										const current = custoChoiceModal;
										setCustoChoiceModal(null);
										onSelectDiaParaCusto(current.diaIso, current.loja, current.categoria);
									}}
									className="p-3.5 rounded-2xl bg-orange-300 hover:bg-orange-400 dark:bg-orange-400 dark:hover:bg-orange-300 text-orange-950 font-black text-xs tracking-wide shadow-md shadow-orange-300/30 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
									<Plus size={16} />
									<span>Inserir Novo Custo</span>
								</button>
							</div>
						</div>

						{/* Rodapé */}
						<div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
							<button
								type="button"
								onClick={() => setCustoChoiceModal(null)}
								className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

