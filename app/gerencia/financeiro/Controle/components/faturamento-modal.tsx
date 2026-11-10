"use client";

import { useState, useEffect, useId, useRef } from "react";
import {
	X,
	Plus,
	Trash2,
	DollarSign,
	Calendar,
	Store,
	ShoppingBag,
	Tag,
	FileText,
	CheckCircle2,
	Layers,
	ListOrdered,
} from "lucide-react";
import {
	FaturamentoFinanceiro,
	FaturamentoItem,
	CanalVenda,
	CANAL_VENDA_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	SPECIFIC_STORE_IDS,
	isSpecificStoreId,
} from "@/types/financeiro-controle";
import { CurrencyInput } from "@/components/currency-input";
import { DateInputBR } from "@/components/date-input-br";

interface FaturamentoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: Omit<FaturamentoFinanceiro, "id" | "createdAt" | "updatedAt">) => Promise<void>;
	onDelete?: (id: string) => Promise<void> | void;
	editingFaturamento?: FaturamentoFinanceiro | null;
	defaultLoja?: StoreIdWithGeral;
	defaultData?: string;
}

const ITENS_SUGESTOES = [
	{ nome: "Cookies Tradicionais", precoUnitario: 16 },
	{ nome: "Cookies Especiais / Recheados", precoUnitario: 18 },
	{ nome: "Café Espresso / Bebidas", precoUnitario: 9 },
	{ nome: "Combo 4 Cookies", precoUnitario: 62 },
	{ nome: "Combo 6 Cookies", precoUnitario: 90 },
	{ nome: "Sorvetes / Sobremesas", precoUnitario: 15 },
	{ nome: "Caixa Presente", precoUnitario: 25 },
];

