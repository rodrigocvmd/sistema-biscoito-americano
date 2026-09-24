"use client";

import { useState } from "react";
import {
	Funcionario,
	StatusFuncionario,
	TipoLancamentoFinanceiro,
	TIPO_LANCAMENTO_CONFIG,
} from "@/types/funcionarios";
import { STORE_NAMES, StoreId } from "@/types";
import {
	createFuncionario,
	updateFuncionario,
	deleteFuncionario,
	createLancamentoFinanceiro,
} from "@/lib/funcionarios-service";
import {
	Plus,
	Search,
	Edit2,
	Trash2,
	Phone,
	Copy,
	Check,
	UserCheck,
	Building2,
	DollarSign,
	CreditCard,
	X,
	AlertCircle,
	Users,
	Calendar,
} from "lucide-react";

interface FuncionariosTabProps {
	funcionarios: Funcionario[];
	mesAnoStr?: string;
}

const STATUS_BADGES: Record<
	StatusFuncionario,
	{ label: string; bg: string; text: string; dot: string }
> = {
	ativo: {
		label: "Ativo",
		bg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
		text: "text-emerald-700 dark:text-emerald-300",
		dot: "bg-emerald-500",
	},
	ferias: {
		label: "Férias",
		bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
		text: "text-amber-700 dark:text-amber-300",
		dot: "bg-amber-500",
	},
	afastado: {
		label: "Afastado",
		bg: "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800",
		text: "text-orange-700 dark:text-orange-300",
		dot: "bg-orange-500",
	},
	inativo: {
		label: "Inativo",
		bg: "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700",
		text: "text-slate-600 dark:text-slate-400",
		dot: "bg-slate-400",
	},
};

