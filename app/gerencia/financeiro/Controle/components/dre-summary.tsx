"use client";

import {
	TrendingUp,
	TrendingDown,
	DollarSign,
	PieChart,
	FileSpreadsheet,
	HelpCircle,
	CheckCircle2,
	AlertTriangle,
} from "lucide-react";
import {
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	CustoFinanceiro,
	FaturamentoFinanceiro,
} from "@/types/financeiro-controle";

interface DreSummaryProps {
	faturamentos: FaturamentoFinanceiro[];
	custos: CustoFinanceiro[];
	totalFaturamento: number;
	totalCustos: number;
	lucroLiquido: number;
	margemLiquida: number;
}

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(val || 0);
};

export default function DreSummary({
	faturamentos,
	custos,
	totalFaturamento,
	totalCustos,
	lucroLiquido,
	margemLiquida,
}: DreSummaryProps) {
	// Agrupamento por Categoria
	const custosPorCategoria: Record<CategoriaCusto, { valor: number; qtd: number }> = {
		cookies: { valor: 0, qtd: 0 },
		insumos: { valor: 0, qtd: 0 },
		impostos: { valor: 0, qtd: 0 },
		royalties: { valor: 0, qtd: 0 },
		fundo_promocional: { valor: 0, qtd: 0 },
		aluguel: { valor: 0, qtd: 0 },
		energia: { valor: 0, qtd: 0 },
		contador: { valor: 0, qtd: 0 },
		folha: { valor: 0, qtd: 0 },
		outros: { valor: 0, qtd: 0 },
	};

	custos.forEach((c) => {
		if (custosPorCategoria[c.categoria]) {
			custosPorCategoria[c.categoria].valor += c.valor || 0;
			custosPorCategoria[c.categoria].qtd += 1;
		} else {
			custosPorCategoria.outros.valor += c.valor || 0;
			custosPorCategoria.outros.qtd += 1;
		}
	});

	// Grupos Gerenciais para Análise DRE
	const custoMercadoria =
		custosPorCategoria.cookies.valor + custosPorCategoria.insumos.valor; // CMV / CPV
	const margemBruta = totalFaturamento - custoMercadoria;
	const margemBrutaPercent = totalFaturamento > 0 ? (margemBruta / totalFaturamento) * 100 : 0;

	const despesasOcupacao =
		custosPorCategoria.aluguel.valor + custosPorCategoria.energia.valor;
	const despesasFranquia =
		custosPorCategoria.royalties.valor + custosPorCategoria.fundo_promocional.valor;
	const despesasPessoalContabil =
		custosPorCategoria.folha.valor + custosPorCategoria.contador.valor;
	const tributosImpostos = custosPorCategoria.impostos.valor;
	const outrasDespesas = custosPorCategoria.outros.valor;

	const percentDoFat = (val: number) => {
		if (totalFaturamento <= 0) return "0,0%";
		return `${((val / totalFaturamento) * 100).toFixed(1)}%`;
	};

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-6 transition-colors">
			{/* Cabeçalho */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
				<div>
					<h3 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
						<span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
							<FileSpreadsheet size={18} />
						</span>
						DRE Gerencial Simplificado (Demonstrativo de Resultado)
					</h3>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
						Visão executiva da estrutura de receitas, custos diretos, franquia, despesas fixas e margens
					</p>
				</div>
			</div>

			{/* Cards de Resumo Gerencial */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
				{/* Faturamento Bruto */}
				<div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
					<span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
						(+) Receita Bruta Total
					</span>
					<span className="text-xl md:text-2xl font-black text-emerald-800 dark:text-emerald-200 block mt-1">
						{formatCurrency(totalFaturamento)}
					</span>
					<span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
						100% da base operacional
					</span>
				</div>

				{/* Custos Operacionais */}
				<div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40">
					<span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
						(-) Total de Custos & Despesas
					</span>
					<span className="text-xl md:text-2xl font-black text-rose-800 dark:text-rose-200 block mt-1">
						{formatCurrency(totalCustos)}
					</span>
					<span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1 block">
						{percentDoFat(totalCustos)} do faturamento
					</span>
				</div>

				{/* Lucro Operacional Líquido */}
				<div
					className={`p-4 rounded-2xl border ${
						lucroLiquido >= 0
							? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40"
							: "bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40"
					}`}>
					<span
						className={`text-[11px] font-bold uppercase tracking-wider block ${
							lucroLiquido >= 0 ? "text-blue-700 dark:text-blue-400" : "text-red-700 dark:text-red-400"
						}`}>
						(=) Resultado Líquido Operacional
					</span>
					<span
						className={`text-xl md:text-2xl font-black block mt-1 ${
							lucroLiquido >= 0 ? "text-blue-800 dark:text-blue-200" : "text-red-800 dark:text-red-200"
						}`}>
						{formatCurrency(lucroLiquido)}
					</span>
					<span
						className={`text-[11px] font-black mt-1 block ${
							lucroLiquido >= 0 ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"
						}`}>
						Margem Líquida: {margemLiquida.toFixed(1)}%
					</span>
				</div>
			</div>

			{/* Tabela Estruturada do DRE */}
			<div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
				<table className="w-full text-left text-xs">
					<thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
						<tr>
							<th className="py-3 px-4">Linha do Demonstrativo</th>
							<th className="py-3 px-3 text-center w-28">Lançamentos</th>
							<th className="py-3 px-4 text-right w-36">% da Receita</th>
							<th className="py-3 px-4 text-right w-40">Valor (R$)</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
						{/* Faturamento Bruto */}
						<tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-black">
							<td className="py-3 px-4 text-emerald-900 dark:text-emerald-200 text-sm">
								(+) FATURAMENTO BRUTO TOTAL
							</td>
							<td className="py-3 px-3 text-center text-slate-500 font-bold">
								{faturamentos.length}
							</td>
							<td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-300 font-black">
								100,0%
							</td>
							<td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-300 text-sm">
								{formatCurrency(totalFaturamento)}
							</td>
						</tr>

						{/* 1. Custos Diretos de Produto (Cookies e Insumos) */}
						<tr className="bg-slate-50/70 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-300">
							<td colSpan={2} className="py-2.5 px-4">
								1. Custo das Mercadorias / Produtos (CPV / CMV)
							</td>
							<td className="py-2.5 px-4 text-right text-slate-500">
								{percentDoFat(custoMercadoria)}
							</td>
							<td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
								{formatCurrency(custoMercadoria)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-amber-500" />
								Cookies (Produção e lotes)
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.cookies.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.cookies.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.cookies.valor)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-orange-500" />
								Insumos (Embalagens e ingredientes)
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.insumos.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.insumos.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.insumos.valor)}
							</td>
						</tr>

						{/* Margem Bruta Operacional */}
						<tr className="bg-slate-100/60 dark:bg-slate-800/50 font-black text-slate-800 dark:text-slate-200">
							<td colSpan={2} className="py-2.5 px-4">
								(=) MARGEM BRUTA OPERACIONAL
							</td>
							<td className="py-2.5 px-4 text-right text-blue-600 dark:text-blue-400">
								{margemBrutaPercent.toFixed(1)}%
							</td>
							<td className="py-2.5 px-4 text-right text-blue-600 dark:text-blue-400">
								{formatCurrency(margemBruta)}
							</td>
						</tr>

						{/* 2. Ocupação & Utilidades */}
						<tr className="bg-slate-50/70 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-300">
							<td colSpan={2} className="py-2.5 px-4">
								2. Custos de Ocupação & Utilidades
							</td>
							<td className="py-2.5 px-4 text-right text-slate-500">
								{percentDoFat(despesasOcupacao)}
							</td>
							<td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
								{formatCurrency(despesasOcupacao)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-indigo-500" />
								Aluguel & Condomínio
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.aluguel.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.aluguel.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.aluguel.valor)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-yellow-500" />
								Energia Elétrica
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.energia.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.energia.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.energia.valor)}
							</td>
						</tr>

						{/* 3. Franquia & Marketing */}
						<tr className="bg-slate-50/70 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-300">
							<td colSpan={2} className="py-2.5 px-4">
								3. Custos de Franquia & Divulgação
							</td>
							<td className="py-2.5 px-4 text-right text-slate-500">
								{percentDoFat(despesasFranquia)}
							</td>
							<td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
								{formatCurrency(despesasFranquia)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-purple-500" />
								Royalties Franquia
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.royalties.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.royalties.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.royalties.valor)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-blue-500" />
								Fundo Promocional (Marketing)
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.fundo_promocional.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.fundo_promocional.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.fundo_promocional.valor)}
							</td>
						</tr>

						{/* 4. Pessoal & Assessoria */}
						<tr className="bg-slate-50/70 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-300">
							<td colSpan={2} className="py-2.5 px-4">
								4. Folha de Pagamento & Contabilidade
							</td>
							<td className="py-2.5 px-4 text-right text-slate-500">
								{percentDoFat(despesasPessoalContabil)}
							</td>
							<td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
								{formatCurrency(despesasPessoalContabil)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-cyan-500" />
								Folha de Pagamento & Encargos
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.folha.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.folha.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.folha.valor)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-emerald-500" />
								Contador & Assessoria Fiscal
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.contador.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.contador.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.contador.valor)}
							</td>
						</tr>

						{/* 5. Impostos */}
						<tr className="bg-slate-50/70 dark:bg-slate-800/40 font-bold text-slate-700 dark:text-slate-300">
							<td colSpan={2} className="py-2.5 px-4">
								5. Impostos & Tributos (DAS / Simples)
							</td>
							<td className="py-2.5 px-4 text-right text-slate-500">
								{percentDoFat(tributosImpostos)}
							</td>
							<td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-black">
								{formatCurrency(tributosImpostos)}
							</td>
						</tr>
						<tr className="hover:bg-slate-50/30">
							<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
								<span className="w-2 h-2 rounded-full bg-rose-500" />
								Impostos (DAS, ICMS, Tributos)
							</td>
							<td className="py-2 px-3 text-center text-slate-400">
								{custosPorCategoria.impostos.qtd}
							</td>
							<td className="py-2 px-4 text-right text-slate-400">
								{percentDoFat(custosPorCategoria.impostos.valor)}
							</td>
							<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
								{formatCurrency(custosPorCategoria.impostos.valor)}
							</td>
						</tr>

						{/* 6. Outros */}
						{custosPorCategoria.outros.valor > 0 && (
							<tr className="hover:bg-slate-50/30">
								<td className="py-2 pl-8 pr-4 text-slate-600 dark:text-slate-400 flex items-center gap-2">
									<span className="w-2 h-2 rounded-full bg-slate-500" />
									Outras Despesas Operacionais
								</td>
								<td className="py-2 px-3 text-center text-slate-400">
									{custosPorCategoria.outros.qtd}
								</td>
								<td className="py-2 px-4 text-right text-slate-400">
									{percentDoFat(outrasDespesas)}
								</td>
								<td className="py-2 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
									{formatCurrency(outrasDespesas)}
								</td>
							</tr>
						)}

						{/* Total de Custos */}
						<tr className="bg-rose-50/50 dark:bg-rose-950/20 font-black text-rose-900 dark:text-rose-200">
							<td colSpan={2} className="py-3 px-4 text-sm">
								(-) TOTAL DE CUSTOS & DESPESAS
							</td>
							<td className="py-3 px-4 text-right text-rose-700 dark:text-rose-300 font-black">
								{percentDoFat(totalCustos)}
							</td>
							<td className="py-3 px-4 text-right text-rose-700 dark:text-rose-300 text-sm">
								{formatCurrency(totalCustos)}
							</td>
						</tr>

						{/* RESULTADO LÍQUIDO */}
						<tr
							className={`font-black text-base border-t-2 ${
								lucroLiquido >= 0
									? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 border-blue-400"
									: "bg-red-50/80 dark:bg-red-950/40 text-red-950 dark:text-red-100 border-red-400"
							}`}>
							<td colSpan={2} className="py-4 px-4 tracking-wide">
								(=) LUCRO OPERACIONAL LÍQUIDO
							</td>
							<td
								className={`py-4 px-4 text-right font-black ${
									lucroLiquido >= 0 ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300"
								}`}>
								{margemLiquida.toFixed(1)}%
							</td>
							<td
								className={`py-4 px-4 text-right font-black text-lg ${
									lucroLiquido >= 0 ? "text-blue-700 dark:text-blue-300" : "text-red-700 dark:text-red-300"
								}`}>
								{formatCurrency(lucroLiquido)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}
