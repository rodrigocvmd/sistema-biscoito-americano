"use client";

import { useState, useMemo, useEffect } from "react";
import {
	BarChart3,
	TrendingUp,
	PieChart,
	Store,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import {
	ChartTipoVisualizacao,
	ChartModoAgrupamento,
	CategoriaCusto,
	StoreIdWithGeral,
	STORE_NAMES_EXTENDED,
	PeriodoModo,
} from "@/types/financeiro-controle";

export interface DataPointMensal {
	mesKey: string; // Ex: "2026-01"
	label: string; // Ex: "Jan"
	nomeMes: string; // Ex: "Janeiro / 2026"
	faturamento: number;
	custos: number;
	lucro: number;
}

export interface DataPointCategoria {
	categoria: CategoriaCusto;
	label: string;
	valor: number;
	percent: number;
	color: string;
}

export interface DataPointLoja {
	lojaId: string;
	nome: string;
	faturamento: number;
	custos: number;
	lucro: number;
}

interface ControleChartProps {
	mensalData: DataPointMensal[];
	categoriaData: DataPointCategoria[];
	lojaData: DataPointLoja[];
	totalFaturamento: number;
	totalCustos: number;
	totalLucro: number;
	isConsolidado?: boolean;
	currentMesAno?: string;
	currentLoja?: string;
	periodMode?: PeriodoModo;
	onChangeMesAno?: (mesAno: string) => void;
	onChangeLoja?: (loja: string) => void;
	onChangePeriodMode?: (mode: PeriodoModo) => void;
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

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
		maximumFractionDigits: 2,
	}).format(val || 0);
};

const formatTickCurrency = (val: number) => {
	if (val === 0) return "R$ 0";
	return `R$ ${val.toLocaleString("pt-BR")}`;
};

const formatElementValue = (val: number) => {
	if (!val || val === 0) return "R$ 0";
	const abs = Math.abs(val);
	if (abs >= 1_000_000) {
		const formatted = (val / 1_000_000).toLocaleString("pt-BR", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 1,
		});
		return `R$ ${formatted}M`;
	}
	if (abs >= 1_000) {
		const formatted = (val / 1_000).toLocaleString("pt-BR", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 1,
		});
		return `R$ ${formatted}k`;
	}
	return `R$ ${Math.round(val).toLocaleString("pt-BR")}`;
};

const STORE_COLORS: Record<string, string> = {
	lago: "#3b82f6",
	terraco: "#10b981",
	conjunto: "#f59e0b",
	noroeste: "#8b5cf6",
	geral: "#64748b",
};