export default function FuncionariosTab({
	funcionarios,
	mesAnoStr = new Date().toISOString().slice(0, 7),
}: FuncionariosTabProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [filterLoja, setFilterLoja] = useState<string>("todas");
	const [filterStatus, setFilterStatus] = useState<string>("todos");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingFunc, setEditingFunc] = useState<Funcionario | null>(null);
	const [deletingFunc, setDeletingFunc] = useState<Funcionario | null>(null);
	const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	// Estado do Modal de Adicionar Custos para o Funcionário
	const [isCostModalOpen, setIsCostModalOpen] = useState(false);
	const [selectedFuncForCost, setSelectedFuncForCost] = useState<Funcionario | null>(null);
	const [isSavingCost, setIsSavingCost] = useState(false);
	const [costFormData, setCostFormData] = useState({
		tipo: "retirada" as TipoLancamentoFinanceiro,
		descricao: "",
		valor: "",
		data: new Date().toISOString().split("T")[0],
		mesReferencia: mesAnoStr,
		status: "pendente" as "pendente" | "pago" | "cancelado",
		metodoPagamento: "pix" as "pix" | "dinheiro" | "transferencia" | "outro",
		observacoes: "",
	});

	// Form State
	const [formData, setFormData] = useState({
		nome: "",
		nomeCompleto: "",
		cpf: "",
		lojaId: "todas" as StoreId | "todas",
		status: "ativo" as "ativo" | "ferias" | "inativo",
		dataAdmissao: "",
		salarioBase: "",
		valeTransporte: "",
		chavePix: "",
		telefone: "",
		observacoes: "",
	});

	const openCreateModal = () => {
		setEditingFunc(null);
		setFormData({
			nome: "",
			nomeCompleto: "",
			cpf: "",
			lojaId: "todas",
			status: "ativo",
			dataAdmissao: "",
			salarioBase: "",
			valeTransporte: "",
			chavePix: "",
			telefone: "",
			observacoes: "",
		});
		setIsModalOpen(true);
	};

	const openEditModal = (func: Funcionario) => {
		setEditingFunc(func);
		setFormData({
			nome: func.nome,
			nomeCompleto: func.nomeCompleto || "",
			cpf: func.cpf || "",
			lojaId: func.lojaId,
			status: (func.status === "afastado" ? "inativo" : func.status) as "ativo" | "ferias" | "inativo",
			dataAdmissao: func.dataAdmissao || "",
			salarioBase: func.salarioBase ? String(func.salarioBase) : "",
			valeTransporte: func.valeTransporte ? String(func.valeTransporte) : "",
			chavePix: func.chavePix || "",
			telefone: func.telefone || "",
			observacoes: func.observacoes || "",
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.nome.trim()) return;

		try {
			setIsSaving(true);
			const payload = {
				nome: formData.nome.trim(),
				nomeCompleto: formData.nomeCompleto.trim() || undefined,
				cpf: formData.cpf.trim() || undefined,
				lojaId: formData.lojaId,
				cargo: editingFunc?.cargo || "Colaborador",
				status: formData.status,
				dataAdmissao: formData.dataAdmissao.trim() || undefined,
				salarioBase: parseFloat(formData.salarioBase) || 0,
				valeTransporte: parseFloat(formData.valeTransporte) || 0,
				chavePix: formData.chavePix.trim() || undefined,
				telefone: formData.telefone.trim() || undefined,
				observacoes: formData.observacoes.trim() || undefined,
			};

			if (editingFunc) {
				await updateFuncionario(editingFunc.id, payload);
			} else {
				await createFuncionario(payload);
			}

			setIsModalOpen(false);
		} catch (error) {
			console.error("Erro ao salvar funcionário:", error);
			alert("Ocorreu um erro ao salvar o funcionário. Tente novamente.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!deletingFunc) return;
		try {
			await deleteFuncionario(deletingFunc.id);
			setDeletingFunc(null);
		} catch (error) {
			console.error("Erro ao excluir funcionário:", error);
			alert("Erro ao excluir funcionário.");
		}
	};

	// Ações do Modal de Custos do Colaborador
	const openAddCostModal = (func: Funcionario) => {
		setSelectedFuncForCost(func);
		const defaultTipo: TipoLancamentoFinanceiro = "retirada";
		const config = TIPO_LANCAMENTO_CONFIG[defaultTipo];
		setCostFormData({
			tipo: defaultTipo,
			descricao: config.label,
			valor: "",
			data: new Date().toISOString().split("T")[0],
			mesReferencia: mesAnoStr,
			status: "pendente",
			metodoPagamento: "pix",
			observacoes: "",
		});
		setIsCostModalOpen(true);
	};

	const handleCostTipoChange = (newTipo: TipoLancamentoFinanceiro) => {
		const config = TIPO_LANCAMENTO_CONFIG[newTipo];
		let valorSugerido = costFormData.valor;
		if (selectedFuncForCost) {
			if (newTipo === "salario" && selectedFuncForCost.salarioBase) {
				valorSugerido = String(selectedFuncForCost.salarioBase);
			} else if (newTipo === "vale_transporte" && selectedFuncForCost.valeTransporte) {
				valorSugerido = String(selectedFuncForCost.valeTransporte);
			}
		}
		setCostFormData((prev) => ({
			...prev,
			tipo: newTipo,
			descricao: config.label,
			valor: valorSugerido,
		}));
	};

	const handleCostSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedFuncForCost || !costFormData.valor) return;

		try {
			setIsSavingCost(true);
			await createLancamentoFinanceiro({
				funcionarioId: selectedFuncForCost.id,
				funcionarioNome: selectedFuncForCost.apelido || selectedFuncForCost.nome,
				lojaId: selectedFuncForCost.lojaId,
				tipo: costFormData.tipo,
				descricao: costFormData.descricao.trim() || TIPO_LANCAMENTO_CONFIG[costFormData.tipo].label,
				valor: parseFloat(costFormData.valor) || 0,
				data: costFormData.data || new Date().toISOString().split("T")[0],
				mesReferencia: costFormData.mesReferencia || mesAnoStr,
				status: costFormData.status,
				metodoPagamento: costFormData.metodoPagamento,
				observacoes: costFormData.observacoes.trim() || undefined,
			});
			setIsCostModalOpen(false);
			alert(
				`Lançamento de ${TIPO_LANCAMENTO_CONFIG[costFormData.tipo].label} (R$ ${parseFloat(
					costFormData.valor
				).toFixed(2)}) adicionado com sucesso para ${selectedFuncForCost.nome}!`
			);
		} catch (error) {
			console.error("Erro ao registrar custo para colaborador:", error);
			alert("Erro ao registrar custo. Tente novamente.");
		} finally {
			setIsSavingCost(false);
		}
	};

	const copyPix = (pix: string, id: string) => {
		navigator.clipboard.writeText(pix);
		setCopiedPixId(id);
		setTimeout(() => setCopiedPixId(null), 2000);
	};

	// Filtragem
	const filtered = funcionarios.filter((func) => {
		const searchLower = searchTerm.toLowerCase();
		const matchesSearch =
			func.nome.toLowerCase().includes(searchLower) ||
			(func.nomeCompleto && func.nomeCompleto.toLowerCase().includes(searchLower)) ||
			(func.cpf && func.cpf.toLowerCase().includes(searchLower)) ||
			(func.telefone && func.telefone.toLowerCase().includes(searchLower)) ||
			(func.chavePix && func.chavePix.toLowerCase().includes(searchLower));

		const matchesLoja =
			filterLoja === "todas" || func.lojaId === "todas" || func.lojaId === filterLoja;

		const matchesStatus =
			filterStatus === "todos" || func.status === filterStatus;

		return matchesSearch && matchesLoja && matchesStatus;
	});

	// Totais para o resumo rápido
	const totalCadastrados = funcionarios.length;
	const totalAtivos = funcionarios.filter((f) => f.status === "ativo").length;
	const totalFerias = funcionarios.filter((f) => f.status === "ferias").length;
	const totalInativos = funcionarios.filter((f) => f.status === "inativo").length;

	return (
		<div className="space-y-6">
			{/* Barra Superior de Resumo Rápido */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
					<div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
						<Users size={20} />
					</div>
					<div>
						<span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Cadastrados</span>
						<p className="text-xl font-black text-slate-900 dark:text-slate-100">{totalCadastrados}</p>
					</div>
				</div>

				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
					<div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
						<UserCheck size={20} />
					</div>
					<div>
						<span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ativos</span>
						<p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{totalAtivos}</p>
					</div>
				</div>

				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
					<div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
						<Building2 size={20} />
					</div>
					<div>
						<span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Em Férias</span>
						<p className="text-xl font-black text-amber-600 dark:text-amber-400">{totalFerias}</p>
					</div>
				</div>

				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
					<div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl">
						<Users size={20} />
					</div>
					<div>
						<span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Inativos</span>
						<p className="text-xl font-black text-slate-600 dark:text-slate-400">{totalInativos}</p>
					</div>
				</div>
			</div>

			{/* Barra de Filtros e Busca */}
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
				<div className="relative w-full md:w-80">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Buscar por nome, CPF, telefone ou PIX..."
						className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
							<X size={16} />
						</button>
					)}
				</div>

				<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
					<select
						value={filterLoja}
						onChange={(e) => setFilterLoja(e.target.value)}
						aria-label="Filtrar por loja"
						className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
						<option value="todas">Todas as Lojas</option>
						{Object.entries(STORE_NAMES).map(([id, name]) => (
							<option key={id} value={id}>
								{name}
							</option>
						))}
					</select>

					<select
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
						aria-label="Filtrar por status"
						className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
						<option value="todos">Todos os Status</option>
						<option value="ativo">Ativos</option>
						<option value="ferias">Férias</option>
						<option value="inativo">Inativos</option>
					</select>

					<button
						onClick={openCreateModal}
						className="cursor-pointer ml-auto md:ml-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm">
						<Plus size={18} />
						<span>Novo Funcionário</span>
					</button>
				</div>
			</div>

			{/* Lista / Grid de Funcionários */}
			{filtered.length === 0 ? (
				<div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
					<div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
						<Users size={32} />
					</div>
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nenhum funcionário encontrado</h3>
					<p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
						{searchTerm || filterLoja !== "todas" || filterStatus !== "todos"
							? "Tente ajustar os filtros ou o termo de busca para encontrar o colaborador."
							: "Comece cadastrando seu primeiro funcionário para montar escalas e acompanhar o financeiro."}
					</p>
					<button
						onClick={openCreateModal}
						className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all inline-flex items-center gap-2 mt-2">
						<Plus size={16} />
						<span>Cadastrar Agora</span>
					</button>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
					{filtered.map((func) => {
						const statusBadge = STATUS_BADGES[func.status] || STATUS_BADGES.ativo;
						const lojaLabel =
							func.lojaId === "todas"
								? "Todas as Lojas / Volante"
								: STORE_NAMES[func.lojaId] || func.lojaId;

						return (
							<div
								key={func.id}
								className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4">
								<div className="space-y-3">
									{/* Topo do Card: Avatar/Nome/Status */}
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-3 min-w-0">
											<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-sm uppercase">
												{func.nome.substring(0, 2)}
											</div>
											<div className="min-w-0">
												<h4 className="text-base font-black text-slate-900 dark:text-slate-100 truncate">
													{func.nome}
												</h4>
												{func.cpf ? (
													<p className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium truncate">
														CPF: {func.cpf}
													</p>
												) : (
													<p className="text-xs text-slate-400 italic">
														CPF não informado
													</p>
												)}
											</div>
										</div>

										<span
											className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge.bg} ${statusBadge.text}`}>
											<span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
											{statusBadge.label}
										</span>
									</div>

									{/* Detalhes do Colaborador */}
									<div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
										{func.nomeCompleto && (
											<div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
												<span className="flex items-center gap-1.5 font-medium">
													<UserCheck size={14} className="text-slate-400" />
													Nome Completo:
												</span>
												<span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]" title={func.nomeCompleto}>
													{func.nomeCompleto}
												</span>
											</div>
										)}

										<div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
											<span className="flex items-center gap-1.5 font-medium">
												<Building2 size={14} className="text-slate-400" />
												Loja Padrão:
											</span>
											<span className="font-bold text-slate-800 dark:text-slate-200">
												{lojaLabel}
											</span>
										</div>

										{func.dataAdmissao && (
											<div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
												<span className="flex items-center gap-1.5 font-medium">
													<Calendar size={14} className="text-slate-400" />
													Admissão:
												</span>
												<span className="font-semibold text-slate-800 dark:text-slate-200">
													{func.dataAdmissao.split("-").reverse().join("/")}
												</span>
											</div>
										)}

										{func.telefone && (
											<div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
												<span className="flex items-center gap-1.5 font-medium">
													<Phone size={14} className="text-slate-400" />
													WhatsApp:
												</span>
												<a
													href={`https://wa.me/55${func.telefone.replace(/\D/g, "")}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
													{func.telefone}
												</a>
											</div>
										)}

										{func.chavePix && (
											<div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
												<span className="flex items-center gap-1.5 font-medium">
													<DollarSign size={14} className="text-slate-400" />
													Chave PIX:
												</span>
												<div className="flex items-center gap-1.5">
													<span className="font-mono font-medium max-w-[150px] truncate">
														{func.chavePix}
													</span>
													<button
														onClick={() => copyPix(func.chavePix!, func.id)}
														title="Copiar Chave PIX"
														className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-blue-600 transition-colors">
														{copiedPixId === func.id ? (
															<Check size={14} className="text-emerald-500" />
														) : (
															<Copy size={14} />
														)}
													</button>
												</div>
											</div>
										)}

										<div className="flex items-center justify-between pt-1 text-slate-600 dark:text-slate-400">
											<span className="font-medium">Salário Base:</span>
											<span className="font-black text-slate-900 dark:text-slate-100">
												R$ {(func.salarioBase || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
											</span>
										</div>

										{func.valeTransporte > 0 && (
											<div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
												<span className="font-medium">Vale-Transporte:</span>
												<span className="font-bold text-teal-600 dark:text-teal-400">
													R$ {(func.valeTransporte || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
												</span>
											</div>
										)}

										{func.observacoes && (
											<p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg mt-1 border border-slate-100 dark:border-slate-800">
												"{func.observacoes}"
											</p>
										)}
									</div>
								</div>

								{/* Ações do Card */}
								<div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
									<button
										onClick={() => openAddCostModal(func)}
										className="cursor-pointer px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border border-emerald-200 dark:border-emerald-800"
										title="Lançar custo (adiantamento, bônus, desconto, etc.) para este funcionário">
										<DollarSign size={14} />
										<span>Adicionar Custos</span>
									</button>
									<button
										onClick={() => openEditModal(func)}
										className="cursor-pointer p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold">
										<Edit2 size={15} />
										<span>Editar</span>
									</button>
									<button
										onClick={() => setDeletingFunc(func)}
										className="cursor-pointer p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold">
										<Trash2 size={15} />
										<span>Excluir</span>
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* MODAL DE CADASTRO / EDIÇÃO */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
							<h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
								{editingFunc ? "Editar Funcionário" : "Novo Funcionário"}
							</h3>
							<button
								onClick={() => setIsModalOpen(false)}
								className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
								<X size={20} />
							</button>
						</div>

						<form onSubmit={handleSubmit} className="p-6 space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* 1. Apelido / Nome Curto (utilizado nas escalas, cards, etc.) */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Apelido *
									</label>
									<input
										type="text"
										required
										value={formData.nome}
										onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
										placeholder="Ex: João Silva"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-[10px] text-slate-400 mt-1 block">
										Nome/apelido exibido nos cards, escalas e lançamentos.
									</span>
								</div>

								{/* 2. Nome Completo (meramente consultivo) */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Nome Completo <span className="text-[11px] font-normal text-slate-400">(Consultivo)</span>
									</label>
									<input
										type="text"
										value={formData.nomeCompleto}
										onChange={(e) => setFormData({ ...formData, nomeCompleto: e.target.value })}
										placeholder="Ex: João da Silva Sauro"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
									<span className="text-[10px] text-slate-400 mt-1 block">
										Apenas para consulta cadastral.
									</span>
								</div>

								{/* 2. CPF */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										CPF
									</label>
									<input
										type="text"
										value={formData.cpf}
										onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
										placeholder="000.000.000-00"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								{/* 3. Loja Principal */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Loja Principal *
									</label>
									<select
										value={formData.lojaId}
										onChange={(e) => setFormData({ ...formData, lojaId: e.target.value as any })}
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
										<option value="todas">Todas as Lojas / Volante</option>
										{Object.entries(STORE_NAMES).map(([id, name]) => (
											<option key={id} value={id}>
												{name}
											</option>
										))}
									</select>
								</div>

								{/* 4. Status (Ativo, Férias, Inativo) */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Status *
									</label>
									<select
										value={formData.status}
										onChange={(e) =>
											setFormData({ ...formData, status: e.target.value as any })
										}
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
										<option value="ativo">Ativo</option>
										<option value="ferias">Férias</option>
										<option value="inativo">Inativo</option>
									</select>
								</div>

								{/* 5. Data de Admissão */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Data de Admissão
									</label>
									<input
										type="date"
										value={formData.dataAdmissao}
										onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								{/* 5. Telefone / WhatsApp */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Telefone / WhatsApp
									</label>
									<input
										type="text"
										value={formData.telefone}
										onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
										placeholder="(61) 99999-9999"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								{/* 6. Salário Base (R$) */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Salário Base (R$)
									</label>
									<input
										type="number"
										step="0.01"
										value={formData.salarioBase}
										onChange={(e) => setFormData({ ...formData, salarioBase: e.target.value })}
										placeholder="Ex: 1600.00"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								{/* 7. Vale-Transporte (R$) */}
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Vale-Transporte (R$)
									</label>
									<input
										type="number"
										step="0.01"
										value={formData.valeTransporte}
										onChange={(e) => setFormData({ ...formData, valeTransporte: e.target.value })}
										placeholder="Ex: 220.00"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								{/* 8. Chave PIX */}
								<div className="md:col-span-2">
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Chave PIX
									</label>
									<input
										type="text"
										value={formData.chavePix}
										onChange={(e) => setFormData({ ...formData, chavePix: e.target.value })}
										placeholder="CPF, telefone, e-mail ou aleatória"
										className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Observações Gerais
								</label>
								<textarea
									rows={2}
									value={formData.observacoes}
									onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
									placeholder="Anotações de turnos preferidos, restrições de horário, etc."
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setIsModalOpen(false)}
									className="cursor-pointer px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
									Cancelar
								</button>
								<button
									type="submit"
									disabled={isSaving}
									className="cursor-pointer px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition-all">
									{isSaving ? "Salvando..." : editingFunc ? "Atualizar" : "Cadastrar"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
			{deletingFunc && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-4">
						<div className="flex items-center gap-3 text-red-600">
							<AlertCircle size={24} />
							<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Excluir Funcionário</h3>
						</div>
						<p className="text-sm text-slate-600 dark:text-slate-400">
							Tem certeza que deseja remover <strong>{deletingFunc.nome}</strong>? Esta ação não pode ser
							desfeita.
						</p>
						<div className="flex items-center justify-end gap-3 pt-2">
							<button
								onClick={() => setDeletingFunc(null)}
								className="cursor-pointer px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
								Cancelar
							</button>
							<button
								onClick={handleDelete}
								className="cursor-pointer px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition-all">
								Confirmar Exclusão
							</button>
						</div>
					</div>
				</div>
			)}

			{/* MODAL DE ADICIONAR CUSTOS AO FUNCIONÁRIO */}
			{isCostModalOpen && selectedFuncForCost && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<DollarSign className="text-emerald-600 dark:text-emerald-400" size={20} />
								<div>
									<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
										Lançar Custo
									</h3>
									<p className="text-xs text-slate-500 font-semibold">
										{selectedFuncForCost.nome} {selectedFuncForCost.apelido ? `(${selectedFuncForCost.apelido})` : ""}
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsCostModalOpen(false)}
								className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
								<X size={18} />
							</button>
						</div>

						<form onSubmit={handleCostSubmit} className="p-6 space-y-4">
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
										] as TipoLancamentoFinanceiro[]
									).map((t) => {
										const conf = TIPO_LANCAMENTO_CONFIG[t];
										const isSelected = costFormData.tipo === t;

										return (
											<button
												key={t}
												type="button"
												onClick={() => handleCostTipoChange(t)}
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
										value={costFormData.valor}
										onChange={(e) => setCostFormData({ ...costFormData, valor: e.target.value })}
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
										value={costFormData.data}
										onChange={(e) => setCostFormData({ ...costFormData, data: e.target.value })}
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
									value={costFormData.descricao}
									onChange={(e) => setCostFormData({ ...costFormData, descricao: e.target.value })}
									placeholder="Ex: Adiantamento da quinzena, bônus de metas..."
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
										Status
									</label>
									<select
										value={costFormData.status}
										onChange={(e) =>
											setCostFormData({ ...costFormData, status: e.target.value as any })
										}
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
										value={costFormData.metodoPagamento}
										onChange={(e) =>
											setCostFormData({
												...costFormData,
												metodoPagamento: e.target.value as any,
											})
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
									value={costFormData.observacoes}
									onChange={(e) =>
										setCostFormData({ ...costFormData, observacoes: e.target.value })
									}
									placeholder="Ex: Pago em dinheiro no caixa da loja..."
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setIsCostModalOpen(false)}
									className="cursor-pointer px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
									Cancelar
								</button>
								<button
									type="submit"
									disabled={isSavingCost}
									className="cursor-pointer px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5">
									<DollarSign size={14} />
									<span>{isSavingCost ? "Salvando..." : "Salvar Lançamento"}</span>
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
