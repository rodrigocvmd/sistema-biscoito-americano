"use client";

import { useState, useEffect, useRef } from "react";
import {
	X,
	DollarSign,
	Calendar,
	Store,
	Tag,
	CheckCircle2,
	FileText,
	Plus,
	Trash2,
} from "lucide-react";
import {
	CustoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	MetodoPagamento,
} from "@/types/financeiro-controle";
import { CurrencyInput } from "@/components/currency-input";
import { DateInputBR } from "@/components/date-input-br";

interface CustoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: Omit<CustoFinanceiro, "id" | "createdAt" | "updatedAt">) => Promise<void>;
	onDelete?: (id: string) => Promise<void> | void;
	editingCusto?: CustoFinanceiro | null;
	defaultCategoria?: CategoriaCusto;
	defaultLoja?: StoreIdWithGeral;
	defaultData?: string;
}

export default function CustoModal({
	isOpen,
	onClose,
	onSave,
	onDelete,
	editingCusto,
	defaultCategoria = "cookies",
	defaultLoja = "geral",
	defaultData,
}: CustoModalProps) {
	const [categoria, setCategoria] = useState<CategoriaCusto>(defaultCategoria);
	const [lojaId, setLojaId] = useState<StoreIdWithGeral>(defaultLoja);
	const [dataCusto, setDataCusto] = useState("");
	const [multiDatasEnabled, setMultiDatasEnabled] = useState(false);
	const [multiDatas, setMultiDatas] = useState<string[]>([]);
	const [descricao, setDescricao] = useState("");
	const [valor, setValor] = useState("");
	const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>("pix");
	const [status, setStatus] = useState<"pago" | "pendente">("pago");
	const [observacoes, setObservacoes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const valorInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			if (editingCusto) {
				setCategoria(editingCusto.categoria);
				setLojaId(editingCusto.lojaId);
				setDataCusto(editingCusto.data);
				setMultiDatasEnabled(false);
				setMultiDatas([]);
				setDescricao(editingCusto.descricao);
				setValor(
					editingCusto.valor ? String(Math.round(editingCusto.valor)) : ""
				);
				setMetodoPagamento(editingCusto.metodoPagamento || "pix");
				setStatus(editingCusto.status || "pago");
				setObservacoes(editingCusto.observacoes || "");
			} else {
				const now = new Date();
				const year = now.getFullYear();
				const month = String(now.getMonth() + 1).padStart(2, "0");
				const day = String(now.getDate()).padStart(2, "0");
				const todayStr = `${year}-${month}-${day}`;
				const initialDate = defaultData || todayStr;

				setCategoria(defaultCategoria);
				setLojaId(defaultLoja);
				setDataCusto(initialDate);
				setMultiDatasEnabled(false);
				setMultiDatas([initialDate, initialDate]);
				setDescricao("");
				setValor("");
				setMetodoPagamento("pix");
				setStatus("pago");
				setObservacoes("");
			}

			// Focar e selecionar automaticamente o campo de valor financeiro
			setTimeout(() => {
				if (valorInputRef.current) {
					valorInputRef.current.focus();
					valorInputRef.current.select();
				}
			}, 100);
		}
	}, [isOpen, editingCusto, defaultCategoria, defaultLoja, defaultData]);

	if (!isOpen) return null;

	const catConfig = CATEGORIAS_CUSTO_CONFIG[categoria];

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const defaultDesc = catConfig?.label || "Custo";
		const finalDescricao = descricao.trim() || defaultDesc;

		const cleanedVal = valor.replace(/\D/g, "").trim();
		const valNum = cleanedVal ? parseInt(cleanedVal, 10) : 0;
		if (isNaN(valNum) || valNum <= 0) {
			alert("Por favor, insira um valor monetário válido maior que zero.");
			return;
		}

		if (multiDatasEnabled && !editingCusto) {
			const filledDates = multiDatas.map((d) => d.trim()).filter(Boolean);
			if (filledDates.length < 2) {
				alert("Por favor, selecione 2 ou mais datas para realizar o lançamento múltiplo.");
				return;
			}
			if (multiDatas.some((d) => !d.trim())) {
				alert("Por favor, preencha todas as datas adicionadas ou remova as linhas vazias.");
				return;
			}

			setIsSubmitting(true);
			try {
				for (const d of filledDates) {
					await onSave({
						categoria,
						lojaId,
						descricao: finalDescricao,
						valor: Math.round(valNum),
						data: d,
						mesReferencia: d.slice(0, 7),
						metodoPagamento,
						status,
						observacoes: observacoes.trim() || undefined,
					});
				}
				onClose();
			} catch (error) {
				console.error("Erro ao salvar custos:", error);
				alert("Erro ao salvar lançamentos de custo.");
			} finally {
				setIsSubmitting(false);
			}
			return;
		}

		if (!dataCusto) {
			alert("O dia do custo é obrigatório.");
			return;
		}

		const mesReferencia = dataCusto.slice(0, 7);

		setIsSubmitting(true);
		try {
			await onSave({
				categoria,
				lojaId,
				descricao: finalDescricao,
				valor: Math.round(valNum),
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

					{/* Checkbox para múltiplas datas */}
					{!editingCusto && (
						<div className="flex items-center justify-between p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900/50">
							<label className="flex items-center gap-2.5 cursor-pointer select-none">
								<input
									type="checkbox"
									checked={multiDatasEnabled}
									onChange={(e) => {
										const checked = e.target.checked;
										setMultiDatasEnabled(checked);
										if (checked && multiDatas.length < 2) {
											const baseDate = dataCusto || new Date().toISOString().split("T")[0];
											setMultiDatas([baseDate, baseDate]);
										}
									}}
									className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
								/>
								<span className="text-xs font-bold text-blue-900 dark:text-blue-200">
									Lançar em datas diversas (mesmo custo em múltiplas datas)
								</span>
							</label>
							{multiDatasEnabled && (
								<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
									Mínimo 2 datas
								</span>
							)}
						</div>
					)}

					{multiDatasEnabled && !editingCusto ? (
						<>
							{/* Linha: Unidade / Loja */}
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

							{/* Bloco de Múltiplas Datas */}
							<div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
								<div className="flex items-center justify-between">
									<label className="block text-xs font-black text-slate-700 dark:text-slate-300">
										Datas de Lançamento <span className="text-rose-500">*</span>
										<span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
											({multiDatas.filter(Boolean).length} data(s) preenchida(s))
										</span>
									</label>
									<button
										type="button"
										onClick={() => {
											setMultiDatas((prev) => {
												const lastDate = prev[prev.length - 1] || dataCusto || "";
												return [...prev, lastDate];
											});
										}}
										className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
										<Plus size={14} /> Adicionar data
									</button>
								</div>

								<div className="space-y-2">
									{multiDatas.map((dt, idx) => (
										<div key={idx} className="flex items-center gap-2">
											<span className="text-xs font-bold text-slate-400 w-5 text-right">{idx + 1}.</span>
											<div className="flex-1">
												<DateInputBR
													required
													value={dt}
													onChangeDate={(iso) => {
														setMultiDatas((prev) => {
															const updated = [...prev];
															updated[idx] = iso;
															return updated;
														});
													}}
													onClick={(e) => e.currentTarget.select()}
													className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
												/>
											</div>
											{multiDatas.length > 2 && (
												<button
													type="button"
													onClick={() => setMultiDatas((prev) => prev.filter((_, i) => i !== idx))}
													className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
													title="Remover data">
													<Trash2 size={16} />
												</button>
											)}
										</div>
									))}
								</div>
							</div>
						</>
					) : (
						/* Linha: Data (Obrigatória) e Loja */
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
									<span>
										Data do Custo <span className="text-rose-500">*</span>
									</span>
									<span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
										Obrigatório
									</span>
								</label>
								<div className="relative">
									<DateInputBR
										required
										value={dataCusto}
										onChangeDate={(iso) => setDataCusto(iso)}
										onClick={(e) => e.currentTarget.select()}
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
					)}

					{/* Descrição do Custo */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
							<span>Descrição do Custo</span>
							<span className="text-[10px] text-slate-400 font-normal">
								Opcional (padrão: {catConfig?.label || "Tipo de custo"})
							</span>
						</label>
						<input
							type="text"
							placeholder={`Padrão: ${catConfig?.label || "Tipo de custo"}`}
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
							<CurrencyInput
								ref={valorInputRef}
								required
								integerOnly
								selectAllOnClick
								placeholder="0"
								value={valor}
								onChangeValue={(num, str) => setValor(str)}
								className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
							/>
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
					<div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
						{editingCusto && onDelete ? (
							<button
								type="button"
								onClick={async () => {
									onClose();
									await onDelete(editingCusto.id);
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
								className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-black tracking-wide shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50">
								<CheckCircle2 size={16} />
								{isSubmitting
									? "Gravando..."
									: editingCusto
									? "Salvar Alterações"
									: multiDatasEnabled
									? `Gravar Custos (${multiDatas.filter(Boolean).length} datas)`
									: "Gravar Custo"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
