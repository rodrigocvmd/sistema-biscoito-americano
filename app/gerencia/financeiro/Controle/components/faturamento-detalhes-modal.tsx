"use client";

import {
	X,
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
	CANAL_VENDA_CONFIG,
	STORE_NAMES_EXTENDED,
} from "@/types/financeiro-controle";

interface FaturamentoDetalhesModalProps {
	faturamento: FaturamentoFinanceiro | null;
	onClose: () => void;
	onEdit?: (faturamento: FaturamentoFinanceiro) => void;
}

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(val || 0);
};

export default function FaturamentoDetalhesModal({
	faturamento,
	onClose,
	onEdit,
}: FaturamentoDetalhesModalProps) {
	if (!faturamento) return null;

	const [year, month, day] = faturamento.data.split("-");
	const formattedDate = `${day}/${month}/${year}`;

	return (
		<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
				{/* Header */}
				<div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
					<div className="flex items-center gap-2.5">
						<span className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
							<DollarSign size={20} />
						</span>
						<div>
							<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
								Detalhamento do Faturamento
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Verificação individual de vendas e itens registrados
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

				{/* Content */}
				<div className="p-6 space-y-5 overflow-y-auto flex-1">
					{/* Cards de Metadados Principais */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
								Data
							</span>
							<p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
								{formattedDate}
							</p>
						</div>

						<div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
								Loja / Unidade
							</span>
							<p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
								{STORE_NAMES_EXTENDED[faturamento.lojaId] || faturamento.lojaId}
							</p>
						</div>

						<div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
								Canal
							</span>
							<p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 truncate">
								{faturamento.canal ? CANAL_VENDA_CONFIG[faturamento.canal]?.label : "Geral"}
							</p>
						</div>

						<div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
							<span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
								Total
							</span>
							<p className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
								{formatCurrency(faturamento.valorTotal)}
							</p>
						</div>
					</div>

					{/* Descrição */}
					{faturamento.descricao && (
						<div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
							<span className="text-[10px] font-bold text-slate-400 uppercase">Descrição:</span>
							<p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
								{faturamento.descricao}
							</p>
						</div>
					)}

					{/* Itens Discriminados (se houver) */}
					{faturamento.tipo === "discriminado" && faturamento.itens && faturamento.itens.length > 0 ? (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
									<ListOrdered size={15} /> Itens Discriminados ({faturamento.itens.length})
								</h4>
								<span className="text-[11px] font-bold text-slate-400">
									Soma: {formatCurrency(faturamento.valorTotal)}
								</span>
							</div>

							<div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
								<table className="w-full text-left text-xs">
									<thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
										<tr>
											<th className="py-2.5 px-3">Item / Produto</th>
											<th className="py-2.5 px-3 text-center w-16">Qtd</th>
											<th className="py-2.5 px-3 text-right w-24">Unitário</th>
											<th className="py-2.5 px-3 text-right w-28">Subtotal</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
										{faturamento.itens.map((item, idx) => (
											<tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
												<td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
													{item.nome}
												</td>
												<td className="py-2.5 px-3 text-center font-bold text-slate-600 dark:text-slate-400">
													{item.quantidade}
												</td>
												<td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
													{formatCurrency(item.precoUnitario)}
												</td>
												<td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
													{formatCurrency(item.subtotal)}
												</td>
											</tr>
										))}
									</tbody>
									<tfoot className="bg-slate-50/80 dark:bg-slate-800/80 font-black border-t border-slate-200 dark:border-slate-800">
										<tr>
											<td colSpan={3} className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
												Total Geral
											</td>
											<td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
												{formatCurrency(faturamento.valorTotal)}
											</td>
										</tr>
									</tfoot>
								</table>
							</div>
						</div>
					) : (
						<div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
							<span className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
								<Layers size={18} />
							</span>
							<div>
								<p className="text-xs font-bold text-slate-800 dark:text-slate-200">
									Lançamento Consolidado (Geral)
								</p>
								<p className="text-[11px] text-slate-500">
									Valor total registrado diretamente sem itens individuais.
								</p>
							</div>
						</div>
					)}

					{/* Observações */}
					{faturamento.observacoes && (
						<div className="space-y-1">
							<span className="text-[11px] font-bold text-slate-400 uppercase">Observações:</span>
							<p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
								{faturamento.observacoes}
							</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
					<span className="text-[11px] text-slate-400">ID: {faturamento.id}</span>
					<div className="flex items-center gap-2">
						{onEdit && (
							<button
								type="button"
								onClick={() => {
									onClose();
									onEdit(faturamento);
								}}
								className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors">
								Editar
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
							Fechar
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
