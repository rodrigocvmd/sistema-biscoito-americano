"use client";

import { useState, useEffect } from "react";
import {
	X,
	DollarSign,
	Calendar,
	Store,
	Tag,
	CreditCard,
	CheckCircle2,
	AlertCircle,
	FileText,
} from "lucide-react";
import {
	CustoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	MetodoPagamento,
} from "@/types/financeiro-controle";

interface CustoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: Omit<CustoFinanceiro, "id" | "createdAt" | "updatedAt">) => Promise<void>;
	editingCusto?: CustoFinanceiro | null;
	defaultCategoria?: CategoriaCusto;
	defaultLoja?: StoreIdWithGeral;
}

const METODOS_PAGAMENTO: { id: MetodoPagamento; label: string }[] = [
	{ id: "pix", label: "Pix" },
	{ id: "boleto", label: "Boleto Bancário" },
	{ id: "cartao", label: "Cartão de Crédito/Débito" },
	{ id: "debito", label: "Débito em Conta" },
	{ id: "dinheiro", label: "Dinheiro em Espécie" },
	{ id: "outro", label: "Outro" },
];

export default function CustoModal({
	isOpen,
	onClose,
	onSave,
	editingCusto,
	defaultCategoria = "cookies",
	defaultLoja = "geral",
}: CustoModalProps) {
	const [categoria, setCategoria] = useState<CategoriaCusto>(defaultCategoria);
	const [lojaId, setLojaId] = useState<StoreIdWithGeral>(defaultLoja);
	const [dataCusto, setDataCusto] = useState("");
	const [descricao, setDescricao] = useState("");
	const [valor, setValor] = useState("");
	const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>("pix");
	const [status, setStatus] = useState<"pago" | "pendente">("pago");
	const [observacoes, setObservacoes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			if (editingCusto) {
				setCategoria(editingCusto.categoria);
				setLojaId(editingCusto.lojaId);
				setDataCusto(editingCusto.data);
				setDescricao(editingCusto.descricao);
				setValor(editingCusto.valor ? String(editingCusto.valor).replace(".", ",") : "");
				setMetodoPagamento(editingCusto.metodoPagamento || "pix");
				setStatus(editingCusto.status || "pago");
				setObservacoes(editingCusto.observacoes || "");
			} else {
				const now = new Date();
				const year = now.getFullYear();
				const month = String(now.getMonth() + 1).padStart(2, "0");
				const day = String(now.getDate()).padStart(2, "0");
				const todayStr = `${year}-${month}-${day}`;

				setCategoria(defaultCategoria);
				setLojaId(defaultLoja);
				setDataCusto(todayStr);
				setDescricao("");
				setValor("");
				setMetodoPagamento("pix");
				setStatus("pago");
				setObservacoes("");
			}
		}
	}, [isOpen, editingCusto, defaultCategoria, defaultLoja]);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!dataCusto) {
			alert("O dia do custo é obrigatório.");
			return;
		}

		const trimmedDesc = descricao.trim();
		if (!trimmedDesc) {
			alert("Por favor, preencha a descrição do custo.");
			return;
		}

		const cleanedVal = valor.replace(/\./g, "").replace(",", ".").trim();
		const valNum = parseFloat(cleanedVal);
		if (isNaN(valNum) || valNum <= 0) {
			alert("Por favor, insira um valor monetário válido maior que zero.");
			return;
		}

		const mesReferencia = dataCusto.slice(0, 7);

		setIsSubmitting(true);
		try {
			await onSave({
				categoria,
				lojaId,
				descricao: trimmedDesc,
				valor: valNum,
				data: dataCusto,
				mesReferencia,
				metodoPagamento,
				status,
				observacoes: observacoes.trim() || undefined,
			});
			onClose();
		} catch (error) {
			console.error("Erro ao salvar custo:", error);
			alert("Erro ao salvar lançamento de custo.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const catConfig = CATEGORIAS_CUSTO_CONFIG[categoria];

	return (
		<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
				{/* Header */}
				<div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
					<div className="flex items-center gap-2.5">
						<span
							className="p-2.5 rounded-2xl text-white shadow-xs"
							style={{ backgroundColor: catConfig?.color || "#f43f5e" }}>
							<DollarSign size={20} />
						</span>
						<div>
							<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
								{editingCusto ? "Editar Custo / Despesa" : "Lançar Novo Custo"}
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Controle de custos operacionais com data obrigatória
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
						<X size={20} />
					</button>
				</div>

				{/* Formulário */}
				<form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
					{/* Categoria do Custo */}
					<div>
						<label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
							Tipo de Custo <span className="text-rose-500">*</span>
						</label>
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{Object.entries(CATEGORIAS_CUSTO_CONFIG).map(([key, cfg]) => {
								const isSelected = categoria === key;
								return (
									<button
										key={key}
										type="button"
										onClick={() => setCategoria(key as CategoriaCusto)}
										className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
											isSelected
												? "border-slate-900 dark:border-white bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
												: "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
										}`}>
										<span
											className="w-2.5 h-2.5 rounded-full shrink-0"
											style={{ backgroundColor: cfg.color }}
										/>
										<span className="text-xs font-bold truncate">{cfg.label}</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* Linha: Data (Obrigatória) e Loja */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
								<span>
									Dia do Custo <span className="text-rose-500">*</span>
								</span>
								<span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
									Obrigatório
								</span>
							</label>
							<div className="relative">
								<input
									type="date"
									required
									value={dataCusto}
									onChange={(e) => setDataCusto(e.target.value)}
									className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
								/>
							</div>
						</div>

						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
								Unidade / Loja
							</label>
							<select
								value={lojaId}
								onChange={(e) => setLojaId(e.target.value as StoreIdWithGeral)}
								className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
								<option value="geral">Geral / Matriz (Todas as Lojas)</option>
								<option value="lago">Lago</option>
								<option value="terraco">Terraço</option>
								<option value="conjunto">Conjunto</option>
								<option value="noroeste">Noroeste</option>
							</select>
						</div>
					</div>

					{/* Descrição do Custo */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
							Descrição do Custo <span className="text-rose-500">*</span>
						</label>
						<input
							type="text"
							required
							placeholder="Ex: Compra de Chocolate Callebaut, Aluguel Outubro, Enel Lago..."
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>

					{/* Valor Monetário */}
					<div>
						<label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
							Valor do Custo (R$) <span className="text-rose-500">*</span>
						</label>
						<div className="relative">
							<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
								R$
							</span>
							<input
								type="text"
								inputMode="decimal"
								required
								placeholder="0,00"
								value={valor}
								onFocus={(e) => e.target.select()}
								onChange={(e) => setValor(e.target.value)}
								className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
							/>
						</div>
					</div>

					{/* Forma de Pagamento e Status */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
								Forma de Pagamento
							</label>
							<select
								value={metodoPagamento}
								onChange={(e) => setMetodoPagamento(e.target.value as MetodoPagamento)}
								className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
								{METODOS_PAGAMENTO.map((m) => (
									<option key={m.id} value={m.id}>
										{m.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
								Situação
							</label>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setStatus("pago")}
									className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
										status === "pago"
											? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-black"
											: "border-slate-200 dark:border-slate-800 text-slate-500"
									}`}>
									Liquidado (Pago)
								</button>
								<button
									type="button"
									onClick={() => setStatus("pendente")}
									className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
										status === "pendente"
											? "bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-700 dark:text-amber-300 font-black"
											: "border-slate-200 dark:border-slate-800 text-slate-500"
									}`}>
									Pendente
								</button>
							</div>
						</div>
					</div>

					{/* Observações */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
							Observações (Opcional)
						</label>
						<textarea
							rows={2}
							placeholder="Código de barras, chave Pix, número da nota fiscal ou detalhes adicionais..."
							value={observacoes}
							onChange={(e) => setObservacoes(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>

					{/* Botões de Ação */}
					<div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
							Cancelar
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-black tracking-wide shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50">
							<CheckCircle2 size={16} />
							{isSubmitting ? "Gravando..." : editingCusto ? "Salvar Alterações" : "Gravar Custo"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
