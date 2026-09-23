"use client";

import { useState, useMemo } from "react";
import {
	Funcionario,
	LancamentoFinanceiro,
	TipoLancamentoFinanceiro,
	TIPO_LANCAMENTO_CONFIG,
	EscalaItem,
} from "@/types/funcionarios";
import { STORE_NAMES, StoreId } from "@/types";
import {
	createLancamentoFinanceiro,
	updateLancamentoFinanceiro,
	deleteLancamentoFinanceiro,
} from "@/lib/funcionarios-service";
import {
	DollarSign,
	TrendingUp,
	TrendingDown,
	Wallet,
	Plus,
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Search,
	Filter,
	Sparkles,
	CheckCircle2,
	Clock,
	AlertCircle,
	Trash2,
	Edit2,
	X,
	Copy,
	Check,
	FileText,
	ChevronDown,
	ChevronUp,
	Building2,
	CalendarDays,
	User,
} from "lucide-react";

interface FinanceiroTabProps {
	funcionarios: Funcionario[];
	lancamentos: LancamentoFinanceiro[];
	escalas?: EscalaItem[];
	mesAnoStr: string; // YYYY-MM
	onChangeMesAno: (novoMesAno: string) => void;
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

export default function FinanceiroTab({
	funcionarios,
	lancamentos,
	escalas = [],
	mesAnoStr,
	onChangeMesAno,
}: FinanceiroTabProps) {
	const [viewMode, setViewMode] = useState<"colaboradores" | "extrato">("colaboradores");
	const [searchTerm, setSearchTerm] = useState("");
	const [filterLoja, setFilterLoja] = useState<string>("todas");
	const [filterFuncionario, setFilterFuncionario] = useState<string>("todos");
	const [filterTipo, setFilterTipo] = useState<string>("todos");
	const [filterStatus, setFilterStatus] = useState<string>("todos");
	const [expandedFuncId, setExpandedFuncId] = useState<string | null>(null);

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingLancamento, setEditingLancamento] = useState<LancamentoFinanceiro | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [copiedPixId, setCopiedPixId] = useState<string | null>(null);

	// Form State
	const [formData, setFormData] = useState({
		funcionarioId: "",
		tipo: "salario" as TipoLancamentoFinanceiro,
		descricao: "",
		valor: "",
		data: "",
		mesReferencia: mesAnoStr,
		status: "pendente" as "pendente" | "pago" | "cancelado",
		metodoPagamento: "pix" as "pix" | "dinheiro" | "transferencia" | "outro",
		observacoes: "",
	});

	// Navegação de Mês
	const [ano, mes] = mesAnoStr.split("-").map(Number);

	const handlePrevMonth = () => {
		let novoAno = ano;
		let novoMes = mes - 1;
		if (novoMes < 1) {
			novoMes = 12;
			novoAno--;
		}
		const novoStr = `${novoAno}-${String(novoMes).padStart(2, "0")}`;
		onChangeMesAno(novoStr);
	};

	const handleNextMonth = () => {
		let novoAno = ano;
		let novoMes = mes + 1;
		if (novoMes > 12) {
			novoMes = 1;
			novoAno++;
		}
		const novoStr = `${novoAno}-${String(novoMes).padStart(2, "0")}`;
		onChangeMesAno(novoStr);
	};

