"use client";

import { useState } from "react";
import {
	Eye,
	Edit2,
	Trash2,
	DollarSign,
	Calendar,
	Store,
	Layers,
	ListOrdered,
	Search,
	Filter,
	ArrowUpDown,
} from "lucide-react";
import {
	FaturamentoFinanceiro,
	CANAL_VENDA_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
} from "@/types/financeiro-controle";

interface FaturamentoTableProps {
	faturamentos: FaturamentoFinanceiro[];
	onViewDetails: (item: FaturamentoFinanceiro) => void;
	onEdit: (item: FaturamentoFinanceiro) => void;
	onDelete: (id: string) => void;
}

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(val || 0);
};

export default function FaturamentoTable({
	faturamentos,
	onViewDetails,
	onEdit,
	onDelete,
}: FaturamentoTableProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [canalFilter, setCanalFilter] = useState<string>("all");
	const [tipoFilter, setTipoFilter] = useState<string>("all");

	// Filtragem
	const filteredList = faturamentos.filter((fat) => {
		if (canalFilter !== "all" && fat.canal !== canalFilter) return false;
		if (tipoFilter !== "all" && fat.tipo !== tipoFilter) return false;

		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase();
			const matchDesc = fat.descricao?.toLowerCase().includes(term);
			const matchObs = fat.observacoes?.toLowerCase().includes(term);
			const matchLoja = STORE_NAMES_EXTENDED[fat.lojaId]?.toLowerCase().includes(term);
			const matchItem = fat.itens?.some((it) => it.nome.toLowerCase().includes(term));
			if (!matchDesc && !matchObs && !matchLoja && !matchItem) return false;
		}

		return true;
	});

	const totalFiltrado = filteredList.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 transition-colors">
			{/* Barra de Filtros da Tabela */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
						<span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
							<DollarSign size={16} />
						</span>
						Lançamentos de Faturamento ({filteredList.length})
					</h3>
					<p className="text-xs text-slate-500 dark:text-slate-400">
						Visualização individual das vendas diárias e totais consolidados
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{/* Busca */}
					<div className="relative">
						<Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
						<input
							type="text"
							placeholder="Buscar vendas ou produtos..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48 sm:w-56"
						/>
					</div>

					{/* Filtro Canal */}
					<select
						value={canalFilter}
						onChange={(e) => setCanalFilter(e.target.value)}
						className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
						<option value="all">Todos os Canais</option>
						{Object.entries(CANAL_VENDA_CONFIG).map(([k, cfg]) => (
							<option key={k} value={k}>
								{cfg.label}
							</option>
						))}
					</select>

					{/* Filtro Tipo */}
					<select
						value={tipoFilter}
						onChange={(e) => setTipoFilter(e.target.value)}
						className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
						<option value="all">Todos os Tipos</option>
						<option value="geral">Geral (Consolidado)</option>
						<option value="discriminado">Discriminado por Itens</option>
					</select>
				</div>
			</div>

			{/* Tabela de Lançamentos */}
			<div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
				<table className="w-full text-left text-xs min-w-[700px]">
					<thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
						<tr>
							<th className="py-3 px-4">Data</th>
							<th className="py-3 px-3">Loja</th>
							<th className="py-3 px-3">Tipo / Detalhes</th>
							<th className="py-3 px-3">Canal</th>
							<th className="py-3 px-3">Descrição</th>
							<th className="py-3 px-4 text-right">Valor Total</th>
							<th className="py-3 px-4 text-center w-28">Ações</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
						{filteredList.length === 0 ? (
							<tr>
								<td colSpan={7} className="py-10 text-center text-slate-400">
									Nenhum lançamento de faturamento encontrado para os filtros selecionados.
								</td>
							</tr>
						) : (
							filteredList.map((fat) => {
								const [ano, mes, dia] = fat.data.split("-");
								const dataFormatada = `${dia}/${mes}/${ano}`;

								return (
									<tr
										key={fat.id}
										className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
										{/* Data */}
										<td className="py-3 px-4 font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
											{dataFormatada}
										</td>

										{/* Loja */}
										<td className="py-3 px-3 whitespace-nowrap">
											<span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
												{STORE_NAMES_EXTENDED[fat.lojaId] || fat.lojaId}
											</span>
										</td>

										{/* Tipo / Badge */}
										<td className="py-3 px-3 whitespace-nowrap">
											{fat.tipo === "discriminado" ? (
												<button
													type="button"
													onClick={() => onViewDetails(fat)}
													className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:underline">
													<ListOrdered size={12} />
													{fat.itens?.length || 0} itens discriminados
												</button>
											) : (
												<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
													<Layers size={12} />
													Geral
												</span>
											)}
										</td>

										{/* Canal */}
										<td className="py-3 px-3 whitespace-nowrap">
											<span
												className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
													fat.canal
														? CANAL_VENDA_CONFIG[fat.canal]?.badge
														: "bg-slate-100 text-slate-700"
												}`}>
												{fat.canal ? CANAL_VENDA_CONFIG[fat.canal]?.label : "Geral"}
											</span>
										</td>

										{/* Descrição */}
										<td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
											{fat.descricao || (fat.tipo === "discriminado" ? "Vendas discriminadas" : "—")}
										</td>

										{/* Valor Total */}
										<td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-sm">
											{formatCurrency(fat.valorTotal)}
										</td>

										{/* Ações */}
										<td className="py-3 px-4 text-center whitespace-nowrap">
											<div className="flex items-center justify-center gap-1">
												<button
													type="button"
													title="Ver Detalhes do Faturamento"
													onClick={() => onViewDetails(fat)}
													className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors">
													<Eye size={15} />
												</button>
												<button
													type="button"
													title="Editar Lançamento"
													onClick={() => onEdit(fat)}
													className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors">
													<Edit2 size={15} />
												</button>
												<button
													type="button"
													title="Excluir Lançamento"
													onClick={() => onDelete(fat.id)}
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
							<td colSpan={5} className="py-3 px-4 text-slate-700 dark:text-slate-300">
								Total Consolidado ({filteredList.length} lançamentos)
							</td>
							<td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 text-sm">
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
