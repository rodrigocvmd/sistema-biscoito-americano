"use client";

import { useState, useEffect, useMemo } from "react";
import {
	GastoPessoal,
} from "@/types/funcionarios";
import {
	InsumoResponsavel,
	RESPONSAVEIS_COMPRA,
} from "@/lib/insumos-data";
import {
	subscribeGastosPessoais,
	createGastoPessoal,
	updateGastoPessoal,
	deleteGastoPessoal,
} from "@/lib/funcionarios-service";
import {
	ResponsavelTag,
	getResponsavelColor,
} from "@/app/gerencia/insumos/components/responsavel-tag";
import {
	Plus,
	Edit2,
	Trash2,
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	DollarSign,
	TrendingUp,
	Users,
	Search,
	Filter,
	X,
	Receipt,
	CheckCircle2,
	Loader2,
	Wallet,
	CreditCard,
	CalendarDays,
	ShoppingBag,
	Tag,
	ArrowUpDown,
} from "lucide-react";

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

export default function PessoalPage() {
	const [gastos, setGastos] = useState<GastoPessoal[]>([]);
	const [loading, setLoading] = useState(true);

	// Filtros de período: mês selecionado (padrão) ou personalizado
	const [periodMode, setPeriodMode] = useState<"mes" | "ano" | "todos" | "custom">("mes");
	const [mesAnoStr, setMesAnoStr] = useState(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	});
	const [customStartDate, setCustomStartDate] = useState("");
	const [customEndDate, setCustomEndDate] = useState("");

	// Filtros adicionais
	const [selectedResponsavelFilter, setSelectedResponsavelFilter] = useState<string>("all");
	const [searchTerm, setSearchTerm] = useState("");

	// Modal de Criar / Editar Gasto
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingGasto, setEditingGasto] = useState<GastoPessoal | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	// Form State
	const [formNome, setFormNome] = useState("");
	const [formValor, setFormValor] = useState("");
	const [formResponsavel, setFormResponsavel] = useState<InsumoResponsavel>("Rodrigo");
	const [formDataGasto, setFormDataGasto] = useState("");
	const [formObservacoes, setFormObservacoes] = useState("");

	// Modal de Confirmação de Exclusão
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Inscrição em Tempo Real no Firestore
	useEffect(() => {
		const unsubscribe = subscribeGastosPessoais((data) => {
			setGastos(data);
			setLoading(false);
		});
		return () => unsubscribe();
	}, []);

	// Ano e mês numéricos a partir de mesAnoStr
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
	};

	// Helper para selecionar todo o texto do input ao focar ou clicar
	const handleSelectAll = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
		(e.target as HTMLInputElement).select();
	};

	// Abertura do Modal de Novo Gasto
	const openNewGastoModal = (responsavelDefault?: InsumoResponsavel) => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		const todayStr = `${year}-${month}-${day}`;

		setEditingGasto(null);
		setFormNome("");
		setFormValor("");
		setFormResponsavel(responsavelDefault || (selectedResponsavelFilter !== "all" ? (selectedResponsavelFilter as InsumoResponsavel) : "Rodrigo"));
		setFormDataGasto(todayStr);
		setFormObservacoes("");
		setIsModalOpen(true);
	};

	// Abertura do Modal de Edição
	const openEditGastoModal = (gasto: GastoPessoal) => {
		setEditingGasto(gasto);
		setFormNome(gasto.nome);
		setFormValor(gasto.valor ? String(gasto.valor).replace(".", ",") : "");
		setFormResponsavel(gasto.responsavel);
		setFormDataGasto(gasto.data);
		setFormObservacoes(gasto.observacoes || "");
		setIsModalOpen(true);
	};

	// Submissão do Formulário
	const handleSaveGasto = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedNome = formNome.trim();
		if (!trimmedNome || !formValor.trim() || !formDataGasto) return;

		const cleanedVal = formValor.replace(/\./g, "").replace(",", ".").trim();
		const valNum = parseFloat(cleanedVal);
		if (isNaN(valNum) || valNum <= 0) return;

		// Mês de referência derivado da data do gasto (YYYY-MM)
		const mesRef = formDataGasto.slice(0, 7);

		setIsSaving(true);
		try {
			if (editingGasto) {
				await updateGastoPessoal(editingGasto.id, {
					nome: trimmedNome,
					valor: valNum,
					responsavel: formResponsavel,
					data: formDataGasto,
					mesReferencia: mesRef,
					observacoes: formObservacoes.trim() || undefined,
				});
			} else {
				await createGastoPessoal({
					nome: trimmedNome,
					valor: valNum,
					responsavel: formResponsavel,
					data: formDataGasto,
					mesReferencia: mesRef,
					observacoes: formObservacoes.trim() || undefined,
				});
			}
			setIsModalOpen(false);
		} catch (error) {
			console.error("Erro ao salvar gasto pessoal:", error);
			alert("Erro ao salvar gasto pessoal.");
		} finally {
			setIsSaving(false);
		}
	};

	// Exclusão de Gasto
	const handleConfirmDelete = async () => {
		if (!deletingId) return;
		setIsDeleting(true);
		try {
			await deleteGastoPessoal(deletingId);
			setDeletingId(null);
		} catch (error) {
			console.error("Erro ao excluir gasto pessoal:", error);
			alert("Erro ao excluir gasto.");
		} finally {
			setIsDeleting(false);
		}
	};

	// Filtragem dos gastos por Período, Responsável e Busca
	const filteredGastos = useMemo(() => {
		return gastos.filter((g) => {
			// 1. Filtro de Período
			if (periodMode === "mes") {
				if (g.mesReferencia !== mesAnoStr) return false;
			} else if (periodMode === "ano") {
				if (!g.data.startsWith(`${ano}-`)) return false;
			} else if (periodMode === "custom") {
				if (customStartDate && g.data < customStartDate) return false;
				if (customEndDate && g.data > customEndDate) return false;
			}

			// 2. Filtro por Responsável
			if (selectedResponsavelFilter !== "all") {
				if (g.responsavel !== selectedResponsavelFilter) return false;
			}

			// 3. Busca por texto
			if (searchTerm.trim()) {
				const term = searchTerm.toLowerCase();
				const matchNome = g.nome.toLowerCase().includes(term);
				const matchObs = g.observacoes?.toLowerCase().includes(term);
				const matchResp = g.responsavel.toLowerCase().includes(term);
				if (!matchNome && !matchObs && !matchResp) return false;
			}

			return true;
		});
	}, [gastos, periodMode, mesAnoStr, ano, customStartDate, customEndDate, selectedResponsavelFilter, searchTerm]);

	// Somatórios e Cálculos
	const totals = useMemo(() => {
		let totalGeral = 0;
		const porResponsavel: Record<InsumoResponsavel, { total: number; count: number }> = {
			Rodrigo: { total: 0, count: 0 },
			Ana: { total: 0, count: 0 },
			Edson: { total: 0, count: 0 },
		};

		filteredGastos.forEach((g) => {
			totalGeral += g.valor;
			if (porResponsavel[g.responsavel]) {
				porResponsavel[g.responsavel].total += g.valor;
				porResponsavel[g.responsavel].count += 1;
			}
		});

		return {
			totalGeral,
			countGeral: filteredGastos.length,
			porResponsavel,
		};
	}, [filteredGastos]);

	const formatCurrency = (val: number) => {
		return val.toLocaleString("pt-BR", {
			style: "currency",
			currency: "BRL",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	};

	const formatDateDisplay = (dateStr: string) => {
		if (!dateStr) return "-";
		const parts = dateStr.split("-");
		if (parts.length === 3) {
			return `${parts[2]}/${parts[1]}/${parts[0]}`;
		}
		return dateStr;
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-20 gap-3">
				<Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
				<p className="text-sm font-bold text-slate-500 dark:text-slate-400">
					Carregando gastos pessoais...
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-6xl mx-auto">
			{/* Top Header Card */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
				<div className="flex items-center gap-4">
					<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
						<Wallet size={30} />
					</div>
					<div>
						<h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
							Gastos Pessoais com a Empresa
						</h2>
						<p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
							Controle e prestação de contas de compras feitas do bolso dos sócios (Rodrigo, Ana e Edson).
						</p>
					</div>
				</div>

				<button
					type="button"
					onClick={() => openNewGastoModal()}
					className="cursor-pointer w-full md:w-auto px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0">
					<Plus size={18} strokeWidth={2.5} />
					<span>Lançar Gasto Pessoal</span>
				</button>
			</div>

			{/* Barra de Organização por Período */}
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
				<div className="flex flex-col md:flex-row items-center justify-between gap-4">
					{/* Modos de Período (Mês, Ano, Todos, Custom) */}
					<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full md:w-auto overflow-x-auto">
						{[
							{ id: "mes", label: "Mês (Padrão)" },
							{ id: "ano", label: "Ano Todo" },
							{ id: "todos", label: "Todo o Histórico" },
							{ id: "custom", label: "Personalizado" },
						].map((mode) => (
							<button
								key={mode.id}
								type="button"
								onClick={() => setPeriodMode(mode.id as any)}
								className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
									periodMode === mode.id
										? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								{mode.label}
							</button>
						))}
					</div>

					{/* Navegação do Mês (quando em modo 'mes') */}
					{periodMode === "mes" && (
						<div className="flex items-center gap-2 w-full md:w-auto justify-center">
							<button
								type="button"
								onClick={handlePrevMonth}
								aria-label="Mês anterior"
								className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
								<ChevronLeft size={20} />
							</button>

							<div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
								<CalendarIcon size={16} className="text-indigo-600 dark:text-indigo-400" />
								<span className="text-sm font-black text-slate-800 dark:text-slate-200 min-w-[130px] text-center">
									{MESES[mes - 1]} {ano}
								</span>
							</div>

							<button
								type="button"
								onClick={handleNextMonth}
								aria-label="Próximo mês"
								className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
								<ChevronRight size={20} />
							</button>

							<button
								type="button"
								onClick={handleCurrentMonth}
								className="cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-2.5 py-1 rounded-lg transition-colors ml-1">
								Mês Atual
							</button>
						</div>
					)}

					{/* Seleção de Ano (quando em modo 'ano') */}
					{periodMode === "ano" && (
						<div className="flex items-center gap-2">
							<CalendarDays size={18} className="text-indigo-600" />
							<span className="text-sm font-black text-slate-800 dark:text-slate-200">
								Exercício de {ano}
							</span>
						</div>
					)}

					{/* Período Customizado */}
					{periodMode === "custom" && (
						<div className="flex items-center gap-2 flex-wrap">
							<input
								type="date"
								value={customStartDate}
								onChange={(e) => setCustomStartDate(e.target.value)}
								className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
							/>
							<span className="text-xs text-slate-400 font-bold">até</span>
							<input
								type="date"
								value={customEndDate}
								onChange={(e) => setCustomEndDate(e.target.value)}
								className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200"
							/>
						</div>
					)}
				</div>
			</div>

			{/* Cards de Métricas: Total Geral e Total por Responsável */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Total Geral */}
				<div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-6 text-white shadow-lg shadow-indigo-500/20 flex flex-col justify-between">
					<div className="flex items-center justify-between">
						<span className="text-xs font-black uppercase tracking-wider text-indigo-200">
							Total de Gastos Pessoais
						</span>
						<span className="p-2 rounded-xl bg-white/10 text-white">
							<Receipt size={18} />
						</span>
					</div>
					<div className="my-3">
						<div className="text-2xl md:text-3xl font-black tracking-tight">
							{formatCurrency(totals.totalGeral)}
						</div>
						<p className="text-xs text-indigo-200 font-bold mt-1">
							{totals.countGeral} lançamento(s) no período
						</p>
					</div>
					<span className="text-[11px] text-indigo-200/80 font-medium">
						Valor a ser ressarcido pela empresa aos sócios.
					</span>
				</div>

				{/* Cards Individuais para Rodrigo, Ana e Edson */}
				{RESPONSAVEIS_COMPRA.map((nome) => {
					const data = totals.porResponsavel[nome];
					const colors = getResponsavelColor(nome);
					const isSelected = selectedResponsavelFilter === nome;

					return (
						<div
							key={nome}
							onClick={() =>
								setSelectedResponsavelFilter(isSelected ? "all" : nome)
							}
							className={`cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 transition-all flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 ${
								isSelected
									? "border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20"
									: "border-slate-200 dark:border-slate-800"
							}`}>
							<div className="flex items-center justify-between">
								<ResponsavelTag nome={nome} size="md" />
								{isSelected && (
									<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
										Filtro Ativo
									</span>
								)}
							</div>

							<div className="my-3">
								<div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">
									{formatCurrency(data.total)}
								</div>
								<p className="text-xs text-slate-400 font-bold mt-1">
									{data.count} compra(s) realizada(s)
								</p>
							</div>

							<div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
								<span className="text-[11px] font-bold text-slate-400">
									{totals.totalGeral > 0
										? `${((data.total / totals.totalGeral) * 100).toFixed(1)}% do total`
										: "0%"}
								</span>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										openNewGastoModal(nome);
									}}
									className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
									<Plus size={12} /> Lançar
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{/* Barra de Filtros e Busca de Gastos */}
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
				{/* Filtro por Tags de Responsável */}
				<div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
					<span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
						<Filter size={14} /> Responsável:
					</span>
					<button
						type="button"
						onClick={() => setSelectedResponsavelFilter("all")}
						className={`cursor-pointer px-3 py-1 rounded-xl text-xs font-black transition-all ${
							selectedResponsavelFilter === "all"
								? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs"
								: "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
						}`}>
						Todos
					</button>

					{RESPONSAVEIS_COMPRA.map((nome) => (
						<ResponsavelTag
							key={nome}
							nome={nome}
							size="md"
							selected={selectedResponsavelFilter === nome}
							onClick={() =>
								setSelectedResponsavelFilter(
									selectedResponsavelFilter === nome ? "all" : nome
								)
							}
						/>
					))}
				</div>

				{/* Busca por Nome do Gasto */}
				<div className="relative w-full sm:w-64">
					<Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Buscar gasto ou detalhe..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						onFocus={handleSelectAll}
						onClick={handleSelectAll}
						className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
					/>
					{searchTerm && (
						<button
							type="button"
							onClick={() => setSearchTerm("")}
							className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
							<X size={14} />
						</button>
					)}
				</div>
			</div>

			{/* Tabela de Lançamentos de Gastos Pessoais */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
				<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
					<div>
						<h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
							<ShoppingBag size={20} className="text-indigo-600" />
							Histórico de Gastos do Período
						</h3>
						<p className="text-xs text-slate-400 font-bold">
							Listagem de compras e despesas pagas pessoalmente com a empresa.
						</p>
					</div>
					<span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
						{filteredGastos.length} registro(s)
					</span>
				</div>

				{filteredGastos.length === 0 ? (
					<div className="py-16 text-center space-y-3">
						<div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
							<Receipt size={24} />
						</div>
						<p className="text-sm font-bold text-slate-500 dark:text-slate-400">
							Nenhum gasto pessoal encontrado para o período e filtros selecionados.
						</p>
						<button
							type="button"
							onClick={() => openNewGastoModal()}
							className="cursor-pointer text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline">
							+ Registrar o primeiro gasto agora
						</button>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left">
							<thead>
								<tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
									<th className="pb-3 pl-2">Data</th>
									<th className="pb-3">Responsável</th>
									<th className="pb-3">Gasto / Descrição</th>
									<th className="pb-3 hidden md:table-cell">Observações</th>
									<th className="pb-3 text-right">Valor</th>
									<th className="pb-3 text-right pr-2">Ações</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs md:text-sm">
								{filteredGastos.map((gasto) => (
									<tr
										key={gasto.id}
										className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
										{/* Data */}
										<td className="py-3.5 pl-2 font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
											{formatDateDisplay(gasto.data)}
										</td>

										{/* Responsável Tag */}
										<td className="py-3.5 whitespace-nowrap">
											<ResponsavelTag nome={gasto.responsavel} size="md" />
										</td>

										{/* Nome do Gasto */}
										<td className="py-3.5 font-black text-slate-800 dark:text-slate-100">
											<span>{gasto.nome}</span>
										</td>

										{/* Observações */}
										<td className="py-3.5 text-xs text-slate-400 dark:text-slate-500 hidden md:table-cell max-w-[200px] truncate">
											{gasto.observacoes || "-"}
										</td>

										{/* Valor */}
										<td className="py-3.5 text-right font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
											{formatCurrency(gasto.valor)}
										</td>

										{/* Ações (Editar e Deletar) */}
										<td className="py-3.5 text-right pr-2 whitespace-nowrap">
											<div className="flex items-center justify-end gap-1">
												<button
													type="button"
													onClick={() => openEditGastoModal(gasto)}
													className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
													title="Editar gasto">
													<Edit2 size={15} />
												</button>
												<button
													type="button"
													onClick={() => setDeletingId(gasto.id)}
													className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
													title="Excluir gasto">
													<Trash2 size={15} />
												</button>
											</div>
										</td>
									</tr>
								))}

								{/* Linha de Totalizador no rodapé da tabela */}
								<tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 font-black">
									<td className="py-4 pl-2 uppercase text-slate-800 dark:text-slate-100" colSpan={2}>
										Total ({filteredGastos.length} itens)
									</td>
									<td className="py-4 text-xs text-slate-400" colSpan={2}>
										{selectedResponsavelFilter !== "all"
											? `Filtrado por: ${selectedResponsavelFilter}`
											: "Todos os responsáveis"}
									</td>
									<td className="py-4 text-right text-base text-indigo-600 dark:text-indigo-400 font-black whitespace-nowrap">
										{formatCurrency(totals.totalGeral)}
									</td>
									<td className="py-4 pr-2"></td>
								</tr>
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* MODAL: CRIAR / EDITAR GASTO PESSOAL */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
						<div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
									{editingGasto ? <Edit2 size={20} /> : <Plus size={20} />}
								</div>
								<div>
									<h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
										{editingGasto ? "Editar Gasto Pessoal" : "Novo Gasto Pessoal"}
									</h3>
									<p className="text-xs text-slate-400 font-bold">
										Despesa paga pessoalmente para compras da empresa
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setIsModalOpen(false)}
								className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
								<X size={20} />
							</button>
						</div>

						<form onSubmit={handleSaveGasto} className="space-y-4">
							{/* Nome do Gasto */}
							<div className="space-y-1">
								<label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
									Nome do Gasto / Compra *
								</label>
								<input
									type="text"
									required
									value={formNome}
									onChange={(e) => setFormNome(e.target.value)}
									onFocus={handleSelectAll}
									onClick={handleSelectAll}
									placeholder="Ex: Embalagens extras atacado, Café, Manutenção..."
									className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								/>
							</div>

							{/* Valor e Data */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="space-y-1">
									<label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
										Valor (R$) *
									</label>
									<div className="relative">
										<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
											R$
										</span>
										<input
											type="text"
											required
											value={formValor}
											onChange={(e) => setFormValor(e.target.value)}
											onFocus={handleSelectAll}
											onClick={handleSelectAll}
											placeholder="0,00"
											className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
								</div>

								<div className="space-y-1">
									<label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
										Data do Gasto *
									</label>
									<input
										type="date"
										required
										value={formDataGasto}
										onChange={(e) => setFormDataGasto(e.target.value)}
										className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
									/>
								</div>
							</div>

							{/* Seleção do Responsável (Tags: Rodrigo, Ana, Edson) */}
							<div className="space-y-1.5 pt-1">
								<label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
									Quem Realizou o Pagamento? (Tag do Responsável) *
								</label>
								<div className="grid grid-cols-3 gap-2">
									{RESPONSAVEIS_COMPRA.map((nome) => {
										const isSelected = formResponsavel === nome;
										const colors = getResponsavelColor(nome);
										return (
											<button
												key={nome}
												type="button"
												onClick={() => setFormResponsavel(nome)}
												className={`cursor-pointer py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
													isSelected
														? `${colors.activeBg} shadow-sm ring-2 ring-indigo-500/20`
														: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300"
												}`}>
												<span
													className={`w-2 h-2 rounded-full ${
														isSelected ? "bg-white" : colors.dot
													}`}
												/>
												<span>{nome}</span>
											</button>
										);
									})}
								</div>
							</div>

							{/* Observações Opcionais */}
							<div className="space-y-1">
								<label className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
									Observações / Detalhes (opcional)
								</label>
								<textarea
									rows={2}
									value={formObservacoes}
									onChange={(e) => setFormObservacoes(e.target.value)}
									placeholder="Ex: Pago no Pix pessoal, cupom guardado..."
									className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
								/>
							</div>

							{/* Ações */}
							<div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
								<button
									type="submit"
									disabled={isSaving || !formNome.trim() || !formValor.trim()}
									className="cursor-pointer flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm active:scale-95">
									{isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
									<span>{editingGasto ? "Salvar Alterações" : "Salvar Lançamento"}</span>
								</button>
								<button
									type="button"
									onClick={() => setIsModalOpen(false)}
									disabled={isSaving}
									className="cursor-pointer px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold py-3.5 rounded-2xl transition-all text-sm">
									Cancelar
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* MODAL: CONFIRMAR EXCLUSÃO DE GASTO */}
			{deletingId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800 text-center">
						<div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
							<Trash2 size={28} />
						</div>
						<h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">
							Excluir Gasto Pessoal
						</h3>
						<p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
							Tem certeza que deseja excluir este lançamento? Esta ação não poderá ser desfeita.
						</p>
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={handleConfirmDelete}
								disabled={isDeleting}
								className="cursor-pointer w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5">
								{isDeleting ? <Loader2 className="animate-spin" size={14} /> : null}
								<span>Sim, excluir lançamento</span>
							</button>
							<button
								type="button"
								onClick={() => setDeletingId(null)}
								disabled={isDeleting}
								className="cursor-pointer w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs transition-all">
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