export default function FaturamentoModal({
	isOpen,
	onClose,
	onSave,
	onDelete,
	editingFaturamento,
	defaultLoja = "geral",
	defaultData,
}: FaturamentoModalProps) {
	const [tipo, setTipo] = useState<"geral" | "discriminado">("geral");
	const [lojaId, setLojaId] = useState<StoreIdWithGeral | "">(
		isSpecificStoreId(defaultLoja) ? defaultLoja : ""
	);
	const [dataFaturamento, setDataFaturamento] = useState("");
	const [valorGeral, setValorGeral] = useState("");
	const [canal, setCanal] = useState<CanalVenda>("geral");
	const [descricao, setDescricao] = useState("");
	const [observacoes, setObservacoes] = useState("");
	const [itens, setItens] = useState<FaturamentoItem[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const valorGeralInputRef = useRef<HTMLInputElement>(null);

	// Preencher estado inicial quando abre ou edita
	useEffect(() => {
		if (isOpen) {
			if (editingFaturamento) {
				setTipo(editingFaturamento.tipo);
				setLojaId(
					isSpecificStoreId(editingFaturamento.lojaId)
						? editingFaturamento.lojaId
						: isSpecificStoreId(defaultLoja)
						? defaultLoja
						: ""
				);
				setDataFaturamento(editingFaturamento.data);
				setValorGeral(
					editingFaturamento.valorTotal
						? String(Math.round(editingFaturamento.valorTotal))
						: ""
				);
				setCanal(
					editingFaturamento.canal === "ifood" || editingFaturamento.canal === "delivery_proprio"
						? "delivery"
						: editingFaturamento.canal || "geral"
				);
				setDescricao(editingFaturamento.descricao || "");
				setObservacoes(editingFaturamento.observacoes || "");
				setItens(
					editingFaturamento.itens && editingFaturamento.itens.length > 0
						? editingFaturamento.itens.map((it) => ({
								...it,
								precoUnitario: Math.round(it.precoUnitario),
								subtotal: Math.round(it.subtotal),
						  }))
						: [{ id: "item-1", nome: "", quantidade: 1, precoUnitario: 0, subtotal: 0 }]
				);
			} else {
				const now = new Date();
				const year = now.getFullYear();
				const month = String(now.getMonth() + 1).padStart(2, "0");
				const day = String(now.getDate()).padStart(2, "0");
				const todayStr = `${year}-${month}-${day}`;

				setTipo("geral");
				setLojaId(isSpecificStoreId(defaultLoja) ? defaultLoja : "");
				setDataFaturamento(defaultData || todayStr);
				setValorGeral("");
				setCanal("geral");
				setDescricao("");
				setObservacoes("");
				setItens([{ id: "item-1", nome: "", quantidade: 1, precoUnitario: 0, subtotal: 0 }]);
			}

			// Focar e selecionar automaticamente o campo de valor financeiro
			setTimeout(() => {
				if (valorGeralInputRef.current) {
					valorGeralInputRef.current.focus();
					valorGeralInputRef.current.select();
				}
			}, 100);
		}
	}, [isOpen, editingFaturamento, defaultLoja, defaultData]);

	if (!isOpen) return null;

	// Total calculado a partir dos itens discriminados (inteiro em reais)
	const totalItens = itens.reduce((acc, curr) => acc + (Math.round(Number(curr.subtotal)) || 0), 0);

	// Helpers de item
	const handleAddItem = (sugestao?: { nome: string; precoUnitario: number }) => {
		const newId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
		if (sugestao) {
			const unit = Math.round(sugestao.precoUnitario);
			setItens((prev) => [
				...prev,
				{
					id: newId,
					nome: sugestao.nome,
					quantidade: 1,
					precoUnitario: unit,
					subtotal: unit,
				},
			]);
		} else {
			setItens((prev) => [
				...prev,
				{
					id: newId,
					nome: "",
					quantidade: 1,
					precoUnitario: 0,
					subtotal: 0,
				},
			]);
		}
	};

	const handleUpdateItem = (
		id: string,
		field: "nome" | "quantidade" | "precoUnitario",
		val: string | number
	) => {
		setItens((prev) =>
			prev.map((it) => {
				if (it.id !== id) return it;
				const updated = { ...it };

				if (field === "nome") {
					updated.nome = String(val);
				} else if (field === "quantidade") {
					const qtd = Math.max(0, Math.floor(Number(val) || 0));
					updated.quantidade = qtd;
					updated.subtotal = Math.round(qtd * updated.precoUnitario);
				} else if (field === "precoUnitario") {
					const preco = Math.max(0, Math.round(Number(val) || 0));
					updated.precoUnitario = preco;
					updated.subtotal = Math.round(updated.quantidade * preco);
				}
				return updated;
			})
		);
	};

	const handleRemoveItem = (id: string) => {
		setItens((prev) => {
			const filtered = prev.filter((it) => it.id !== id);
			return filtered.length > 0 ? filtered : [{ id: "item-1", nome: "", quantidade: 1, precoUnitario: 0, subtotal: 0 }];
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isSpecificStoreId(lojaId)) {
			alert("Por favor, selecione uma loja específica (Lago, Terraço, Conjunto ou Noroeste).");
			return;
		}
		if (!dataFaturamento) {
			alert("Por favor, informe a data do faturamento.");
			return;
		}

		let finalValor = 0;
		let validItens: FaturamentoItem[] = [];

		if (tipo === "geral") {
			const cleaned = valorGeral.replace(/\D/g, "").trim();
			finalValor = cleaned ? parseInt(cleaned, 10) : 0;
			if (isNaN(finalValor) || finalValor <= 0) {
				alert("Por favor, informe um valor de faturamento válido.");
				return;
			}
		} else {
			validItens = itens
				.filter((it) => it.nome.trim() && it.subtotal > 0)
				.map((it) => ({
					...it,
					precoUnitario: Math.round(it.precoUnitario),
					subtotal: Math.round(it.subtotal),
				}));
			if (validItens.length === 0) {
				alert("Por favor, adicione pelo menos um item válido com nome e valor.");
				return;
			}
			finalValor = validItens.reduce((acc, curr) => acc + curr.subtotal, 0);
		}

		const mesReferencia = dataFaturamento.slice(0, 7);

		setIsSubmitting(true);
		try {
			await onSave({
				lojaId,
				data: dataFaturamento,
				mesReferencia,
				tipo,
				valorTotal: Math.round(finalValor),
				canal,
				descricao: descricao.trim() || "Faturamento",
				itens: tipo === "discriminado" ? validItens : undefined,
				observacoes: observacoes.trim() || undefined,
			});
			onClose();
		} catch (error) {
			console.error("Erro ao salvar faturamento:", error);
			alert("Erro ao salvar faturamento.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
				{/* Header */}
				<div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
					<div className="flex items-center gap-2.5">
						<span className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
							<DollarSign size={20} />
						</span>
						<div>
							<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
								{editingFaturamento ? "Editar Lançamento de Faturamento" : "Novo Lançamento de Faturamento"}
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Informe vendas diárias com valor único consolidado ou discriminado por itens
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
				<form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
					{/* Seletor Tipo: Geral vs Discriminado */}
					<div>
						<label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
							Tipo de Lançamento
						</label>
						<div className="grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => setTipo("geral")}
								className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left ${
									tipo === "geral"
										? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
										: "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400"
								}`}>
								<span
									className={`p-2 rounded-xl ${
										tipo === "geral" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"
									}`}>
									<Layers size={18} />
								</span>
								<div>
									<p className="text-xs font-black">Faturamento Geral</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">
										Valor total do dia / fechamento
									</p>
								</div>
							</button>

							<button
								type="button"
								onClick={() => setTipo("discriminado")}
								className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all text-left ${
									tipo === "discriminado"
										? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
										: "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400"
								}`}>
								<span
									className={`p-2 rounded-xl ${
										tipo === "discriminado" ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-800"
									}`}>
									<ListOrdered size={18} />
								</span>
								<div>
									<p className="text-xs font-black">Discriminado por Itens</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">
										Produtos, quantidades e unitários
									</p>
								</div>
							</button>
						</div>
					</div>

					{/* Linha 1: Loja, Data e Canal */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
								Unidade / Loja <span className="text-rose-500">*</span>
							</label>
							<div className="relative">
								<select
									required
									value={lojaId === "geral" ? "" : lojaId}
									onChange={(e) => setLojaId(e.target.value as StoreIdWithGeral | "")}
									className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
									<option value="" disabled>
										Selecione uma loja...
									</option>
									{SPECIFIC_STORE_IDS.map((sId) => (
										<option key={sId} value={sId}>
											{STORE_NAMES_EXTENDED[sId]}
										</option>
									))}
								</select>
							</div>
						</div>

						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
								Data do Faturamento<span className="text-rose-500">*</span>
							</label>
							<DateInputBR
								required
								value={dataFaturamento}
								onChangeDate={(iso) => setDataFaturamento(iso)}
								onClick={(e) => e.currentTarget.select()}
								className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
							/>
						</div>

						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
								Canal de Venda
							</label>
							<select
								value={canal}
								onChange={(e) => setCanal(e.target.value as CanalVenda)}
								className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
								<option value="geral">Geral Consolidado</option>
								<option value="balcao">Balcão</option>
								<option value="delivery">Delivery</option>
							</select>
						</div>
					</div>

					{/* Modo Geral: Valor Direto */}
					{tipo === "geral" ? (
						<div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
							<div>
								<label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
									Valor Total do Faturamento (R$) <span className="text-rose-500">*</span>
								</label>
								<div className="relative">
									<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
										R$
									</span>
									<CurrencyInput
										ref={valorGeralInputRef}
										required
										integerOnly
										selectAllOnClick
										placeholder="0"
										value={valorGeral}
										onChangeValue={(num, str) => setValorGeral(str)}
										className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
									/>
								</div>
							</div>
						</div>
					) : (
						/* Modo Discriminado: Lista de Itens */
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
									Itens Discriminados
								</label>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => handleAddItem()}
										className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
										<Plus size={14} /> Adicionar Linha
									</button>
								</div>
							</div>

							{/* Sugestões Rápidas de Cookies / Combos */}
							<div className="flex flex-wrap gap-1.5 pb-1">
								<span className="text-[10px] font-bold text-slate-400 self-center mr-1">Sugestões:</span>
								{ITENS_SUGESTOES.slice(0, 4).map((sug, i) => (
									<button
										key={i}
										type="button"
										onClick={() => handleAddItem(sug)}
										className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 transition-colors">
										+ {sug.nome}
									</button>
								))}
							</div>

							{/* Lista de Itens */}
							<div className="space-y-2 max-h-60 overflow-y-auto pr-1">
								{itens.map((item, idx) => (
									<div
										key={item.id}
										className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
										<span className="text-[11px] font-black text-slate-400 w-5 text-center">
											{idx + 1}
										</span>
										<div className="flex-1 min-w-[140px]">
											<input
												type="text"
												placeholder="Nome do produto / item"
												value={item.nome}
												onChange={(e) => handleUpdateItem(item.id, "nome", e.target.value)}
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
											/>
										</div>
										<div className="w-16">
											<input
												type="number"
												min="1"
												placeholder="Qtd"
												value={item.quantidade || ""}
												onChange={(e) => handleUpdateItem(item.id, "quantidade", e.target.value)}
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-center font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
											/>
										</div>
										<div className="w-24">
											<CurrencyInput
												integerOnly
												selectAllOnClick
												placeholder="0"
												value={item.precoUnitario || 0}
												onChangeValue={(num) => handleUpdateItem(item.id, "precoUnitario", num)}
												className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-right font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
											/>
										</div>
										<div className="w-24 text-right pr-1">
											<span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
												R$ {Math.round(item.subtotal || 0).toLocaleString("pt-BR")}
											</span>
										</div>
										<button
											type="button"
											onClick={() => handleRemoveItem(item.id)}
											className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors">
											<Trash2 size={15} />
										</button>
									</div>
								))}
							</div>

							{/* Totalizador dos Itens */}
							<div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/60">
								<span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
									Total Somado dos Itens:
								</span>
								<span className="text-base font-black text-emerald-700 dark:text-emerald-300">
									R$ {Math.round(totalItens).toLocaleString("pt-BR")}
								</span>
							</div>
						</div>
					)}

					{/* Descrição */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
							<span>Descrição</span>
							<span className="text-[10px] text-slate-400 font-normal">Opcional (padrão: Faturamento)</span>
						</label>
						<input
							type="text"
							placeholder="Padrão: Faturamento"
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
						/>
					</div>

					{/* Observações */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
							Observações Adicionais (Opcional)
						</label>
						<textarea
							rows={2}
							placeholder="Observações sobre fechamento, divergências, promoções aplicadas..."
							value={observacoes}
							onChange={(e) => setObservacoes(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
						/>
					</div>

					{/* Botões de Ação */}
					<div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
						{editingFaturamento && onDelete ? (
							<button
								type="button"
								onClick={async () => {
									onClose();
									await onDelete(editingFaturamento.id);
								}}
								disabled={isSubmitting}
								className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50">
								<Trash2 size={14} />
								<span>Excluir</span>
							</button>
						) : (
							<div />
						)}
						<div className="flex items-center gap-2.5">
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
								className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black tracking-wide shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50">
								<CheckCircle2 size={16} />
								{isSubmitting ? "Salvando..." : editingFaturamento ? "Salvar Alterações" : "Gravar Faturamento"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