	const handleCurrentMonth = () => {
		const now = new Date();
		onChangeMesAno(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
	};

	// Contagem de dias trabalhados escalados no mês por funcionário (exclui folgas)
	const diasEscaladosPorFunc = useMemo(() => {
		const map: Record<string, number> = {};
		escalas.forEach((e) => {
			if (
				e.data.startsWith(mesAnoStr) &&
				e.turno !== "folga" &&
				(Boolean(e.horarioInicio) || Boolean(e.horarioFim))
			) {
				map[e.funcionarioId] = (map[e.funcionarioId] || 0) + 1;
			}
		});
		return map;
	}, [escalas, mesAnoStr]);

	// Mapa auxiliar para obter loja de qualquer funcionário
	const funcLojaMap = useMemo(() => {
		const map: Record<string, StoreId | "todas"> = {};
		funcionarios.forEach((f) => {
			map[f.id] = f.lojaId;
		});
		return map;
	}, [funcionarios]);

	// Colaborador selecionado no filtro (se houver)
	const selectedFuncionario = useMemo(() => {
		if (filterFuncionario === "todos") return null;
		return funcionarios.find((f) => f.id === filterFuncionario) || null;
	}, [funcionarios, filterFuncionario]);

	// Colaboradores disponíveis para seleção considerando a loja selecionada
	const funcionariosDisponiveis = useMemo(() => {
		if (filterLoja === "todas") return funcionarios;
		return funcionarios.filter((f) => f.lojaId === "todas" || f.lojaId === filterLoja);
	}, [funcionarios, filterLoja]);

	// Consolidação por Colaborador com Cálculo Automático e Constante de Salário e Vale-Transporte
	const colaboradoresFinanceiro = useMemo(() => {
		return funcionarios.map((func) => {
			const funcLancamentos = lancamentos.filter(
				(l) => l.funcionarioId === func.id && l.status !== "cancelado"
			);

			const diasTrabalhados = diasEscaladosPorFunc[func.id] || 0;

			// Salário e Vale-Transporte calculados de forma automática e constante:
			// Colaboradores não-inativos recebem o salário base e o VT diário multiplicado pelos dias trabalhados/escalados
			const isAtivoOuFerias = func.status !== "inativo";
			const salarioBaseAutomatico = isAtivoOuFerias ? Number(func.salarioBase || 0) : 0;
			const vtAutomatico = isAtivoOuFerias
				? Number(((func.valeTransporte || 0) * diasTrabalhados).toFixed(2))
				: 0;

			let salariosManuais = 0;
			let vtManuais = 0;
			let retiradas = 0;
			let bonus = 0;
			let descontos = 0;
			let gastosPontuais = 0;
			let pagamentos = 0;

			funcLancamentos.forEach((l) => {
				// Ignora lançamentos gerados antigamente pelo botão automático para não duplicar com os automáticos constantes
				const isOldAuto =
					l.observacoes?.includes("Gerado automaticamente") ||
					l.observacoes?.includes("Calculado automaticamente");

				if (l.tipo === "salario") {
					if (!isOldAuto) salariosManuais += l.valor;
				} else if (l.tipo === "vale_transporte") {
					if (!isOldAuto) vtManuais += l.valor;
				} else if (l.tipo === "retirada") {
					retiradas += l.valor;
				} else if (l.tipo === "bonus") {
					bonus += l.valor;
				} else if (l.tipo === "desconto") {
					descontos += l.valor;
				} else if (l.tipo === "gasto_pontual") {
					gastosPontuais += l.valor;
				} else if (l.tipo === "pagamento_realizado") {
					pagamentos += l.valor;
				}
			});

			const salarios = salarioBaseAutomatico + salariosManuais;
			const vt = vtAutomatico + vtManuais;

			// Total Líquido a Pagar do Colaborador: Proventos (Salário + VT + Bônus + Reembolsos) - Deduções (Retiradas + Descontos)
			const liquido = salarios + vt + bonus + gastosPontuais - retiradas - descontos;
			const saldoPendente = Math.max(0, liquido - pagamentos);

			return {
				funcionario: func,
				lancamentos: funcLancamentos,
				salarios,
				salarioBaseAutomatico,
				salariosManuais,
				vt,
				vtAutomatico,
				vtManuais,
				retiradas,
				bonus,
				descontos,
				gastosPontuais,
				pagamentos,
				liquido,
				saldoPendente,
				diasTrabalhados,
				isQuitado: liquido > 0 && pagamentos >= liquido,
			};
		});
	}, [funcionarios, lancamentos, diasEscaladosPorFunc]);

	// Cálculos dos Somatórios Gerais e Filtrados por Loja e por Funcionário
	const totals = useMemo(() => {
		let totalSalarios = 0;
		let totalVT = 0;
		let totalRetiradas = 0;
		let totalBonus = 0;
		let totalDescontos = 0;
		let totalGastosPontuais = 0;
		let totalPago = 0;

		colaboradoresFinanceiro.forEach((item) => {
			const { funcionario: func } = item;

			// Filtra pela loja selecionada
			if (filterLoja !== "todas") {
				if (func.lojaId !== "todas" && func.lojaId !== filterLoja) {
					return;
				}
			}

			// Filtra por colaborador selecionado
			if (filterFuncionario !== "todos") {
				if (func.id !== filterFuncionario) {
					return;
				}
			}

			totalSalarios += item.salarios;
			totalVT += item.vt;
			totalRetiradas += item.retiradas;
			totalBonus += item.bonus;
			totalDescontos += item.descontos;
			totalGastosPontuais += item.gastosPontuais;
			totalPago += item.pagamentos;
		});

		// Total Líquido a Pagar: Proventos - Deduções
		const totalLiquido =
			totalSalarios + totalVT + totalBonus + totalGastosPontuais - totalRetiradas - totalDescontos;
		const totalPendente = Math.max(0, totalLiquido - totalPago);

		return {
			totalSalarios,
			totalVT,
			totalRetiradas,
			totalBonus,
			totalDescontos,
			totalGastosPontuais,
			totalLiquido,
			totalPago,
			totalPendente,
		};
	}, [colaboradoresFinanceiro, filterLoja, filterFuncionario]);

	// Filtros da Visão Colaboradores
	const filteredColaboradores = useMemo(() => {
		return colaboradoresFinanceiro.filter((item) => {
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				item.funcionario.nome.toLowerCase().includes(searchLower) ||
				(item.funcionario.apelido &&
					item.funcionario.apelido.toLowerCase().includes(searchLower)) ||
				item.funcionario.cargo.toLowerCase().includes(searchLower);

			const matchesLoja =
				filterLoja === "todas" ||
				item.funcionario.lojaId === "todas" ||
				item.funcionario.lojaId === filterLoja;

			const matchesFuncionario =
				filterFuncionario === "todos" || item.funcionario.id === filterFuncionario;

			// Filtro por tipo de custo específico quando na visão colaboradores
			let matchesTipoCusto = true;
			if (filterTipo === "salario") matchesTipoCusto = item.salarios > 0;
			else if (filterTipo === "vale_transporte") matchesTipoCusto = item.vt > 0;
			else if (filterTipo === "retirada") matchesTipoCusto = item.retiradas > 0;
			else if (filterTipo === "bonus") matchesTipoCusto = item.bonus > 0;
			else if (filterTipo === "desconto") matchesTipoCusto = item.descontos > 0;
			else if (filterTipo === "gasto_pontual") matchesTipoCusto = item.gastosPontuais > 0;
			else if (filterTipo === "pagamento_realizado") matchesTipoCusto = item.pagamentos > 0;

			// Filtro de status de pagamento
			let matchesStatusFilter = true;
			if (filterStatus === "pago") matchesStatusFilter = item.isQuitado;
			else if (filterStatus === "pendente") matchesStatusFilter = !item.isQuitado;

			return (
				matchesSearch &&
				matchesLoja &&
				matchesFuncionario &&
				matchesTipoCusto &&
				matchesStatusFilter
			);
		});
	}, [colaboradoresFinanceiro, searchTerm, filterLoja, filterFuncionario, filterTipo, filterStatus]);

	// Filtros da Visão Extrato Geral
	const filteredLancamentos = useMemo(() => {
		return lancamentos.filter((l) => {
			const searchLower = searchTerm.toLowerCase();
			const matchesSearch =
				l.funcionarioNome.toLowerCase().includes(searchLower) ||
				l.descricao.toLowerCase().includes(searchLower) ||
				(l.observacoes && l.observacoes.toLowerCase().includes(searchLower));

			const itemLoja = l.lojaId || funcLojaMap[l.funcionarioId];
			const matchesLoja =
				filterLoja === "todas" ||
				!itemLoja ||
				itemLoja === "todas" ||
				itemLoja === filterLoja;

			const matchesFuncionario =
				filterFuncionario === "todos" || l.funcionarioId === filterFuncionario;

			const matchesTipo = filterTipo === "todos" || l.tipo === filterTipo;
			const matchesStatus = filterStatus === "todos" || l.status === filterStatus;

			return matchesSearch && matchesLoja && matchesFuncionario && matchesTipo && matchesStatus;
		});
	}, [lancamentos, searchTerm, filterLoja, filterFuncionario, filterTipo, filterStatus, funcLojaMap]);

	// Ações do Modal de Lançamento
	const openCreateModal = (prefillFuncId?: string, defaultTipo?: TipoLancamentoFinanceiro) => {
		setEditingLancamento(null);
		const func = funcionarios.find((f) => f.id === prefillFuncId) || funcionarios[0];
		const tipo = defaultTipo || "retirada";
		const config = TIPO_LANCAMENTO_CONFIG[tipo];

		const today = new Date().toISOString().split("T")[0];

		// Sugestão de valor inteligente baseado no tipo e escala
		let valorSugerido = "";
		if (func) {
			if (tipo === "salario") {
				valorSugerido = func.salarioBase ? String(func.salarioBase) : "";
			} else if (tipo === "vale_transporte") {
				const dias = diasEscaladosPorFunc[func.id] || 0;
				if (dias > 0 && func.valeTransporte > 0) {
					valorSugerido = (func.valeTransporte * dias).toFixed(2);
				} else if (func.valeTransporte > 0) {
					valorSugerido = String(func.valeTransporte);
				}
			}
		}

		setFormData({
			funcionarioId: func ? func.id : "",
			tipo,
			descricao: config.label,
			valor: valorSugerido,
			data: today,
			mesReferencia: mesAnoStr,
			status: tipo === "pagamento_realizado" ? "pago" : "pendente",
			metodoPagamento: "pix",
			observacoes: "",
		});
		setIsModalOpen(true);
	};

	const openEditModal = (lancamento: LancamentoFinanceiro) => {
		setEditingLancamento(lancamento);
		setFormData({
			funcionarioId: lancamento.funcionarioId,
			tipo: lancamento.tipo,
			descricao: lancamento.descricao,
			valor: String(lancamento.valor),
			data: lancamento.data,
			mesReferencia: lancamento.mesReferencia,
			status: lancamento.status,
			metodoPagamento: lancamento.metodoPagamento || "pix",
			observacoes: lancamento.observacoes || "",
		});
		setIsModalOpen(true);
	};

	const handleTipoChange = (newTipo: TipoLancamentoFinanceiro) => {
		const config = TIPO_LANCAMENTO_CONFIG[newTipo];
		const func = funcionarios.find((f) => f.id === formData.funcionarioId);
		let valorSugerido = formData.valor;

		if (func) {
			if (newTipo === "salario") {
				valorSugerido = func.salarioBase ? String(func.salarioBase) : formData.valor;
			} else if (newTipo === "vale_transporte") {
				const dias = diasEscaladosPorFunc[func.id] || 0;
				if (dias > 0 && func.valeTransporte > 0) {
					valorSugerido = (func.valeTransporte * dias).toFixed(2);
				} else if (func.valeTransporte > 0) {
					valorSugerido = String(func.valeTransporte);
				}
			}
		}

		setFormData((prev) => ({
			...prev,
			tipo: newTipo,
			descricao: config.label,
			valor: valorSugerido,
			status: newTipo === "pagamento_realizado" ? "pago" : prev.status,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.funcionarioId || !formData.valor) return;

		const func = funcionarios.find((f) => f.id === formData.funcionarioId);
		if (!func) return;

		try {
			setIsSaving(true);
			const payload = {
				funcionarioId: func.id,
				funcionarioNome: func.apelido || func.nome,
				lojaId: func.lojaId,
				tipo: formData.tipo,
				descricao: formData.descricao.trim() || TIPO_LANCAMENTO_CONFIG[formData.tipo].label,
				valor: parseFloat(formData.valor) || 0,
				data: formData.data || new Date().toISOString().split("T")[0],
				mesReferencia: formData.mesReferencia || mesAnoStr,
				status: formData.status,
				metodoPagamento: formData.metodoPagamento,
				observacoes: formData.observacoes.trim() || undefined,
			};

			if (editingLancamento) {
				await updateLancamentoFinanceiro(editingLancamento.id, payload);
			} else {
				await createLancamentoFinanceiro(payload);
			}

			setIsModalOpen(false);
		} catch (error) {
			console.error("Erro ao salvar lançamento financeiro:", error);
			alert("Erro ao salvar lançamento.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
		try {
			await deleteLancamentoFinanceiro(id);
			if (editingLancamento?.id === id) {
				setIsModalOpen(false);
			}
		} catch (error) {
			console.error("Erro ao excluir lançamento:", error);
			alert("Erro ao excluir lançamento.");
		}
	};

	const copyPix = (pix: string, id: string) => {
		navigator.clipboard.writeText(pix);
		setCopiedPixId(id);
		setTimeout(() => setCopiedPixId(null), 2000);
	};

	const lojaLabelAtual =
		filterLoja === "todas" ? "Todas as Lojas" : STORE_NAMES[filterLoja as StoreId] || filterLoja;

	return (
		<div className="space-y-6">
			{/* SUB-ABAS DE SELEÇÃO DE CUSTOS (GERAL OU POR LOJA) - ACIMA DA SELEÇÃO DO MÊS */}
			<div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto border border-slate-200/80 dark:border-slate-800">
				<button
					onClick={() => {
						setFilterLoja("todas");
					}}
					className={`cursor-pointer px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
						filterLoja === "todas"
							? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
							: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
					}`}>
					<Building2 size={16} />
					<span>Geral (Todas as Lojas)</span>
				</button>
				{Object.entries(STORE_NAMES).map(([id, name]) => {
					const isActive = filterLoja === id;
					return (
						<button
							key={id}
							onClick={() => {
								setFilterLoja(id);
								// Se o colaborador selecionado não pertencer à nova loja, reseta o filtro de colaborador
								if (filterFuncionario !== "todos") {
									const func = funcionarios.find((f) => f.id === filterFuncionario);
									if (func && func.lojaId !== "todas" && func.lojaId !== id) {
										setFilterFuncionario("todos");
									}
								}
							}}
							className={`cursor-pointer px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
								isActive
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							<span>{name}</span>
						</button>
					);
				})}
			</div>

			{/* BARRA SUPERIOR DE NAVEGAÇÃO DE MÊS E AÇÕES RÁPIDAS */}
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
				{/* Seletor do Mês/Ano */}
				<div className="flex items-center gap-2">
					<button
						onClick={handlePrevMonth}
						aria-label="Mês anterior"
						className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
						<ChevronLeft size={20} />
					</button>

					<div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
						<CalendarIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
						<span className="text-base font-black text-slate-800 dark:text-slate-200">
							{MESES[mes - 1]} {ano}
						</span>
					</div>

					<button
						onClick={handleNextMonth}
						aria-label="Próximo mês"
						className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
						<ChevronRight size={20} />
					</button>

					<button
						onClick={handleCurrentMonth}
						className="cursor-pointer ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 px-3 py-1.5 rounded-lg transition-colors">
						Mês Atual
					</button>
				</div>

				{/* Botões de Ação */}
				<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
					<button
						onClick={() => openCreateModal()}
						className="cursor-pointer px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 text-xs">
						<Plus size={16} />
						<span>Novo Lançamento</span>
					</button>
				</div>
			</div>

			{/* CARDS DE RESUMOS E SOMATÓRIOS DO MÊS (Geral ou por Loja) */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1 flex-wrap gap-2">
					<span className="flex items-center gap-1.5">
						<Building2 size={14} className="text-blue-600 dark:text-blue-400" />
						Custos para: <strong className="text-slate-800 dark:text-slate-200">{lojaLabelAtual}</strong>
						{selectedFuncionario && (
							<>
								<span className="text-slate-400">•</span>
								<span className="text-blue-600 dark:text-blue-400 font-bold">
									Colaborador: {selectedFuncionario.nome}
								</span>
							</>
						)}
					</span>
					<div className="flex items-center gap-2">
						{filterFuncionario !== "todos" && (
							<button
								onClick={() => setFilterFuncionario("todos")}
								className="cursor-pointer text-2xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold">
								<span>Colaborador: {selectedFuncionario?.nome || "Filtro ativo"} (Limpar)</span>
								<X size={12} />
							</button>
						)}
						{filterTipo !== "todos" && (
							<button
								onClick={() => setFilterTipo("todos")}
								className="cursor-pointer text-2xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold">
								<span>Filtro tipo: {TIPO_LANCAMENTO_CONFIG[filterTipo as TipoLancamentoFinanceiro]?.label} (Limpar)</span>
								<X size={12} />
							</button>
						)}
					</div>
				</div>

				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{/* Salários Previstos */}
					<div
						onClick={() => setFilterTipo(filterTipo === "salario" ? "todos" : "salario")}
						title="Clique para filtrar apenas custos com Salário Base"
						className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
							filterTipo === "salario"
								? "ring-2 ring-blue-500 border-blue-400 bg-blue-50/20"
								: "border-slate-200 dark:border-slate-800 hover:border-slate-300"
						}`}>
						<div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
							<span>Salários Base</span>
							<span className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
								<DollarSign size={16} />
							</span>
						</div>
						<p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
							R$ {totals.totalSalarios.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
						</p>
						<span className="text-[11px] text-slate-400 block mt-0.5">
							{filterTipo === "salario" ? "● Filtro ativo" : "Clique p/ filtrar"}
						</span>
					</div>

					{/* Vale-Transporte */}
					<div
						onClick={() => setFilterTipo(filterTipo === "vale_transporte" ? "todos" : "vale_transporte")}
						title="Clique para filtrar apenas custos com Vale-Transporte"
						className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
							filterTipo === "vale_transporte"
								? "ring-2 ring-teal-500 border-teal-400 bg-teal-50/20"
								: "border-slate-200 dark:border-slate-800 hover:border-slate-300"
						}`}>
						<div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
							<span>Vale-Transporte</span>
							<span className="p-1.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-lg">
								<TrendingUp size={16} />
							</span>
						</div>
						<p className="text-xl font-black text-teal-600 dark:text-teal-400 mt-1">
							R$ {totals.totalVT.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
						</p>
						<span className="text-[11px] text-slate-400 block mt-0.5">
							{filterTipo === "vale_transporte" ? "● Filtro ativo" : "Por diárias escaladas"}
						</span>
					</div>

					{/* Retiradas / Adiantamentos */}
					<div
						onClick={() => setFilterTipo(filterTipo === "retirada" ? "todos" : "retirada")}
						title="Clique para filtrar apenas Adiantamentos / Retiradas"
						className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md ${
							filterTipo === "retirada"
								? "ring-2 ring-amber-500 border-amber-400 bg-amber-50/20"
								: "border-slate-200 dark:border-slate-800 hover:border-slate-300"
						}`}>
						<div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
							<span>Adiantamentos / Retiradas</span>
							<span className="p-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
								<TrendingDown size={16} />
							</span>
						</div>
						<p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
							R$ {totals.totalRetiradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
						</p>
						<span className="text-[11px] text-slate-400 block mt-0.5">
							{filterTipo === "retirada" ? "● Filtro ativo" : "Deduções efetuadas"}
						</span>
					</div>

					{/* Total Líquido a Pagar */}
					<div
						onClick={() => setFilterTipo("todos")}
						title="Exibe o custo líquido consolidado (salários + VT + extras - retiradas - descontos)"
						className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
						<div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
							<span>Custo Líquido da Folha</span>
							<span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
								<Wallet size={16} />
							</span>
						</div>
						<p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
							R$ {totals.totalLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
						</p>
						<span className="text-[11px] text-slate-400 block">
							R$ {totals.totalPago.toFixed(2)} pago • R$ {totals.totalPendente.toFixed(2)} pendente
						</span>
					</div>
				</div>
			</div>

			{/* ALTERNAR ENTRE VISÃO POR COLABORADOR E EXTRATO GERAL */}
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
					<button
						onClick={() => setViewMode("colaboradores")}
						className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
							viewMode === "colaboradores"
								? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
								: "text-slate-500 hover:text-slate-800 dark:text-slate-400"
						}`}>
						<Wallet size={16} />
						<span>Por Colaborador ({filteredColaboradores.length})</span>
					</button>
					<button
						onClick={() => setViewMode("extrato")}
						className={`cursor-pointer px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
							viewMode === "extrato"
								? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
								: "text-slate-500 hover:text-slate-800 dark:text-slate-400"
						}`}>
						<FileText size={16} />
						<span>Extrato de Lançamentos ({filteredLancamentos.length})</span>
					</button>
				</div>

				{/* Filtros por Loja, Tipo de Custo e Busca */}
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Buscar colaborador ou descrição..."
							className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<select
						value={filterFuncionario}
						onChange={(e) => setFilterFuncionario(e.target.value)}
						aria-label="Filtrar custos por colaborador"
						className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
						<option value="todos">Todos os Funcionários</option>
						{funcionariosDisponiveis.map((f) => (
							<option key={f.id} value={f.id}>
								{f.nome} {f.apelido ? `(${f.apelido})` : ""}
							</option>
						))}
					</select>

					<select
						value={filterTipo}
						onChange={(e) => setFilterTipo(e.target.value)}
						aria-label="Filtrar por custo específico"
						className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
						<option value="todos">Todos os Custos</option>
						<option value="salario">Salário Base</option>
						<option value="vale_transporte">Vale-Transporte</option>
						<option value="bonus">Bonificação / Extra</option>
						<option value="retirada">Adiantamentos / Vales</option>
						<option value="desconto">Descontos</option>
						<option value="pagamento_realizado">Pagamentos Efetuados</option>
					</select>
				</div>
			</div>

			{/* ================= VISÃO 1: POR COLABORADOR ================= */}
			{viewMode === "colaboradores" && (
				<div className="space-y-4">
					{filteredColaboradores.length === 0 ? (
						<div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-500">
							Nenhum colaborador encontrado com os filtros selecionados.
						</div>
					) : (
						filteredColaboradores.map((item) => {
							const { funcionario: func } = item;
							const isExpanded = expandedFuncId === func.id;

							return (
								<div
									key={func.id}
									className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
									{/* Linha Resumo do Colaborador */}
									<div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
										<div className="flex items-center gap-3 min-w-0">
											<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 uppercase">
												{func.nome.substring(0, 2)}
											</div>
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<h4 className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">
														{func.nome}
													</h4>
													{func.apelido && (
														<span className="text-xs text-slate-400">({func.apelido})</span>
													)}
												</div>
												<div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
													<span>{func.cargo}</span>
													<span>•</span>
													<span>
														{func.lojaId === "todas"
															? "Todas as Lojas"
															: STORE_NAMES[func.lojaId] || func.lojaId}
													</span>
													{func.chavePix && (
														<>
															<span>•</span>
															<button
																onClick={() => copyPix(func.chavePix!, func.id)}
																title="Copiar Chave PIX"
																className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline">
																<span>PIX</span>
																{copiedPixId === func.id ? (
																	<Check size={12} className="text-emerald-500" />
																) : (
																	<Copy size={12} />
																)}
															</button>
														</>
													)}
												</div>
											</div>
										</div>

										{/* Valores Consolidados com breakdown específico */}
										<div className="flex flex-wrap items-center gap-3 text-xs">
											{item.diasTrabalhados > 0 && (
												<div className="text-right px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60" title={`${item.diasTrabalhados} dias com turno escalado no mês de ${MESES[mes - 1]}`}>
													<span className="text-slate-400 block text-2xs">Escala do Mês</span>
													<span className="font-bold text-blue-600 dark:text-blue-400">
														{item.diasTrabalhados} {item.diasTrabalhados === 1 ? "dia" : "dias"}
													</span>
												</div>
											)}

											<div className="text-right">
												<span className="text-slate-400 block text-2xs">Salário Base</span>
												<span className="font-bold text-slate-700 dark:text-slate-300">
													R$ {item.salarios.toFixed(2)}
												</span>
											</div>

											{item.vt > 0 && (
												<div className="text-right">
													<span className="text-teal-600 dark:text-teal-400 block text-2xs">Vale-Transporte</span>
													<span className="font-bold text-teal-700 dark:text-teal-300">
														R$ {item.vt.toFixed(2)}
													</span>
												</div>
											)}

											{item.bonus > 0 && (
												<div className="text-right">
													<span className="text-emerald-500 block text-2xs">Extra/Bônus</span>
													<span className="font-bold text-emerald-600 dark:text-emerald-400">
														+ R$ {item.bonus.toFixed(2)}
													</span>
												</div>
											)}

											{item.retiradas > 0 && (
												<div className="text-right">
													<span className="text-amber-500 block text-2xs">Adiantamento</span>
													<span className="font-bold text-amber-600 dark:text-amber-400">
														- R$ {item.retiradas.toFixed(2)}
													</span>
												</div>
											)}

											{item.descontos > 0 && (
												<div className="text-right">
													<span className="text-rose-500 block text-2xs">Descontos</span>
													<span className="font-bold text-rose-600 dark:text-rose-400">
														- R$ {item.descontos.toFixed(2)}
													</span>
												</div>
											)}

											<div className="text-right pl-2 border-l border-slate-200 dark:border-slate-800">
												<span className="text-slate-400 block text-2xs">Líquido a Pagar</span>
												<span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
													R$ {item.liquido.toFixed(2)}
												</span>
											</div>

											{/* Status Quitado / Pendente */}
											<span
												className={`px-2.5 py-1 rounded-full text-2xs font-black uppercase ${
													item.isQuitado
														? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
														: item.pagamentos > 0
														? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
														: "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
												}`}>
												{item.isQuitado
													? "Quitado"
													: item.pagamentos > 0
													? `Parcial (-R$${item.pagamentos.toFixed(0)})`
													: "Pendente"}
											</span>

											{/* Ações Rápidas de Cadastro de Custos */}
											<div className="flex items-center gap-1.5">
												<button
													onClick={() => openCreateModal(func.id)}
													className="cursor-pointer px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold rounded-lg text-2xs transition-colors"
													title="Adicionar Custo para este Colaborador (Salário, VT, Bônus, Adiantamento, Desconto)">
													+ Custo
												</button>

												<button
													onClick={() => openCreateModal(func.id, "pagamento_realizado")}
													className="cursor-pointer px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold rounded-lg text-2xs transition-colors"
													title="Registrar Pagamento Efetuado / Baixa">
													Pagar
												</button>

												<button
													onClick={() =>
														setExpandedFuncId(isExpanded ? null : func.id)
													}
													className="cursor-pointer p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
													{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
												</button>
											</div>
										</div>
									</div>

									{/* Extrato Detalhado do Colaborador (Expandido) */}
									{isExpanded && (
										<div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3">
											<div className="flex items-center justify-between">
												<span className="text-xs font-bold text-slate-700 dark:text-slate-300">
													Extrato de Lançamentos ({item.lancamentos.length})
												</span>
												<button
													onClick={() => openCreateModal(func.id)}
													className="cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
													<Plus size={14} />
													<span>Adicionar Item</span>
												</button>
											</div>

											{item.lancamentos.length === 0 ? (
												<p className="text-xs text-slate-400 italic">
													Nenhum lançamento registrado para este colaborador no mês de{" "}
													{MESES[mes - 1]}.
												</p>
											) : (
												<div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
													{item.lancamentos.map((lanc) => {
														const conf =
															TIPO_LANCAMENTO_CONFIG[lanc.tipo] ||
															TIPO_LANCAMENTO_CONFIG.salario;

														return (
															<div
																key={lanc.id}
																className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
																<div className="flex items-center gap-2.5 min-w-0">
																	<span
																		className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${conf.badgeBg} ${conf.badgeText}`}>
																		{conf.label}
																	</span>
																	<span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
																		{lanc.descricao}
																	</span>
																	<span className="text-slate-400 text-2xs">
																		{lanc.data.split("-").reverse().join("/")}
																	</span>
																	{lanc.observacoes && (
																		<span className="text-slate-400 text-2xs italic">
																			({lanc.observacoes})
																		</span>
																	)}
																</div>

																<div className="flex items-center gap-3">
																	<span
																		className={`font-black ${
																			conf.isProvento
																				? "text-emerald-600 dark:text-emerald-400"
																				: lanc.tipo === "pagamento_realizado"
																				? "text-purple-600 dark:text-purple-400"
																				: "text-amber-600 dark:text-amber-400"
																		}`}>
																		{conf.isProvento ? "+" : "-"}{" "}
																		R$ {lanc.valor.toFixed(2)}
																	</span>

																	<button
																		onClick={() => openEditModal(lanc)}
																		className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-600">
																		<Edit2 size={13} />
																	</button>

																	<button
																		onClick={() => handleDelete(lanc.id)}
																		className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-red-600">
																		<Trash2 size={13} />
																	</button>
																</div>
															</div>
														);
													})}
												</div>
											)}
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			)}

