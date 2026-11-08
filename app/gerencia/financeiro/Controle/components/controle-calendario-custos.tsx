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
	CheckCircle2,
	TrendingUp,
	TrendingDown,
} from "lucide-react";
import {
	CustoFinanceiro,
	FaturamentoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
} from "@/types/financeiro-controle";

interface ControleCalendarioCustosProps {
	custos: CustoFinanceiro[];
	faturamentos: FaturamentoFinanceiro[];
	currentMesAno: string; // "YYYY-MM"
	currentLoja: string; // "todas" | StoreIdWithGeral
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
	onEditFaturamento?: (faturamento: FaturamentoFinanceiro) => void;
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
	onSelectDiaParaCusto,
	onSelectDiaParaFaturamento,
	onEditCusto,
	onEditFaturamento,
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

	const handleCurrentMonth = () => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		handleSetMesAno(`${year}-${month}`);
	};

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

	const handleOpenDayModal = (dayNum: number, cat?: CategoriaCusto) => {
		const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
		setSelectedDayInfo({
			dayNum,
			diaIso,
			categoriaPre: cat,
		});
	};

	const handleTriggerNovoCusto = (cat?: CategoriaCusto) => {
		if (!selectedDayInfo) return;
		const targetLoja: StoreIdWithGeral =
			localLoja === "todas" ? "geral" : (localLoja as StoreIdWithGeral);
		const chosenCat = cat || selectedDayInfo.categoriaPre;
		onSelectDiaParaCusto(selectedDayInfo.diaIso, targetLoja, chosenCat);
		setSelectedDayInfo(null);
	};

	const handleTriggerNovoFaturamento = () => {
		if (!selectedDayInfo) return;
		const targetLoja: StoreIdWithGeral =
			localLoja === "todas" ? "geral" : (localLoja as StoreIdWithGeral);
		onSelectDiaParaFaturamento(selectedDayInfo.diaIso, targetLoja);
		setSelectedDayInfo(null);
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

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 transition-colors">
			{/* Cabeçalho do Calendário / Tabela */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
							<CalendarIcon size={18} />
						</span>
						<h3 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
							Custos Diários por Categoria (Tabela & Calendário)
						</h3>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
						{localLoja === "todas"
							? "Visão consolidada com somatório de todas as lojas por dia do mês. Clique em um dia para lançar."
							: `Custos diários da unidade ${STORE_NAMES_EXTENDED[localLoja as StoreIdWithGeral] || localLoja}. Clique em um dia para lançar.`}
					</p>
				</div>

				{/* Controles de Filtro: Loja e Mês */}
				<div className="flex flex-wrap items-center gap-2.5">
					{/* Filtro de Loja */}
					<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold overflow-x-auto">
						<button
							type="button"
							onClick={() => handleSetLoja("todas")}
							className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
								localLoja === "todas"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							Consolidado
						</button>
						{(["lago", "terraco", "conjunto", "noroeste"] as const).map((sId) => (
							<button
								key={sId}
								type="button"
								onClick={() => handleSetLoja(sId)}
								className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
									localLoja === sId
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
								}`}>
								{STORE_NAMES_EXTENDED[sId]}
							</button>
						))}
					</div>

					{/* Navegação de Mês */}
					<div className="flex items-center gap-1.5">
						<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
							<button
								type="button"
								onClick={handlePrevMonth}
								title="Mês Anterior"
								className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
								<ChevronLeft size={16} />
							</button>

							<select
								value={mes}
								aria-label="Selecionar mês da tabela"
								onChange={(e) => {
									const newMes = parseInt(e.target.value, 10);
									handleSetMesAno(`${ano}-${String(newMes).padStart(2, "0")}`);
								}}
								className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-200 border-none outline-hidden cursor-pointer px-1 py-0.5">
								{MESES.map((nome, idx) => (
									<option key={idx + 1} value={idx + 1} className="dark:bg-slate-900">
										{nome}
									</option>
								))}
							</select>

							<span className="text-slate-400 text-xs font-semibold">/</span>

							<select
								value={ano}
								aria-label="Selecionar ano da tabela"
								onChange={(e) => {
									const newAno = parseInt(e.target.value, 10);
									handleSetMesAno(`${newAno}-${String(mes).padStart(2, "0")}`);
								}}
								className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-200 border-none outline-hidden cursor-pointer px-1 py-0.5">
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
								className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
								<ChevronRight size={16} />
							</button>
						</div>

						{todayIso.startsWith(localMesAno) && (
							<button
								type="button"
								onClick={scrollToToday}
								className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 hover:bg-blue-100 transition-all">
								Ir para Hoje
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Resumo Rápido do Mês na Tabela */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
				<div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Total de Custos no Mês
					</span>
					<span className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
						{formatCurrency(grandTotals.custos)}
					</span>
				</div>

				<div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Faturamento no Mês
					</span>
					<span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
						{formatCurrency(grandTotals.faturamento)}
					</span>
				</div>

				<div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
					<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
						Resultado / Saldo
					</span>
					<span
						className={`text-base font-black mt-0.5 block ${
							grandTotals.saldo >= 0
								? "text-blue-600 dark:text-blue-400"
								: "text-red-600 dark:text-red-400"
						}`}>
						{formatCurrency(grandTotals.saldo)}
					</span>
				</div>

				<div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
					<div>
						<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
							Visualização Ativa
						</span>
						<span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
							{localLoja === "todas"
								? "Todas as Lojas (Consolidado)"
								: STORE_NAMES_EXTENDED[localLoja as StoreIdWithGeral]}
						</span>
					</div>
					<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
				</div>
			</div>

			{/* Dica de Uso */}
			<div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-blue-50/40 dark:bg-blue-950/20 px-3 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30">
				<span className="flex items-center gap-1.5 font-medium">
					<Sparkles size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
					Clique em qualquer dia ou célula para lançar custo ou faturamento para aquela data específica.
				</span>
				<span className="text-[10px] font-bold text-slate-400 hidden sm:inline">
					Scroll horizontal para navegar pelos {daysInMonth} dias
				</span>
			</div>

			{/* TABELA / CALENDÁRIO: DIAS POR COLUNA & TIPOS DE CUSTO POR LINHA */}
			<div
				ref={tableContainerRef}
				className="relative overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[640px] overflow-y-auto select-none shadow-xs">
				<table className="w-full text-left border-collapse text-xs">
					{/* Cabeçalho da Tabela */}
					<thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
						<tr>
							{/* Coluna 1 Fixa: Tipo de Custo */}
							<th className="sticky left-0 top-0 z-40 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-xs border-r border-b border-slate-200 dark:border-slate-700/80 min-w-[180px] max-w-[180px] p-3 text-xs font-black shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
								<div className="flex items-center justify-between">
									<span>Tipo de Custo</span>
									<span className="text-[10px] font-normal text-slate-400">
										{MESES[mes - 1]?.slice(0, 3)}/{ano}
									</span>
								</div>
							</th>

							{/* Colunas dos Dias do Mês */}
							{daysArray.map((d) => {
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;
								const dayOfWeek = new Date(ano, mes - 1, d).getDay();
								const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

								return (
									<th
										key={d}
										ref={isToday ? todayColRef : undefined}
										onClick={() => handleOpenDayModal(d)}
										title={`Clique para lançar no Dia ${String(d).padStart(2, "0")}/${String(mes).padStart(2, "0")}`}
										className={`border-r border-b border-slate-200 dark:border-slate-700/80 min-w-[76px] w-[76px] p-2 text-center cursor-pointer group transition-colors ${
											isToday
												? "bg-blue-100/70 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 font-black"
												: isWeekend
												? "bg-slate-100/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400"
												: "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300"
										} hover:bg-blue-50 dark:hover:bg-blue-900/30`}>
										<div className="flex flex-col items-center justify-center">
											<span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-blue-600 transition-colors">
												{DIAS_SEMANA_ABREV[dayOfWeek]}
											</span>
											<span
												className={`text-sm font-black px-1.5 py-0.5 rounded-lg transition-all ${
													isToday
														? "bg-blue-600 text-white shadow-xs"
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
							<th className="sticky right-0 top-0 z-40 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-xs border-l border-b border-slate-200 dark:border-slate-700/80 min-w-[110px] p-3 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100">
								Total Mês
							</th>
						</tr>
					</thead>

					{/* Corpo da Tabela: Linhas dos Tipos de Custo */}
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
						{CATEGORIAS_ORDEM.map((catKey) => {
							const cfg = CATEGORIAS_CUSTO_CONFIG[catKey];
							const catMonthTotal = categoryMonthTotals[catKey] || 0;

							return (
								<tr
									key={catKey}
									className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
									{/* Coluna 1 Fixa: Nome da Categoria */}
									<td className="sticky left-0 z-20 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.04)]">
										<div className="flex items-center gap-2 min-w-0">
											<span
												className="w-2.5 h-2.5 rounded-full shrink-0"
												style={{ backgroundColor: cfg.color }}
											/>
											<span className="font-bold text-slate-800 dark:text-slate-200 truncate text-xs">
												{cfg.label}
											</span>
										</div>
									</td>

									{/* Colunas dos Dias do Mês */}
									{daysArray.map((d) => {
										const cellData = custoMatrix[catKey]?.[d];
										const val = cellData?.total || 0;
										const itemCount = cellData?.items?.length || 0;
										const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
										const isToday = diaIso === todayIso;

										return (
											<td
												key={d}
												onClick={() => handleOpenDayModal(d, catKey)}
												title={`${cfg.label} no Dia ${String(d).padStart(2, "0")}: ${
													val > 0 ? formatCurrency(val) : "Nenhum custo"
												} (Clique para lançar ou ver detalhes)`}
												className={`border-r border-slate-100 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-all ${
													isToday
														? "bg-blue-50/30 dark:bg-blue-950/20"
														: ""
												} hover:bg-blue-100/50 dark:hover:bg-blue-900/40 active:scale-95`}>
												{val > 0 ? (
													<div className="flex flex-col items-center justify-center">
														<span className="font-bold text-rose-600 dark:text-rose-400 text-[11px] leading-tight">
															{formatCellCurrency(val)}
														</span>
														{itemCount > 1 && (
															<span className="text-[9px] text-slate-400 leading-none">
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
									<td className="sticky right-0 z-20 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.04)] text-rose-600 dark:text-rose-400">
										{catMonthTotal > 0 ? formatCurrency(catMonthTotal) : "-"}
									</td>
								</tr>
							);
						})}
					</tbody>

					{/* Rodapé da Tabela: Linhas de Somatório Diário */}
					<tfoot className="sticky bottom-0 z-30 border-t-2 border-slate-200 dark:border-slate-800">
						{/* Linha 1: Total de Custos do Dia */}
						<tr className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs font-black">
							<td className="sticky left-0 z-40 bg-slate-100/95 dark:bg-slate-900/95 border-r border-b border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100">
								<div className="flex items-center gap-1.5">
									<Receipt size={13} className="text-rose-500" />
									<span>Total Custos</span>
								</div>
							</td>

							{daysArray.map((d) => {
								const val = dailyTotals.costs[d] || 0;
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;

								return (
									<td
										key={d}
										onClick={() => handleOpenDayModal(d)}
										title={`Total de custos no Dia ${d}: ${formatCurrency(val)}`}
										className={`border-r border-b border-slate-200/80 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-colors ${
											isToday
												? "bg-blue-50/80 dark:bg-blue-950/40"
												: val > 0
												? "bg-rose-50/40 dark:bg-rose-950/20"
												: "bg-slate-50/40 dark:bg-slate-900/40"
										} hover:bg-rose-100/60 dark:hover:bg-rose-900/30`}>
										<span
											className={`text-[11px] font-black ${
												val > 0
													? "text-rose-600 dark:text-rose-400"
													: "text-slate-300 dark:text-slate-600 font-normal"
											}`}>
											{formatCellCurrency(val)}
										</span>
									</td>
								);
							})}

							<td className="sticky right-0 z-40 bg-slate-100/95 dark:bg-slate-900/95 border-l border-b border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] text-rose-600 dark:text-rose-400">
								{formatCurrency(grandTotals.custos)}
							</td>
						</tr>

						{/* Linha 2: Faturamento do Dia */}
						<tr className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-xs font-black">
							<td className="sticky left-0 z-40 bg-slate-100/95 dark:bg-slate-900/95 border-r border-b border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100">
								<div className="flex items-center gap-1.5">
									<DollarSign size={13} className="text-emerald-500" />
									<span>Faturamento</span>
								</div>
							</td>

							{daysArray.map((d) => {
								const val = dailyTotals.fats[d] || 0;
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;

								return (
									<td
										key={d}
										onClick={() => handleOpenDayModal(d)}
										title={`Faturamento no Dia ${d}: ${formatCurrency(val)}`}
										className={`border-r border-b border-slate-200/80 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-colors ${
											isToday
												? "bg-blue-50/80 dark:bg-blue-950/40"
												: val > 0
												? "bg-emerald-50/40 dark:bg-emerald-950/20"
												: "bg-slate-50/40 dark:bg-slate-900/40"
										} hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30`}>
										<span
											className={`text-[11px] font-black ${
												val > 0
													? "text-emerald-600 dark:text-emerald-400"
													: "text-slate-300 dark:text-slate-600 font-normal"
											}`}>
											{formatCellCurrency(val)}
										</span>
									</td>
								);
							})}

							<td className="sticky right-0 z-40 bg-slate-100/95 dark:bg-slate-900/95 border-l border-b border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] text-emerald-600 dark:text-emerald-400">
								{formatCurrency(grandTotals.faturamento)}
							</td>
						</tr>

						{/* Linha 3: Saldo Diário (Líquido) */}
						<tr className="bg-slate-100/80 dark:bg-slate-900/95 backdrop-blur-xs font-black">
							<td className="sticky left-0 z-40 bg-slate-150 dark:bg-slate-850 border-r border-slate-200 dark:border-slate-800 p-2.5 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] text-slate-900 dark:text-slate-100">
								<div className="flex items-center gap-1.5">
									<TrendingUp size={13} className="text-blue-500" />
									<span>Saldo Diário</span>
								</div>
							</td>

							{daysArray.map((d) => {
								const val = dailyTotals.balances[d] || 0;
								const hasMov =
									(dailyTotals.fats[d] || 0) > 0 || (dailyTotals.costs[d] || 0) > 0;
								const diaIso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
								const isToday = diaIso === todayIso;

								return (
									<td
										key={d}
										onClick={() => handleOpenDayModal(d)}
										title={`Saldo no Dia ${d}: ${formatCurrency(val)}`}
										className={`border-r border-slate-200/80 dark:border-slate-800 p-1.5 text-center cursor-pointer transition-colors ${
											isToday
												? "bg-blue-100/70 dark:bg-blue-950/50"
												: hasMov
												? val >= 0
													? "bg-blue-50/40 dark:bg-blue-950/20"
													: "bg-red-50/40 dark:bg-red-950/20"
												: "bg-slate-100/40 dark:bg-slate-900/40"
										} hover:bg-blue-100/50 dark:hover:bg-blue-900/30`}>
										{hasMov ? (
											<span
												className={`text-[11px] font-black ${
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
								className={`sticky right-0 z-40 bg-slate-150 dark:bg-slate-850 border-l border-slate-200 dark:border-slate-800 p-2.5 text-right font-black shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)] ${
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
										onClick={() => handleTriggerNovoCusto()}
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
										onClick={handleTriggerNovoFaturamento}
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
												<div className="flex items-center gap-2 shrink-0">
													<span className="text-xs font-black text-rose-600 dark:text-rose-400">
														{formatCurrency(custo.valor)}
													</span>
													<Edit2
														size={13}
														className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors"
													/>
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
											<div className="flex items-center gap-2 shrink-0">
												<span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
													{formatCurrency(fat.valorTotal)}
												</span>
												<Edit2
													size={13}
													className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors"
												/>
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
		</div>
	);
}