export default function ControleChart({
	mensalData,
	categoriaData,
	lojaData,
	totalFaturamento,
	totalCustos,
	totalLucro,
	isConsolidado = true,
	currentMesAno,
	currentLoja,
	periodMode = "mes",
	onChangeMesAno,
	onChangeLoja,
	onChangePeriodMode,
}: ControleChartProps) {
	// Filtros de Loja e Período sincronizados
	const activeLoja = currentLoja ?? (isConsolidado ? "todas" : "lago");
	const activeMesAno = currentMesAno ?? "2026-01";

	const [ano, mes] = useMemo(() => {
		const parts = activeMesAno.split("-");
		return [parseInt(parts[0], 10) || 2026, parseInt(parts[1], 10) || 1];
	}, [activeMesAno]);

	const handlePrevMonth = () => {
		let newMes = mes - 1;
		let newAno = ano;
		if (newMes < 1) {
			newMes = 12;
			newAno -= 1;
		}
		onChangeMesAno?.(`${newAno}-${String(newMes).padStart(2, "0")}`);
	};

	const handleNextMonth = () => {
		let newMes = mes + 1;
		let newAno = ano;
		if (newMes > 12) {
			newMes = 1;
			newAno += 1;
		}
		onChangeMesAno?.(`${newAno}-${String(newMes).padStart(2, "0")}`);
	};

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;
	const maxMonthForAno = Math.max(1, currentMonth - 1);

	// Padrão: "Por Loja" (apenas quando consolidado) ou "Evolução Mensal"
	const [modoAgrupamento, setModoAgrupamento] = useState<ChartModoAgrupamento>(() => {
		return isConsolidado ? "lojas" : "mensal";
	});
	const [tipoVisualizacao, setTipoVisualizacao] = useState<ChartTipoVisualizacao>(() => {
		return isConsolidado ? "barras" : "linha";
	});

	const [showFaturamento, setShowFaturamento] = useState(true);
	const [showCustos, setShowCustos] = useState(true);
	const [showLucro, setShowLucro] = useState(false);

	// Estado de hover/interação
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	// Dimensões do SVG
	const SVG_WIDTH = 780;
	const SVG_HEIGHT = 300;
	const MARGIN = { top: 25, right: 30, bottom: 45, left: 74 };
	const innerW = SVG_WIDTH - MARGIN.left - MARGIN.right;
	const innerH = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

	// Quando altera o filtro de loja (Consolidado vs Loja Específica), ajusta o agrupamento e o formato
	useEffect(() => {
		if (isConsolidado) {
			setModoAgrupamento("lojas");
			setTipoVisualizacao("barras");
		} else {
			setModoAgrupamento("mensal");
			setTipoVisualizacao("linha");
		}
	}, [isConsolidado]);

	// Troca de abas com seus formatos padrões
	const handleSelectLojas = () => {
		setModoAgrupamento("lojas");
		setTipoVisualizacao("barras");
	};

	const handleSelectMensal = () => {
		setModoAgrupamento("mensal");
		setTipoVisualizacao("linha");
	};

	const handleSelectCategorias = () => {
		setModoAgrupamento("categorias");
		setTipoVisualizacao("barras");
	};

	// Ajusta tipo de visualização conforme o modo selecionado
	const effectiveTipo = useMemo(() => {
		if (modoAgrupamento === "lojas") {
			if (tipoVisualizacao === "rosca") return "barras";
			return tipoVisualizacao;
		}
		if (modoAgrupamento === "mensal") {
			if (tipoVisualizacao === "rosca") return "linha";
			return tipoVisualizacao;
		}
		if (modoAgrupamento === "categorias") {
			if (tipoVisualizacao === "linha") return "barras";
			return tipoVisualizacao;
		}
		return tipoVisualizacao;
	}, [modoAgrupamento, tipoVisualizacao]);

	// Dados e escala conforme o modo
	const { maxVal, stepVal, points } = useMemo(() => {
		let rawMax = 0;
		if (modoAgrupamento === "lojas") {
			lojaData.forEach((d) => {
				if (showFaturamento && d.faturamento > rawMax) rawMax = d.faturamento;
				if (showCustos && d.custos > rawMax) rawMax = d.custos;
				if (showLucro && d.lucro > rawMax) rawMax = d.lucro;
			});
		} else if (modoAgrupamento === "mensal") {
			mensalData.forEach((d) => {
				if (showFaturamento && d.faturamento > rawMax) rawMax = d.faturamento;
				if (showCustos && d.custos > rawMax) rawMax = d.custos;
				if (showLucro && d.lucro > rawMax) rawMax = d.lucro;
			});
		} else {
			categoriaData.forEach((d) => {
				if (d.valor > rawMax) rawMax = d.valor;
			});
		}

		if (rawMax <= 0) rawMax = 5000;

		// Intervalos de números redondos de 5.000 em 5.000 (ou múltiplos redondos à medida que os valores crescem)
		let step = 5000;
		if (rawMax > 500000) {
			step = 100000;
		} else if (rawMax > 250000) {
			step = 50000;
		} else if (rawMax > 100000) {
			step = 25000;
		} else if (rawMax > 50000) {
			step = 10000;
		} else {
			step = 5000;
		}

		// Topo da escala em número redondo múltiplo exato do step, com respiro visual
		let targetMax = Math.ceil(rawMax / step) * step;
		if (rawMax >= targetMax * 0.92) {
			targetMax += step;
		}
		if (targetMax < step) {
			targetMax = step;
		}

		const pts =
			modoAgrupamento === "lojas"
				? lojaData
				: modoAgrupamento === "mensal"
				? mensalData
				: categoriaData;

		return { maxVal: targetMax, stepVal: step, points: pts };
	}, [modoAgrupamento, lojaData, mensalData, categoriaData, showFaturamento, showCustos, showLucro]);

	// Dados para o modo Rosca (Por Loja)
	const donutItems = useMemo(() => {
		if (modoAgrupamento === "lojas") {
			const totalFat = lojaData.reduce((acc, l) => acc + l.faturamento, 0);
			return lojaData
				.filter((l) => l.faturamento > 0)
				.map((l) => ({
					key: l.lojaId,
					label: l.nome,
					valor: l.faturamento,
					percent: totalFat > 0 ? (l.faturamento / totalFat) * 100 : 0,
					color: STORE_COLORS[l.lojaId] || "#64748b",
					sublabel: "do faturamento",
				}));
		} else {
			return categoriaData.map((c) => ({
				key: c.categoria,
				label: c.label,
				valor: c.valor,
				percent: c.percent,
				color: c.color,
				sublabel: "dos custos",
			}));
		}
	}, [modoAgrupamento, lojaData, categoriaData]);

	const donutTotal = useMemo(() => {
		return modoAgrupamento === "lojas" ? totalFaturamento : totalCustos;
	}, [modoAgrupamento, totalFaturamento, totalCustos]);

	// Linhas da grade Y em intervalos de números redondos (0, 5.000, 10.000, 15.000, 20.000, 25.000...)
	const yTicks = useMemo(() => {
		const ticks = [];
		for (let val = 0; val <= maxVal; val += stepVal) {
			const y = MARGIN.top + innerH - (val / maxVal) * innerH;
			ticks.push({ val, y });
		}
		return ticks;
	}, [maxVal, stepVal, innerH, MARGIN.top]);

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 transition-colors">
			{/* Cabeçalho de Controle e Configuração do Gráfico */}
			<div className="flex flex-col gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
				{/* Linha Superior: Título à esquerda e Controles de Visualização / Agrupamento / Séries à direita */}
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
								<BarChart3 size={18} />
							</span>
							<h3 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
								Análise Visual & Gráficos
							</h3>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
							{isConsolidado
								? "Comparativos por loja, evolução mensal consolidada e composição de despesas"
								: "Evolução mensal da unidade e composição de despesas por categoria"}
						</p>
					</div>

					{/* Botões de Configuração do Gráfico: Agrupamento, Tipo e Séries */}
					<div className="flex flex-wrap items-center gap-2.5">
						{/* Agrupamento: Por Loja (apenas no consolidado), Evolução Mensal, Por Categoria */}
						<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold">
							{isConsolidado && (
								<button
									type="button"
									onClick={handleSelectLojas}
									className={`px-3 py-1.5 rounded-lg transition-all ${
										modoAgrupamento === "lojas"
											? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
											: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
									}`}>
									Por Loja
								</button>
							)}
							<button
								type="button"
								onClick={handleSelectMensal}
								className={`px-3 py-1.5 rounded-lg transition-all ${
									modoAgrupamento === "mensal"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
								}`}>
								Evolução Mensal
							</button>
							<button
								type="button"
								onClick={handleSelectCategorias}
								className={`px-3 py-1.5 rounded-lg transition-all ${
									modoAgrupamento === "categorias"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
								}`}>
								Por Categoria
							</button>
						</div>

						{/* Tipo de Gráfico */}
						<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
							{/* Por Loja: Barras (default) e Linhas */}
							{modoAgrupamento === "lojas" && (
								<>
									<button
										type="button"
										title="Gráfico de Barras"
										onClick={() => setTipoVisualizacao("barras")}
										className={`p-1.5 rounded-lg transition-all ${
											effectiveTipo === "barras"
												? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
												: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										<BarChart3 size={16} />
									</button>
									<button
										type="button"
										title="Gráfico de Linha"
										onClick={() => setTipoVisualizacao("linha")}
										className={`p-1.5 rounded-lg transition-all ${
											effectiveTipo === "linha"
												? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
												: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										<TrendingUp size={16} />
									</button>
								</>
							)}

							{/* Evolução Mensal: Linha (default) e Barras */}
							{modoAgrupamento === "mensal" && (
								<>
									<button
										type="button"
										title="Gráfico de Linha"
										onClick={() => setTipoVisualizacao("linha")}
										className={`p-1.5 rounded-lg transition-all ${
											effectiveTipo === "linha"
												? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
												: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										<TrendingUp size={16} />
									</button>
									<button
										type="button"
										title="Gráfico de Barras"
										onClick={() => setTipoVisualizacao("barras")}
										className={`p-1.5 rounded-lg transition-all ${
											effectiveTipo === "barras"
												? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
												: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										<BarChart3 size={16} />
									</button>
								</>
							)}

							{/* Por Categoria: Barras (default) e Pizza */}
							{modoAgrupamento === "categorias" && (
								<>
									<button
										type="button"
										title="Gráfico de Barras"
										onClick={() => setTipoVisualizacao("barras")}
										className={`p-1.5 rounded-lg transition-all ${
											effectiveTipo === "barras"
												? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
												: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										<BarChart3 size={16} />
									</button>
									<button
										type="button"
										title="Gráfico de Pizza / Distribuição"
										onClick={() => setTipoVisualizacao("rosca")}
										className={`p-1.5 rounded-lg transition-all ${
											effectiveTipo === "rosca"
												? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
												: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
										}`}>
										<PieChart size={16} />
									</button>
								</>
							)}
						</div>

						{/* Toggles de Séries (Apenas quando não for modo categorias) */}
						{modoAgrupamento !== "categorias" && (
							<div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setShowFaturamento(!showFaturamento)}
									className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
										showFaturamento
											? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-black"
											: "opacity-40 hover:opacity-80"
									}`}>
									<span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
									Faturamento
								</button>
								<button
									type="button"
									onClick={() => setShowCustos(!showCustos)}
									className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
										showCustos
											? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-black"
											: "opacity-40 hover:opacity-80"
									}`}>
									<span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
									Custos
								</button>
								<button
									type="button"
									onClick={() => setShowLucro(!showLucro)}
									className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
										showLucro
											? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-black"
											: "opacity-40 hover:opacity-80"
									}`}>
									<span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
									Lucro
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Controles de Filtro Idênticos: Abas de Troca de Loja, Nome no Centro e Seletor de Período/Mês */}
				{onChangeLoja && onChangeMesAno && (
					<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
						{/* Abas de Seleção de Loja */}
						<div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-x-auto scrollbar-none shadow-xs shrink-0">
							<button
								type="button"
								onClick={() => onChangeLoja("todas")}
								className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
									activeLoja === "todas"
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
									onClick={() => onChangeLoja(sId)}
									className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
										activeLoja === sId
											? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
											: "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60"
									}`}>
									<span>{STORE_NAMES_EXTENDED[sId]}</span>
								</button>
							))}
						</div>

						{/* Nome da Loja (ou Consolidado) no Centro */}
						<div className="flex-1 flex justify-center items-center py-1">
							<span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight text-center">
								{activeLoja === "todas"
									? "Consolidado"
									: STORE_NAMES_EXTENDED[activeLoja as StoreIdWithGeral] || activeLoja}
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
										aria-label="Selecionar mês do gráfico"
										onChange={(e) => {
											const newMes = parseInt(e.target.value, 10);
											onChangeMesAno?.(`${ano}-${String(newMes).padStart(2, "0")}`);
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
										aria-label="Selecionar ano do gráfico"
										onChange={(e) => {
											const newAno = parseInt(e.target.value, 10);
											onChangeMesAno?.(`${newAno}-${String(mes).padStart(2, "0")}`);
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
											onClick={() => onChangeMesAno?.(`${ano - 1}-${String(mes).padStart(2, "0")}`)}
											title="Ano Anterior"
											className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-95">
											<ChevronLeft size={18} />
										</button>

										<select
											value={ano}
											aria-label="Selecionar ano do gráfico"
											onChange={(e) => {
												const newAno = parseInt(e.target.value, 10);
												onChangeMesAno?.(`${newAno}-${String(mes).padStart(2, "0")}`);
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
											onClick={() => onChangeMesAno?.(`${ano + 1}-${String(mes).padStart(2, "0")}`)}
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
				)}
			</div>

			{/* Área de Renderização dos Gráficos */}
			<div className="relative w-full overflow-x-auto select-none pt-2">
				{/* 1. MODO ROSCA / DISTRIBUIÇÃO */}
				{effectiveTipo === "rosca" ? (
					<div className="flex flex-col lg:flex-row items-center justify-around gap-8 py-4">
						{/* Donut Chart SVG */}
						<div className="relative w-64 h-64 shrink-0 flex items-center justify-center">
							<svg width={256} height={256} viewBox="0 0 256 256" className="transform -rotate-90">
								{donutItems.length === 0 ? (
									<circle
										cx={128}
										cy={128}
										r={85}
										fill="none"
										stroke="currentColor"
										strokeWidth={32}
										className="text-slate-100 dark:text-slate-800"
									/>
								) : (
									(() => {
										let currentAngle = 0;
										const radius = 85;
										const strokeW = 34;
										const circumference = 2 * Math.PI * radius;

										return donutItems.map((item, idx) => {
											const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
											const strokeDashoffset = -((currentAngle / 360) * circumference);
											currentAngle += (item.percent / 100) * 360;

											const isHovered = hoveredIndex === idx;

											return (
												<circle
													key={item.key}
													cx={128}
													cy={128}
													r={radius}
													fill="none"
													stroke={item.color}
													strokeWidth={isHovered ? strokeW + 6 : strokeW}
													strokeDasharray={strokeDasharray}
													strokeDashoffset={strokeDashoffset}
													onMouseEnter={() => setHoveredIndex(idx)}
													onMouseLeave={() => setHoveredIndex(null)}
													className="transition-all duration-300 cursor-pointer"
													strokeLinecap="round"
												/>
											);
										});
									})()
								)}
							</svg>

							{/* Valores no próprio elemento (dentro da fatia da pizza) */}
							<svg viewBox="0 0 256 256" className="absolute inset-0 w-full h-full pointer-events-none">
								{(() => {
									let currentAngle = 0;
									const radius = 85;
									return donutItems.map((item) => {
										const sweepAngle = (item.percent / 100) * 360;
										const midAngle = currentAngle + sweepAngle / 2;
										currentAngle += sweepAngle;

										// Exibe o valor dentro da fatia quando tem tamanho suficiente para legibilidade
										if (item.percent < 4.5 || item.valor <= 0) return null;

										const rad = ((midAngle - 90) * Math.PI) / 180;
										const x = 128 + radius * Math.cos(rad);
										const y = 128 + radius * Math.sin(rad);

										return (
											<text
												key={item.key}
												x={x}
												y={y}
												textAnchor="middle"
												dominantBaseline="central"
												className="text-[10px] font-black fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] select-none">
												{formatElementValue(item.valor)}
											</text>
										);
									});
								})()}
							</svg>

							{/* Centro do Donut com Totais */}
							<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
								<span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
									{hoveredIndex !== null && donutItems[hoveredIndex]
										? donutItems[hoveredIndex].label
										: modoAgrupamento === "lojas"
										? "Faturamento Total"
										: "Custos Totais"}
								</span>
								<span className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
									{hoveredIndex !== null && donutItems[hoveredIndex]
										? formatCurrency(donutItems[hoveredIndex].valor)
										: formatCurrency(donutTotal)}
								</span>
								<span className={`text-xs font-semibold mt-0.5 ${
									modoAgrupamento === "lojas"
										? "text-blue-600 dark:text-blue-400"
										: "text-rose-600 dark:text-rose-400"
								}`}>
									{hoveredIndex !== null && donutItems[hoveredIndex]
										? `${donutItems[hoveredIndex].percent.toFixed(1)}% ${donutItems[hoveredIndex].sublabel}`
										: `${donutItems.length} ${modoAgrupamento === "lojas" ? "unidades" : "categorias"}`}
								</span>
							</div>
						</div>

						{/* Legenda Detalhada em Grid */}
						<div className="flex-1 w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
							{donutItems.length === 0 ? (
								<p className="text-sm text-slate-400 col-span-2 text-center py-6">
									Nenhum dado registrado para o período selecionado.
								</p>
							) : (
								donutItems.map((item, idx) => {
									const isHovered = hoveredIndex === idx;
									return (
										<div
											key={item.key}
											onMouseEnter={() => setHoveredIndex(idx)}
											onMouseLeave={() => setHoveredIndex(null)}
											className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
												isHovered
													? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-xs"
													: "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800"
											}`}>
											<div className="flex items-center gap-2.5 min-w-0">
												<span
													className="w-3.5 h-3.5 rounded-md shrink-0"
													style={{ backgroundColor: item.color }}
												/>
												<div className="truncate">
													<p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
														{item.label}
													</p>
													<p className="text-[10px] text-slate-400 dark:text-slate-500">
														{item.percent.toFixed(1)}% {item.sublabel}
													</p>
												</div>
											</div>
											<span className="text-xs font-black text-slate-900 dark:text-slate-100 shrink-0 ml-2">
												{formatCurrency(item.valor)}
											</span>
										</div>
									);
								})
							)}
						</div>
					</div>
				) : (
					/* 2. MODO BARRAS OU LINHA (SVG DINÂMICO) */
					<div className="min-w-[650px]">
						<svg
							viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
							className="w-full h-auto overflow-visible"
							onMouseLeave={() => setHoveredIndex(null)}>
							<defs>
								{/* Gradiente Faturamento */}
								<linearGradient id="gradFatArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
									<stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
								</linearGradient>
								{/* Gradiente Custos */}
								<linearGradient id="gradCustosArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
									<stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
								</linearGradient>
								{/* Gradiente Lucro */}
								<linearGradient id="gradLucroArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
									<stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
								</linearGradient>
							</defs>

							{/* Linhas de Grade Horizontais com números redondos */}
							{yTicks.map((tick, i) => (
								<g key={i}>
									<line
										x1={MARGIN.left}
										y1={tick.y}
										x2={MARGIN.left + innerW}
										y2={tick.y}
										stroke="currentColor"
										strokeDasharray={tick.val === 0 ? "none" : "3 3"}
										className={
											tick.val === 0
												? "text-slate-300 dark:text-slate-700"
												: "text-slate-200 dark:text-slate-800"
										}
									/>
									<text
										x={MARGIN.left - 8}
										y={tick.y + 4}
										textAnchor="end"
										className="text-[10px] font-semibold fill-slate-400 dark:fill-slate-500">
										{formatTickCurrency(tick.val)}
									</text>
								</g>
							))}

							{/* RENDERIZAÇÃO: BARRAS */}
							{effectiveTipo === "barras" && (
								<>
									{modoAgrupamento === "categorias" ? (
										/* Barras de Categorias */
										categoriaData.map((cat, idx) => {
											const slotW = innerW / Math.max(categoriaData.length, 1);
											const barW = Math.min(32, slotW * 0.65);
											const h = (cat.valor / maxVal) * innerH;
											const x = MARGIN.left + idx * slotW + (slotW - barW) / 2;
											const y = MARGIN.top + innerH - h;
											const isHovered = hoveredIndex === idx;

											return (
												<g
													key={cat.categoria}
													onMouseEnter={() => setHoveredIndex(idx)}
													onMouseLeave={() => setHoveredIndex(null)}
													className="cursor-pointer">
													<rect
														x={x}
														y={y}
														width={barW}
														height={Math.max(h, 2)}
														rx={4}
														fill={cat.color}
														opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
														className="transition-all duration-200"
													/>
													{/* Valor acima da barra */}
													{cat.valor > 0 && (
														<text
															x={x + barW / 2}
															y={y - 5}
															textAnchor="middle"
															className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300 select-none">
															{formatElementValue(cat.valor)}
														</text>
													)}
													<text
														x={x + barW / 2}
														y={MARGIN.top + innerH + 18}
														textAnchor="middle"
														className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400">
														{cat.label.slice(0, 8)}
													</text>
												</g>
											);
										})
									) : (
										/* Barras por Loja ou Evolução Mensal */
										points.map((pt: any, idx) => {
											const slotW = innerW / Math.max(points.length, 1);
											const activeSeriesCount = (showFaturamento ? 1 : 0) + (showCustos ? 1 : 0) + (showLucro ? 1 : 0);
											const barW = Math.min(26, (slotW * 0.75) / Math.max(activeSeriesCount, 1));
											const totalBarsW = barW * activeSeriesCount + (activeSeriesCount - 1) * 2;
											const startX = MARGIN.left + idx * slotW + (slotW - totalBarsW) / 2;
											const isHovered = hoveredIndex === idx;

											let currentX = startX;

											const fatH = ((pt.faturamento || 0) / maxVal) * innerH;
											const custH = ((pt.custos || 0) / maxVal) * innerH;
											const lucH = (Math.max(pt.lucro || 0, 0) / maxVal) * innerH;

											const labelText = modoAgrupamento === "lojas" ? pt.nome : pt.label;

											return (
												<g
													key={idx}
													onMouseEnter={() => setHoveredIndex(idx)}
													onMouseLeave={() => setHoveredIndex(null)}
													className="cursor-pointer">
													{/* Highlight de fundo da coluna */}
													{isHovered && (
														<rect
															x={MARGIN.left + idx * slotW}
															y={MARGIN.top}
															width={slotW}
															height={innerH}
															fill="currentColor"
															className="text-slate-100/60 dark:text-slate-800/40"
															rx={6}
														/>
													)}

													{/* Barra Faturamento */}
													{showFaturamento && (
														<rect
															x={currentX}
															y={MARGIN.top + innerH - fatH}
															width={barW}
															height={Math.max(fatH, 2)}
															rx={3}
															fill="#10b981"
															opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
															className="transition-all duration-200"
														/>
													)}
													{/* Valor acima da barra Faturamento */}
													{showFaturamento && (pt.faturamento || 0) > 0 && (
														<text
															x={currentX + barW / 2}
															y={MARGIN.top + innerH - fatH - 5}
															textAnchor="middle"
															className="text-[8px] sm:text-[9px] font-bold fill-emerald-600 dark:fill-emerald-400 select-none">
															{formatElementValue(pt.faturamento)}
														</text>
													)}

													{/* Barra Custos */}
													{showCustos && (
														<rect
															x={currentX + (showFaturamento ? barW + 2 : 0)}
															y={MARGIN.top + innerH - custH}
															width={barW}
															height={Math.max(custH, 2)}
															rx={3}
															fill="#f43f5e"
															opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
															className="transition-all duration-200"
														/>
													)}
													{/* Valor acima da barra Custos */}
													{showCustos && (pt.custos || 0) > 0 && (
														<text
															x={currentX + (showFaturamento ? barW + 2 : 0) + barW / 2}
															y={MARGIN.top + innerH - custH - 5}
															textAnchor="middle"
															className="text-[8px] sm:text-[9px] font-bold fill-rose-600 dark:fill-rose-400 select-none">
															{formatElementValue(pt.custos)}
														</text>
													)}

													{/* Barra Lucro */}
													{showLucro && (
														<rect
															x={currentX + (showFaturamento ? barW + 2 : 0) + (showCustos ? barW + 2 : 0)}
															y={MARGIN.top + innerH - lucH}
															width={barW}
															height={Math.max(lucH, 2)}
															rx={3}
															fill="#3b82f6"
															opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
															className="transition-all duration-200"
														/>
													)}
													{/* Valor acima da barra Lucro */}
													{showLucro && (pt.lucro || 0) > 0 && (
														<text
															x={currentX + (showFaturamento ? barW + 2 : 0) + (showCustos ? barW + 2 : 0) + barW / 2}
															y={MARGIN.top + innerH - lucH - 5}
															textAnchor="middle"
															className="text-[8px] sm:text-[9px] font-bold fill-blue-600 dark:fill-blue-400 select-none">
															{formatElementValue(pt.lucro)}
														</text>
													)}

													{/* Label X */}
													<text
														x={MARGIN.left + idx * slotW + slotW / 2}
														y={MARGIN.top + innerH + 18}
														textAnchor="middle"
														className={`text-[10px] ${
															isHovered ? "font-black fill-blue-600 dark:fill-blue-400" : "font-semibold fill-slate-500 dark:fill-slate-400"
														}`}>
														{labelText}
													</text>
												</g>
											);
										})
									)}
								</>
							)}

							{/* RENDERIZAÇÃO: LINHA / ÁREA SUAVE */}
							{effectiveTipo === "linha" && (
								<>
									{(() => {
										if (points.length === 0) {
											return (
												<text
													x={MARGIN.left + innerW / 2}
													y={MARGIN.top + innerH / 2}
													textAnchor="middle"
													className="text-xs font-bold fill-slate-400">
													Sem dados registrados para o período
												</text>
											);
										}

										const slotW = points.length > 1 ? innerW / (points.length - 1) : innerW / 2;

										const getCoords = (key: string) => {
											return points.map((p: any, i) => {
												const x = points.length > 1 ? MARGIN.left + i * slotW : MARGIN.left + innerW / 2;
												const rawVal = modoAgrupamento === "categorias" ? p.valor : p[key];
												const val = Math.max(rawVal || 0, 0);
												const y = MARGIN.top + innerH - (val / maxVal) * innerH;
												return { x, y, val, color: p.color };
											});
										};

										const makeLinePath = (coords: { x: number; y: number }[]) => {
											if (coords.length === 1) {
												return `M ${coords[0].x - 20} ${coords[0].y} L ${coords[0].x + 20} ${coords[0].y}`;
											}
											return coords.reduce((acc, curr, i, arr) => {
												if (i === 0) return `M ${curr.x} ${curr.y}`;
												const prev = arr[i - 1];
												const cx = (prev.x + curr.x) / 2;
												return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
											}, "");
										};

										// Renderização específica para Por Categoria em Linha
										if (modoAgrupamento === "categorias") {
											const catCoords = getCoords("valor");
											const catPath = makeLinePath(catCoords);
											const lastX = catCoords[catCoords.length - 1]?.x ?? (MARGIN.left + innerW);
											const firstX = catCoords[0]?.x ?? MARGIN.left;
											const catArea = `${catPath} L ${lastX} ${MARGIN.top + innerH} L ${firstX} ${MARGIN.top + innerH} Z`;

											return (
												<g>
													{/* Área preenchida com gradiente de custos */}
													<path d={catArea} fill="url(#gradCustosArea)" />

													{/* Linha contínua */}
													<path d={catPath} fill="none" stroke="#f43f5e" strokeWidth={2.8} strokeLinecap="round" />

													{/* Pontos com a cor de cada categoria */}
													{points.map((pt: any, idx) => {
														const x = catCoords[idx].x;
														const y = catCoords[idx].y;
														const isHovered = hoveredIndex === idx;

														return (
															<g
																key={idx}
																onMouseEnter={() => setHoveredIndex(idx)}
																onMouseLeave={() => setHoveredIndex(null)}
																className="cursor-pointer">
																{isHovered && (
																	<line
																		x1={x}
																		y1={MARGIN.top}
																		x2={x}
																		y2={MARGIN.top + innerH}
																		stroke="currentColor"
																		strokeDasharray="2 2"
																		className="text-slate-400 dark:text-slate-600"
																	/>
																)}

																<circle
																	cx={x}
																	cy={y}
																	r={isHovered ? 6 : 4}
																	fill={pt.color || "#f43f5e"}
																	stroke="#ffffff"
																	strokeWidth={2}
																	className="transition-all"
																/>

																{/* Valor acima do ponto */}
																{pt.valor > 0 && (
																	<text
																		x={x}
																		y={y - 8}
																		textAnchor="middle"
																		className="text-[9px] font-bold fill-rose-600 dark:fill-rose-400 select-none">
																		{formatElementValue(pt.valor)}
																	</text>
																)}

																<text
																	x={x}
																	y={MARGIN.top + innerH + 18}
																	textAnchor="middle"
																	className={`text-[9px] ${
																		isHovered ? "font-black fill-blue-600 dark:fill-blue-400" : "font-semibold fill-slate-500 dark:fill-slate-400"
																	}`}>
																	{pt.label.slice(0, 8)}
																</text>
															</g>
														);
													})}
												</g>
											);
										}

										// Renderização para Evolução Mensal ou Por Loja
										const fatCoords = getCoords("faturamento");
										const custCoords = getCoords("custos");
										const lucCoords = getCoords("lucro");

										const fatPath = makeLinePath(fatCoords);
										const custPath = makeLinePath(custCoords);
										const lucPath = makeLinePath(lucCoords);

										const lastX = fatCoords[fatCoords.length - 1]?.x ?? (MARGIN.left + innerW);
										const firstX = fatCoords[0]?.x ?? MARGIN.left;

										const fatArea = `${fatPath} L ${lastX} ${MARGIN.top + innerH} L ${firstX} ${MARGIN.top + innerH} Z`;
										const custArea = `${custPath} L ${lastX} ${MARGIN.top + innerH} L ${firstX} ${MARGIN.top + innerH} Z`;

										return (
											<g>
												{/* Áreas preenchidas */}
												{showFaturamento && <path d={fatArea} fill="url(#gradFatArea)" />}
												{showCustos && <path d={custArea} fill="url(#gradCustosArea)" />}

												{/* Linhas */}
												{showFaturamento && (
													<path d={fatPath} fill="none" stroke="#10b981" strokeWidth={2.8} strokeLinecap="round" />
												)}
												{showCustos && (
													<path d={custPath} fill="none" stroke="#f43f5e" strokeWidth={2.8} strokeLinecap="round" />
												)}
												{showLucro && (
													<path d={lucPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="4 4" />
												)}

												{/* Pontos Interativos */}
												{points.map((pt: any, idx) => {
													const x = fatCoords[idx].x;
													const isHovered = hoveredIndex === idx;

													const fatY = fatCoords[idx].y;
													const custY = custCoords[idx].y;
													const lucY = lucCoords[idx].y;

													// Se Faturamento e Custos estiverem com valores muito próximos, afasta em X para ambos ficarem acima do ponto sem sobrepor
													const isFatCustClose = showFaturamento && showCustos && Math.abs(fatY - custY) < 14;
													const fatLabelX = isFatCustClose ? x - 13 : x;
													const custLabelX = isFatCustClose ? x + 13 : x;

													return (
														<g
															key={idx}
															onMouseEnter={() => setHoveredIndex(idx)}
															onMouseLeave={() => setHoveredIndex(null)}
															className="cursor-pointer">
															{/* Linha vertical guia no hover */}
															{isHovered && (
																<line
																	x1={x}
																	y1={MARGIN.top}
																	x2={x}
																	y2={MARGIN.top + innerH}
																	stroke="currentColor"
																	strokeDasharray="2 2"
																	className="text-slate-400 dark:text-slate-600"
																/>
															)}

															{/* Bolinhas e valores nos pontos */}
															{showFaturamento && (
																<>
																	<circle
																		cx={fatCoords[idx].x}
																		cy={fatCoords[idx].y}
																		r={isHovered ? 5.5 : 3.5}
																		fill="#10b981"
																		stroke="#ffffff"
																		strokeWidth={2}
																		className="transition-all"
																	/>
																	{(pt.faturamento || 0) > 0 && (
																		<text
																			x={fatLabelX}
																			y={fatY - 7}
																			textAnchor="middle"
																			className="text-[8px] sm:text-[9px] font-bold fill-emerald-600 dark:fill-emerald-400 select-none">
																			{formatElementValue(pt.faturamento)}
																		</text>
																	)}
																</>
															)}

															{showCustos && (
																<>
																	<circle
																		cx={custCoords[idx].x}
																		cy={custCoords[idx].y}
																		r={isHovered ? 5.5 : 3.5}
																		fill="#f43f5e"
																		stroke="#ffffff"
																		strokeWidth={2}
																		className="transition-all"
																	/>
																	{(pt.custos || 0) > 0 && (
																		<text
																			x={custLabelX}
																			y={custY - 7}
																			textAnchor="middle"
																			className="text-[8px] sm:text-[9px] font-bold fill-rose-600 dark:fill-rose-400 select-none">
																			{formatElementValue(pt.custos)}
																		</text>
																	)}
																</>
															)}

															{showLucro && (
																<>
																	<circle
																		cx={lucCoords[idx].x}
																		cy={lucCoords[idx].y}
																		r={isHovered ? 5.5 : 3.5}
																		fill="#3b82f6"
																		stroke="#ffffff"
																		strokeWidth={2}
																		className="transition-all"
																	/>
																	{(pt.lucro || 0) > 0 && (
																		<text
																			x={x}
																			y={lucY - 7}
																			textAnchor="middle"
																			className="text-[8px] sm:text-[9px] font-bold fill-blue-600 dark:fill-blue-400 select-none">
																			{formatElementValue(pt.lucro)}
																		</text>
																	)}
																</>
															)}

															{/* Labels no eixo X */}
															<text
																x={x}
																y={MARGIN.top + innerH + 18}
																textAnchor="middle"
																className="text-[10px] font-semibold fill-slate-500 dark:fill-slate-400">
																{modoAgrupamento === "lojas" ? pt.nome : pt.label}
															</text>
														</g>
													);
												})}
											</g>
										);
									})()}
								</>
							)}

							{/* Tooltip Dinâmica Flutuante no SVG */}
							{hoveredIndex !== null && points[hoveredIndex] && (
								(() => {
									const pt: any = points[hoveredIndex];
									const slotW = innerW / Math.max(points.length, 1);
									let tooltipX = MARGIN.left + hoveredIndex * slotW + slotW / 2;
									if (tooltipX > SVG_WIDTH - 140) tooltipX = SVG_WIDTH - 140;
									if (tooltipX < 140) tooltipX = 140;
									const tooltipY = MARGIN.top + 10;

									const title =
										modoAgrupamento === "categorias"
											? pt.label
											: modoAgrupamento === "lojas"
											? pt.nome
											: pt.nomeMes || pt.label;

									return (
										<g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
											<rect
												x={-90}
												y={0}
												width={180}
												height={modoAgrupamento === "categorias" ? 54 : 80}
												rx={10}
												fill="#0f172a"
												opacity={0.92}
												stroke="#334155"
												strokeWidth={1}
											/>
											<text x={0} y={16} textAnchor="middle" className="text-[11px] font-black fill-white">
												{title}
											</text>

											{modoAgrupamento === "categorias" ? (
												<>
													<text x={0} y={32} textAnchor="middle" className="text-[11px] font-bold fill-rose-300">
														{formatCurrency(pt.valor)}
													</text>
													<text x={0} y={45} textAnchor="middle" className="text-[9px] fill-slate-300">
														{pt.percent.toFixed(1)}% dos custos
													</text>
												</>
											) : (
												<>
													{showFaturamento && (
														<text x={-75} y={34} className="text-[10px] font-semibold fill-emerald-300">
															Fat: {formatCurrency(pt.faturamento || 0)}
														</text>
													)}
													{showCustos && (
														<text x={-75} y={49} className="text-[10px] font-semibold fill-rose-300">
															Custo: {formatCurrency(pt.custos || 0)}
														</text>
													)}
													<text x={-75} y={64} className="text-[10px] font-black fill-blue-300">
														Líq: {formatCurrency((pt.faturamento || 0) - (pt.custos || 0))}
													</text>
												</>
											)}
										</g>
									);
								})()
							)}
						</svg>
					</div>
				)}
			</div>
		</div>
	);
}