			{/* ================= VISÃO 2: EXTRATO GERAL ================= */}
			{viewMode === "extrato" && (
				<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-2xs">
								<tr>
									<th className="py-3 px-4">Data</th>
									<th className="py-3 px-4">Colaborador</th>
									<th className="py-3 px-4">Tipo</th>
									<th className="py-3 px-4">Descrição</th>
									<th className="py-3 px-4">Valor</th>
									<th className="py-3 px-4">Status</th>
									<th className="py-3 px-4 text-right">Ações</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
								{filteredLancamentos.length === 0 ? (
									<tr>
										<td colSpan={7} className="py-8 text-center text-slate-400">
											Nenhum lançamento encontrado para o mês de {MESES[mes - 1]}.
										</td>
									</tr>
								) : (
									filteredLancamentos.map((lanc) => {
										const conf =
											TIPO_LANCAMENTO_CONFIG[lanc.tipo] || TIPO_LANCAMENTO_CONFIG.salario;

										return (
											<tr
												key={lanc.id}
												className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
												<td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">
													{lanc.data.split("-").reverse().join("/")}
												</td>
												<td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
													{lanc.funcionarioNome}
												</td>
												<td className="py-3 px-4">
													<span
														className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${conf.badgeBg} ${conf.badgeText}`}>
														{conf.label}
													</span>
												</td>
												<td className="py-3 px-4 text-slate-700 dark:text-slate-300">
													{lanc.descricao}
													{lanc.observacoes && (
														<span className="text-slate-400 text-2xs block italic">
															{lanc.observacoes}
														</span>
													)}
												</td>
												<td className="py-3 px-4">
													<span
														className={`font-black text-xs ${
															conf.isProvento
																? "text-emerald-600 dark:text-emerald-400"
																: lanc.tipo === "pagamento_realizado"
																? "text-purple-600 dark:text-purple-400"
																: "text-amber-600 dark:text-amber-400"
														}`}>
														{conf.isProvento ? "+" : "-"} R$ {lanc.valor.toFixed(2)}
													</span>
												</td>
												<td className="py-3 px-4">
													<span
														className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
															lanc.status === "pago"
																? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
																: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
														}`}>
														{lanc.status}
													</span>
												</td>
												<td className="py-3 px-4 text-right">
													<div className="flex items-center justify-end gap-1">
														<button
															onClick={() => openEditModal(lanc)}
															className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
															<Edit2 size={14} />
														</button>
														<button
															onClick={() => handleDelete(lanc.id)}
															className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-600 transition-colors">
															<Trash2 size={14} />
														</button>
													</div>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* MODAL DE ADICIONAR / EDITAR LANÇAMENTO */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<DollarSign className="text-blue-600 dark:text-blue-400" size={20} />
								<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
									{editingLancamento ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
								</h3>
							</div>
							<button
								onClick={() => setIsModalOpen(false)}
								className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
								<X size={18} />
							</button>
						</div>

						<form onSubmit={handleSubmit} className="p-6 space-y-4">
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Colaborador *
								</label>
								<select
									required
									value={formData.funcionarioId}
									onChange={(e) => setFormData({ ...formData, funcionarioId: e.target.value })}
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
									<option value="">Selecione um funcionário...</option>
									{funcionarios.map((f) => (
										<option key={f.id} value={f.id}>
											{f.nome} {f.apelido ? `(${f.apelido})` : ""} - {f.cargo}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Tipo de Custo / Lançamento *
								</label>
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
									{(
										[
											"salario",
											"vale_transporte",
											"bonus",
											"retirada",
											"desconto",
											"pagamento_realizado",
										] as TipoLancamentoFinanceiro[]
									).map((t) => {
										const conf = TIPO_LANCAMENTO_CONFIG[t];
										const isSelected = formData.tipo === t;

										return (
											<button
												key={t}
												type="button"
												onClick={() => handleTipoChange(t)}
												className={`cursor-pointer px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
													isSelected
														? `${conf.badgeBg} ${conf.badgeText} ring-2 ring-blue-500 font-black`
														: "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
												}`}>
												{conf.label}
											</button>
										);
									})}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Valor (R$) *
									</label>
									<input
										type="number"
										step="0.01"
										required
										value={formData.valor}
										onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
										placeholder="0.00"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Data do Fato *
									</label>
									<input
										type="date"
										required
										value={formData.data}
										onChange={(e) => setFormData({ ...formData, data: e.target.value })}
										className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Descrição
								</label>
								<input
									type="text"
									value={formData.descricao}
									onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
									placeholder="Ex: Adiantamento quinzena, Reembolso uber..."
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Status
									</label>
									<select
										value={formData.status}
										onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
										className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
										<option value="pendente">Pendente</option>
										<option value="pago">Pago / Baixado</option>
										<option value="cancelado">Cancelado</option>
									</select>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Forma de Pagamento
									</label>
									<select
										value={formData.metodoPagamento}
										onChange={(e) =>
											setFormData({ ...formData, metodoPagamento: e.target.value as any })
										}
										className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500">
										<option value="pix">PIX</option>
										<option value="dinheiro">Dinheiro</option>
										<option value="transferencia">Transferência</option>
										<option value="outro">Outro</option>
									</select>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Observações adicionais (opcional)
								</label>
								<input
									type="text"
									value={formData.observacoes}
									onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
									placeholder="Ex: Pago via PIX pelo banco Inter..."
									className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
								{editingLancamento ? (
									<button
										type="button"
										onClick={() => handleDelete(editingLancamento.id)}
										disabled={isSaving}
										className="cursor-pointer px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors">
										<Trash2 size={16} />
										<span>Excluir</span>
									</button>
								) : (
									<div />
								)}

								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setIsModalOpen(false)}
										className="cursor-pointer px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
										Cancelar
									</button>
									<button
										type="submit"
										disabled={isSaving}
										className="cursor-pointer px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all">
										{isSaving ? "Salvando..." : editingLancamento ? "Atualizar" : "Salvar"}
									</button>
								</div>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
