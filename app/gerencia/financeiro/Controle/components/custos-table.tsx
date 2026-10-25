"use client";

import { useState } from "react";
import {
	Edit2,
	Trash2,
	DollarSign,
	Calendar,
	Store,
	Tag,
	Search,
	Filter,
	CreditCard,
	CheckCircle2,
	Clock,
} from "lucide-react";
import {
	CustoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
} from "@/types/financeiro-controle";

interface CustosTableProps {
	custos: CustoFinanceiro[];
	onEdit: (item: CustoFinanceiro) => void;
	onDelete: (id: string) => void;
}

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(val || 0);
};

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CustosTable({ custos, onEdit, onDelete }: CustosTableProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");

	// Filtragem
	const filteredList = custos.filter((c) => {
		if (categoriaFilter !== "all" && c.categoria !== categoriaFilter) return false;
		if (statusFilter !== "all" && c.status !== statusFilter) return false;

		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase();
			const matchDesc = c.descricao.toLowerCase().includes(term);
			const matchObs = c.observacoes?.toLowerCase().includes(term);
			const matchLoja = STORE_NAMES_EXTENDED[c.lojaId]?.toLowerCase().includes(term);
			const matchCat = CATEGORIAS_CUSTO_CONFIG[c.categoria]?.label.toLowerCase().includes(term);
			if (!matchDesc && !matchObs && !matchLoja && !matchCat) return false;
		}

		return true;
	});

	const totalFiltrado = filteredList.reduce((acc, curr) => acc + (curr.valor || 0), 0);

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 transition-colors">
			{/* Barra de Filtros da Tabela */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
						<span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
							<DollarSign size={16} />
						</span>
						Lançamentos de Custos & Despesas ({filteredList.length})
					</h3>
					<p className="text-xs text-slate-500 dark:text-slate-400">
						Listagem com dia do custo obrigatório, categoria e formas de liquidação
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{/* Busca */}
					<div className="relative">
						<Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
						<input
							type="text"
							placeholder="Buscar despesa ou fornecedor..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 w-48 sm:w-56"
						/>
					</div>

					{/* Filtro por Categoria */}
					<select
						value={categoriaFilter}
						onChange={(e) => setCategoriaFilter(e.target.value)}
						className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20">
						<option value="all">Todas as Categorias</option>
						{Object.entries(CATEGORIAS_CUSTO_CONFIG).map(([k, cfg]) => (
							<option key={k} value={k}>
								{cfg.label}
							</option>
						))}
					</select>

					{/* Filtro Status */}
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20">
						<option value="all">Todos os Status</option>
						<option value="pago">Liquidado (Pago)</option>
						<option value="pendente">Pendente</option>
					</select>
				</div>
			</div>

			{/* Tabela de Custos */}
			<div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
				<table className="w-full text-left text-xs min-w-[750px]">
					<thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
						<tr>
							<th className="py-3 px-4">Dia do Custo</th>
							<th className="py-3 px-3">Categoria</th>
							<th className="py-3 px-3">Loja</th>
							<th className="py-3 px-3">Descrição da Despesa</th>
							<th className="py-3 px-3">Pagamento</th>
							<th className="py-3 px-3">Situação</th>
							<th className="py-3 px-4 text-right">Valor</th>
							<th className="py-3 px-4 text-center w-24">Ações</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
						{filteredList.length === 0 ? (
							<tr>
								<td colSpan={8} className="py-10 text-center text-slate-400">
									Nenhum lançamento de custo encontrado para os filtros selecionados.
								</td>
							</tr>
						) : (
							filteredList.map((custo) => {
								const [ano, mes, dia] = custo.data.split("-");
								const dateObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
								const diaSemana = DIAS_SEMANA_ABREV[dateObj.getDay()];
								const dataFormatada = `${dia}/${mes}/${ano}`;

								const catConfig = CATEGORIAS_CUSTO_CONFIG[custo.categoria];

								return (
									<tr
										key={custo.id}
										className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
										{/* Dia do Custo */}
										<td className="py-3 px-4 whitespace-nowrap">
											<span className="font-black text-slate-900 dark:text-slate-100 block">
												{dataFormatada}
											</span>
											<span className="text-[10px] text-slate-400 font-bold">
												{diaSemana}
											</span>
										</td>

										{/* Categoria */}
										<td className="py-3 px-3 whitespace-nowrap">
											<span
												className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catConfig?.bgLight} ${catConfig?.borderLight} ${catConfig?.textLight} ${catConfig?.bgDark} ${catConfig?.borderDark} ${catConfig?.textDark}`}>
												<span
													className="w-2 h-2 rounded-full"
													style={{ backgroundColor: catConfig?.color || "#64748b" }}
												/>
												{catConfig?.label || custo.categoria}
											</span>
										</td>

										{/* Loja */}
										<td className="py-3 px-3 whitespace-nowrap">
											<span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
												{STORE_NAMES_EXTENDED[custo.lojaId] || custo.lojaId}
											</span>
										</td>

										{/* Descrição */}
										<td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-semibold max-w-xs truncate">
											<span>{custo.descricao}</span>
											{custo.observacoes && (
												<span className="block text-[10px] text-slate-400 font-normal truncate">
													{custo.observacoes}
												</span>
											)}
										</td>

										{/* Pagamento */}
										<td className="py-3 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 capitalize">
											{custo.metodoPagamento || "Pix"}
										</td>

										{/* Situação */}
										<td className="py-3 px-3 whitespace-nowrap">
											{custo.status === "pendente" ? (
												<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
													<Clock size={11} /> Pendente
												</span>
											) : (
												<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
													<CheckCircle2 size={11} /> Liquidado
												</span>
											)}
										</td>

										{/* Valor */}
										<td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap text-sm">
											{formatCurrency(custo.valor)}
										</td>

										{/* Ações */}
										<td className="py-3 px-4 text-center whitespace-nowrap">
											<div className="flex items-center justify-center gap-1">
												<button
													type="button"
													title="Editar Custo"
													onClick={() => onEdit(custo)}
													className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors">
													<Edit2 size={15} />
												</button>
												<button
													type="button"
													title="Excluir Custo"
													onClick={() => onDelete(custo.id)}
													className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors">
													<Trash2 size={15} />
												</button>
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
					<tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t border-slate-200 dark:border-slate-800">
						<tr>
							<td colSpan={6} className="py-3 px-4 text-slate-700 dark:text-slate-300">
								Total em Custos ({filteredList.length} lançamentos)
							</td>
							<td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 text-sm">
								{formatCurrency(totalFiltrado)}
							</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	);
}
