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
	FaturamentoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	PeriodoModo,
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

import ControleChart from "./components/controle-chart";
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
	const [customStartDate, setCustomStartDate] = useState("");
	const [customEndDate, setCustomEndDate] = useState("");
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

	// Navegação de Mês
	const [ano, mes] = useMemo(() => {
		const parts = mesAnoStr.split("-");
		return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
	}, [mesAnoStr]);

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

	// 1. Filtragem de Faturamento por Período e Loja
	const filteredFaturamentos = useMemo(() => {
		const now = new Date();
		const todayStr = now.toISOString().slice(0, 10);

		return faturamentos.filter((fat) => {
			// Loja
			if (lojaFilter !== "todas" && fat.lojaId !== lojaFilter) return false;

			// Período
			if (periodMode === "mes") {
				if (fat.mesReferencia !== mesAnoStr) return false;
			} else if (periodMode === "mes_anterior") {
				let prevM = mes - 1;
				let prevY = ano;
				if (prevM < 1) {
					prevM = 12;
					prevY -= 1;
				}
				const target = `${prevY}-${String(prevM).padStart(2, "0")}`;
				if (fat.mesReferencia !== target) return false;
			} else if (periodMode === "7dias") {
				const d = new Date();
				d.setDate(d.getDate() - 7);
				const limit = d.toISOString().slice(0, 10);
				if (fat.data < limit || fat.data > todayStr) return false;
			} else if (periodMode === "30dias") {
				const d = new Date();
				d.setDate(d.getDate() - 30);
				const limit = d.toISOString().slice(0, 10);
				if (fat.data < limit || fat.data > todayStr) return false;
			} else if (periodMode === "ano") {
				if (!fat.data.startsWith(`${ano}-`)) return false;
			} else if (periodMode === "custom") {
				if (customStartDate && fat.data < customStartDate) return false;
				if (customEndDate && fat.data > customEndDate) return false;
			}

			return true;
		});
	}, [faturamentos, lojaFilter, periodMode, mesAnoStr, ano, mes, customStartDate, customEndDate]);

	// 2. Filtragem de Custos por Período e Loja
	const filteredCustos = useMemo(() => {
		const now = new Date();
		const todayStr = now.toISOString().slice(0, 10);

		return custos.filter((c) => {
			// Loja
			if (lojaFilter !== "todas" && c.lojaId !== lojaFilter) return false;

			// Período
			if (periodMode === "mes") {
				if (c.mesReferencia !== mesAnoStr) return false;
			} else if (periodMode === "mes_anterior") {
				let prevM = mes - 1;
				let prevY = ano;
				if (prevM < 1) {
					prevM = 12;
					prevY -= 1;
				}
				const target = `${prevY}-${String(prevM).padStart(2, "0")}`;
				if (c.mesReferencia !== target) return false;
			} else if (periodMode === "7dias") {
				const d = new Date();
				d.setDate(d.getDate() - 7);
				const limit = d.toISOString().slice(0, 10);
				if (c.data < limit || c.data > todayStr) return false;
			} else if (periodMode === "30dias") {
				const d = new Date();
				d.setDate(d.getDate() - 30);
				const limit = d.toISOString().slice(0, 10);
				if (c.data < limit || c.data > todayStr) return false;
			} else if (periodMode === "ano") {
				if (!c.data.startsWith(`${ano}-`)) return false;
			} else if (periodMode === "custom") {
				if (customStartDate && c.data < customStartDate) return false;
				if (customEndDate && c.data > customEndDate) return false;
			}

			return true;
		});
	}, [custos, lojaFilter, periodMode, mesAnoStr, ano, mes, customStartDate, customEndDate]);

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
	// A) Temporal (dia a dia)
	const temporalData = useMemo(() => {
		// Mapa por data
		const dateMap: Record<string, { faturamento: number; custos: number }> = {};

		filteredFaturamentos.forEach((f) => {
			if (!dateMap[f.data]) dateMap[f.data] = { faturamento: 0, custos: 0 };
			dateMap[f.data].faturamento += f.valorTotal || 0;
		});

		filteredCustos.forEach((c) => {
			if (!dateMap[c.data]) dateMap[c.data] = { faturamento: 0, custos: 0 };
			dateMap[c.data].custos += c.valor || 0;
		});

		const sortedDates = Object.keys(dateMap).sort();

		// Se tiver menos de 2 datas, preenche dias do mês para visualização elegante
		if (sortedDates.length <= 1 && periodMode === "mes") {
			const totalDays = new Date(ano, mes, 0).getDate();
			const list = [];
			for (let day = 1; day <= totalDays; day++) {
				const dStr = `${ano}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
				const entry = dateMap[dStr] || { faturamento: 0, custos: 0 };
				list.push({
					label: `${String(day).padStart(2, "0")}/${String(mes).padStart(2, "0")}`,
					fullDate: dStr,
					faturamento: entry.faturamento,
					custos: entry.custos,
					lucro: entry.faturamento - entry.custos,
				});
			}
			return list;
		}

		return sortedDates.map((dStr) => {
			const [, m, d] = dStr.split("-");
			const entry = dateMap[dStr];
			return {
				label: `${d}/${m}`,
				fullDate: dStr,
				faturamento: entry.faturamento,
				custos: entry.custos,
				lucro: entry.faturamento - entry.custos,
			};
		});
	}, [filteredFaturamentos, filteredCustos, periodMode, ano, mes]);

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

	// C) Dados por Loja
	const lojaData = useMemo(() => {
		const lojasKeys: StoreIdWithGeral[] = ["lago", "terraco", "conjunto", "noroeste", "geral"];
		return lojasKeys.map((lojaKey) => {
			const fat = filteredFaturamentos
				.filter((f) => f.lojaId === lojaKey)
				.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
			const cust = filteredCustos
				.filter((c) => c.lojaId === lojaKey)
				.reduce((acc, curr) => acc + (curr.valor || 0), 0);

			return {
				lojaId: lojaKey,
				nome: STORE_NAMES_EXTENDED[lojaKey] || lojaKey,
				faturamento: fat,
				custos: cust,
				lucro: fat - cust,
			};
		});
	}, [filteredFaturamentos, filteredCustos]);

	// Maior centro de custo
	const topCusto = categoriaData[0];

	// Handlers de Ação
	const handleOpenNewFat = () => {
		setEditingFat(null);
		setIsFatModalOpen(true);
	};

	const handleOpenNewCusto = (categoria?: CategoriaCusto) => {
		setEditingCusto(null);
		if (categoria) setDefaultCategoriaCusto(categoria);
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
		if (window.confirm("Deseja realmente excluir este lançamento de custo?")) {
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
			{/* Cabeçalho da Página */}
			<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-7 shadow-sm transition-colors">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2.5">
							<span className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
								<Sliders size={22} />
							</span>
							<div>
								<h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
									Controle Financeiro
								</h1>
								<p className="text-xs text-slate-500 dark:text-slate-400">
									Faturamento, custos detalhados por categoria e análise DRE
								</p>
							</div>
						</div>
					</div>

					{/* Botões de Ação Rápida */}
					<div className="flex items-center gap-2.5 flex-wrap">
						<button
							type="button"
							onClick={handleOpenNewFat}
							className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black tracking-wide shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 active:scale-95">
							<Plus size={16} />
							<span>+ Novo Faturamento</span>
						</button>

						<button
							type="button"
							onClick={() => handleOpenNewCusto()}
							className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-black tracking-wide shadow-md transition-all flex items-center gap-1.5 active:scale-95">
							<Plus size={16} />
							<span>+ Novo Custo</span>
						</button>
					</div>
				</div>

				{/* Barra de Filtros Globais: Loja & Período */}
				<div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
					{/* Filtro de Loja */}
					<div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
						<span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
							<Store size={14} /> Loja:
						</span>
						<button
							type="button"
							onClick={() => setLojaFilter("todas")}
							className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
								lojaFilter === "todas"
									? "bg-blue-600 text-white shadow-xs font-black"
									: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
							}`}>
							Geral (Consolidado)
						</button>
						{(["lago", "terraco", "conjunto", "noroeste"] as const).map((sId) => (
							<button
								key={sId}
								type="button"
								onClick={() => setLojaFilter(sId)}
								className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
									lojaFilter === sId
										? "bg-blue-600 text-white shadow-xs font-black"
										: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
								}`}>
								{STORE_NAMES_EXTENDED[sId]}
							</button>
						))}
						<button
							type="button"
							onClick={() => setLojaFilter("geral")}
							className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
								lojaFilter === "geral"
									? "bg-blue-600 text-white shadow-xs font-black"
									: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
							}`}>
							Matriz / Geral
						</button>
					</div>

					{/* Filtro de Período */}
					<div className="flex items-center gap-2 flex-wrap">
						<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold">
							<button
								type="button"
								onClick={() => setPeriodMode("mes")}
								className={`px-2.5 py-1 rounded-lg transition-all ${
									periodMode === "mes"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								Mês
							</button>
							<button
								type="button"
								onClick={() => setPeriodMode("30dias")}
								className={`px-2.5 py-1 rounded-lg transition-all ${
									periodMode === "30dias"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								Últimos 30d
							</button>
							<button
								type="button"
								onClick={() => setPeriodMode("ano")}
								className={`px-2.5 py-1 rounded-lg transition-all ${
									periodMode === "ano"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								Ano {ano}
							</button>
							<button
								type="button"
								onClick={() => setPeriodMode("custom")}
								className={`px-2.5 py-1 rounded-lg transition-all ${
									periodMode === "custom"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								Personalizado
							</button>
						</div>

						{/* Navegador Mês a Mês */}
						{periodMode === "mes" && (
							<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
								<button
									type="button"
									onClick={handlePrevMonth}
									className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
									<ChevronLeft size={16} />
								</button>
								<button
									type="button"
									onClick={handleCurrentMonth}
									className="px-2.5 py-0.5 text-xs font-black text-slate-800 dark:text-slate-200 hover:underline">
									{MESES[mes - 1]} / {ano}
								</button>
								<button
									type="button"
									onClick={handleNextMonth}
									className="p-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
									<ChevronRight size={16} />
								</button>
							</div>
						)}

						{/* Custom Range */}
						{periodMode === "custom" && (
							<div className="flex items-center gap-1.5 text-xs">
								<input
									type="date"
									value={customStartDate}
									onChange={(e) => setCustomStartDate(e.target.value)}
									className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
								/>
								<span className="text-slate-400">até</span>
								<input
									type="date"
									value={customEndDate}
									onChange={(e) => setCustomEndDate(e.target.value)}
									className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* KPI Cards: Resumo Executivo Minimalista e Completo */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* 1. Faturamento Total */}
				<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Faturamento Bruto
						</span>
						<span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
							<TrendingUp size={16} />
						</span>
					</div>
					<div>
						<h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
							{formatCurrency(totalFaturamento)}
						</h2>
						<div className="flex items-center gap-2 mt-1">
							<span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
								<ArrowUpRight size={12} /> {filteredFaturamentos.length} registros
							</span>
							<span className="text-[11px] text-slate-400">no período</span>
						</div>
					</div>
				</div>

				{/* 2. Custos Totais */}
				<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Custos & Despesas
						</span>
						<span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
							<TrendingDown size={16} />
						</span>
					</div>
					<div>
						<h2 className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
							{formatCurrency(totalCustos)}
						</h2>
						<div className="flex items-center gap-2 mt-1">
							<span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
								{percentCustoSobreFat.toFixed(1)}% do faturamento
							</span>
							<span className="text-[11px] text-slate-400">({filteredCustos.length} lançamentos)</span>
						</div>
					</div>
				</div>

				{/* 3. Lucro Líquido Operacional */}
				<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Resultado Líquido
						</span>
						<span
							className={`p-2 rounded-xl ${
								lucroLiquido >= 0
									? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
									: "bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400"
							}`}>
							<Percent size={16} />
						</span>
					</div>
					<div>
						<h2
							className={`text-2xl font-black tracking-tight ${
								lucroLiquido >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
							}`}>
							{formatCurrency(lucroLiquido)}
						</h2>
						<div className="flex items-center gap-2 mt-1">
							<span
								className={`inline-flex items-center gap-0.5 text-[11px] font-black ${
									lucroLiquido >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
								}`}>
								Margem: {margemLiquida.toFixed(1)}%
							</span>
							<span className="text-[11px] text-slate-400">
								{lucroLiquido >= 0 ? "Operação Superavitária" : "Déficit no Período"}
							</span>
						</div>
					</div>
				</div>

				{/* 4. Top Custo / Distribuição */}
				<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 transition-colors">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold text-slate-500 dark:text-slate-400">
							Maior Despesa
						</span>
						<span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
							<PieChart size={16} />
						</span>
					</div>
					<div>
						<h2 className="text-xl font-black text-slate-900 dark:text-slate-100 truncate">
							{topCusto ? topCusto.label : "Sem Custos"}
						</h2>
						<div className="flex items-center gap-2 mt-1">
							<span className="text-xs font-black text-amber-600 dark:text-amber-400">
								{topCusto ? formatCurrency(topCusto.valor) : "R$ 0,00"}
							</span>
							<span className="text-[11px] text-slate-400">
								{topCusto ? `(${topCusto.percent.toFixed(1)}% dos custos)` : ""}
							</span>
						</div>
					</div>
				</div>
			</div>

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
					<span>Dashboard & Gráficos</span>
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
					{/* Gráfico Configurável */}
					<ControleChart
						temporalData={temporalData}
						categoriaData={categoriaData}
						lojaData={lojaData}
						totalFaturamento={totalFaturamento}
						totalCustos={totalCustos}
						totalLucro={lucroLiquido}
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
												{fat.data} • {STORE_NAMES_EXTENDED[fat.lojaId] || fat.lojaId}
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
											onClick={() => {
												setEditingCusto(custo);
												setIsCustoModalOpen(true);
											}}
											className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors">
											<div>
												<p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
													<span
														className="w-2 h-2 rounded-full inline-block"
														style={{ backgroundColor: cfg?.color || "#64748b" }}
													/>
													{custo.descricao}
												</p>
												<span className="text-[10px] text-slate-400">
													Dia: {custo.data} • {cfg?.label} • {STORE_NAMES_EXTENDED[custo.lojaId] || custo.lojaId}
												</span>
											</div>
											<span className="text-xs font-black text-rose-600 dark:text-rose-400">
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
					onEdit={(item) => {
						setEditingCusto(item);
						setIsCustoModalOpen(true);
					}}
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
				editingFaturamento={editingFat}
				defaultLoja={lojaFilter !== "todas" ? (lojaFilter as StoreIdWithGeral) : "geral"}
			/>

			<FaturamentoDetalhesModal
				faturamento={selectedFatDetalhes}
				onClose={() => setIsFatDetalhesOpen(false)}
				onEdit={(item) => {
					setEditingFat(item);
					setIsFatModalOpen(true);
				}}
			/>

			<CustoModal
				isOpen={isCustoModalOpen}
				onClose={() => setIsCustoModalOpen(false)}
				onSave={handleSaveCusto}
				editingCusto={editingCusto}
				defaultCategoria={defaultCategoriaCusto}
				defaultLoja={lojaFilter !== "todas" ? (lojaFilter as StoreIdWithGeral) : "geral"}
			/>
		</div>
	);
}
