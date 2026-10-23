"use client";

import { useState, useMemo } from "react";
import {
	Calculator,
	DollarSign,
	TrendingUp,
	TrendingDown,
	Percent,
	Truck,
	CreditCard,
	Info,
	RotateCcw,
	Receipt,
	Building,
	Zap,
	Users,
	Package,
	Store,
	BadgePercent,
	Sliders,
} from "lucide-react";

interface CostItemConfig {
	id: string;
	name: string;
	category: "Operacional" | "Ocupação" | "Tributário & Franquia" | "Venda & Transação";
	defaultPercent: number;
	icon: any;
	description?: string;
}

const DEFAULT_COSTS: CostItemConfig[] = [
	{
		id: "materiaPrima",
		name: "Matéria Prima",
		category: "Operacional",
		defaultPercent: 30,
		icon: Package,
		description: "Insumos base dos produtos vendidos",
	},
	{
		id: "folhaPagamento",
		name: "Folha de Pagamento",
		category: "Operacional",
		defaultPercent: 15,
		icon: Users,
		description: "Salários, encargos e benefícios da equipe",
	},
	{
		id: "insumos",
		name: "Insumos Operacionais",
		category: "Operacional",
		defaultPercent: 8,
		icon: Store,
		description: "Embalagens, descartáveis e itens de apoio",
	},
	{
		id: "energia",
		name: "Energia Elétrica",
		category: "Operacional",
		defaultPercent: 2,
		icon: Zap,
		description: "Consumo de luz e refrigeração",
	},
	{
		id: "aluguel",
		name: "Aluguel & Ocupação",
		category: "Ocupação",
		defaultPercent: 10,
		icon: Building,
		description: "Locação do ponto, condomínio e taxas prediais",
	},
	{
		id: "impostos",
		name: "Impostos",
		category: "Tributário & Franquia",
		defaultPercent: 5,
		icon: Receipt,
		description: "Simples Nacional ou tributos incidentes sobre a venda",
	},
	{
		id: "royalties",
		name: "Royalties",
		category: "Tributário & Franquia",
		defaultPercent: 5,
		icon: BadgePercent,
		description: "Taxa de franquia sobre faturamento",
	},
	{
		id: "fundoPromocao",
		name: "Fundo de Promoção",
		category: "Tributário & Franquia",
		defaultPercent: 2,
		icon: Percent,
		description: "Fundo de propaganda e marketing institucional",
	},
	{
		id: "taxaCartao",
		name: "Taxa de Cartão",
		category: "Venda & Transação",
		defaultPercent: 2.5,
		icon: CreditCard,
		description: "Taxas de processamento de maquininha de cartão / TEF",
	},
];

const DELIVERY_RATE = 7.5; // Taxa delivery fixa/padrão quando ativo

export default function CalculadoraPage() {
	// Valor da venda inserido pelo usuário
	const [saleValueInput, setSaleValueInput] = useState<string>("100,00");
	const [isDelivery, setIsDelivery] = useState<boolean>(false);
	const [showAdjustments, setShowAdjustments] = useState<boolean>(false);

	// Customização de alíquotas percentuais (para quem quiser ajustar)
	const [customPercentages, setCustomPercentages] = useState<Record<string, number>>(() => {
		const initial: Record<string, number> = {};
		DEFAULT_COSTS.forEach((c) => {
			initial[c.id] = c.defaultPercent;
		});
		return initial;
	});

	const [deliveryRateCustom, setDeliveryRateCustom] = useState<number>(DELIVERY_RATE);

	// Conversão segura do input em número monetário
	const saleValue = useMemo(() => {
		if (!saleValueInput) return 0;
		const cleaned = saleValueInput
			.replace(/\./g, "")
			.replace(",", ".")
			.trim();
		const val = parseFloat(cleaned);
		return isNaN(val) || val < 0 ? 0 : val;
	}, [saleValueInput]);

	// Total de custos calculados
	const costsBreakdown = useMemo(() => {
		const items = DEFAULT_COSTS.map((cost) => {
			const percent = customPercentages[cost.id] ?? cost.defaultPercent;
			const amount = (saleValue * percent) / 100;
			return {
				...cost,
				percent,
				amount,
			};
		});

		if (isDelivery) {
			items.push({
				id: "taxaDelivery",
				name: "Taxa Delivery",
				category: "Venda & Transação",
				defaultPercent: DELIVERY_RATE,
				percent: deliveryRateCustom,
				amount: (saleValue * deliveryRateCustom) / 100,
				icon: Truck,
				description: "Comissão da plataforma de entrega (iFood, etc.)",
			});
		}

		const totalPercent = items.reduce((acc, curr) => acc + curr.percent, 0);
		const totalCostAmount = items.reduce((acc, curr) => acc + curr.amount, 0);
		const profitAmount = saleValue - totalCostAmount;
		const profitMargin = saleValue > 0 ? (profitAmount / saleValue) * 100 : 0;

		return {
			items,
			totalPercent,
			totalCostAmount,
			profitAmount,
			profitMargin,
		};
	}, [saleValue, customPercentages, isDelivery, deliveryRateCustom]);

	const formatCurrency = (val: number) => {
		return val.toLocaleString("pt-BR", {
			style: "currency",
			currency: "BRL",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	};

	const handleResetPercentages = () => {
		const reset: Record<string, number> = {};
		DEFAULT_COSTS.forEach((c) => {
			reset[c.id] = c.defaultPercent;
		});
		setCustomPercentages(reset);
		setDeliveryRateCustom(DELIVERY_RATE);
	};

	const quickValues = [25, 50, 100, 200, 500];

	return (
		<div className="space-y-6 max-w-5xl mx-auto">
			{/* Top Header Card */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
				<div className="flex items-center gap-4">
					<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
						<Calculator size={30} />
					</div>
					<div>
						<h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
							Calculadora de Lucro por Venda
						</h2>
						<p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5">
							Simule o lucro líquido efetivo considerando todos os custos operacionais, tributários e taxas.
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 self-stretch md:self-auto">
					<button
						type="button"
						onClick={() => setShowAdjustments(!showAdjustments)}
						className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border flex-1 md:flex-none ${
							showAdjustments
								? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 shadow-xs"
								: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60"
						}`}>
						<Sliders size={16} />
						<span>{showAdjustments ? "Ocultar Alíquotas" : "Ajustar Alíquotas (%)"}</span>
					</button>

					{showAdjustments && (
						<button
							type="button"
							onClick={handleResetPercentages}
							title="Restaurar alíquotas padrão"
							className="cursor-pointer p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700">
							<RotateCcw size={16} />
						</button>
					)}
				</div>
			</div>

			{/* Main Input & Key Metrics Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
				{/* Input Card */}
				<div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-6">
					<div className="space-y-4">
						<label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
							Valor Bruto da Venda
						</label>

						<div className="relative">
							<span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">
								R$
							</span>
							<input
								type="text"
								value={saleValueInput}
								onChange={(e) => setSaleValueInput(e.target.value)}
								placeholder="0,00"
								className="w-full pl-13 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 transition-all shadow-inner"
							/>
						</div>

						{/* Quick values buttons */}
						<div className="flex flex-wrap items-center gap-1.5 pt-1">
							<span className="text-[11px] font-bold text-slate-400 mr-1">Rápido:</span>
							{quickValues.map((qv) => (
								<button
									key={qv}
									type="button"
									onClick={() => setSaleValueInput(qv.toFixed(2).replace(".", ","))}
									className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-black text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700/60">
									R$ {qv}
								</button>
							))}
						</div>

						{/* Checkbox: Venda Delivery */}
						<div className="pt-4 border-t border-slate-100 dark:border-slate-800">
							<button
								type="button"
								onClick={() => setIsDelivery(!isDelivery)}
								className={`cursor-pointer w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left ${
									isDelivery
										? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 text-amber-950 dark:text-amber-200 shadow-sm"
										: "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
								}`}>
								<div className="flex items-center gap-3">
									<div
										className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
											isDelivery
												? "bg-amber-500 text-white"
												: "bg-white dark:bg-slate-700 text-slate-400"
										}`}>
										<Truck size={20} />
									</div>
									<div>
										<p className="text-sm font-black uppercase tracking-tight">
											Venda via Delivery
										</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
											Aplica taxa de {deliveryRateCustom.toFixed(1)}% (ex: iFood)
										</p>
									</div>
								</div>

								<div
									className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
										isDelivery
											? "bg-amber-500 border-amber-500 text-white"
											: "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
									}`}>
									{isDelivery && <span className="text-xs font-black">✓</span>}
								</div>
							</button>
						</div>
					</div>

					<div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-slate-600 dark:text-slate-400 font-medium flex items-start gap-2.5">
						<Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
						<span>
							O lucro efetivo reflete o valor líquido restante no caixa após deduzir todos os custos
							percentuais pré-determinados sobre a receita bruta.
						</span>
					</div>
				</div>

				{/* Big Results Cards */}
				<div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
					{/* Lucro Efetivo (Resultado Principal) */}
					<div
						className={`sm:col-span-2 rounded-3xl p-6 md:p-8 border-2 transition-all flex flex-col justify-between gap-4 shadow-sm ${
							costsBreakdown.profitAmount >= 0
								? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500 dark:border-emerald-500/80"
								: "bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-500 dark:border-red-500/80"
						}`}>
						<div className="flex items-center justify-between">
							<span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
								Lucro Efetivo da Venda
							</span>
							<span
								className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
									costsBreakdown.profitAmount >= 0
										? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
										: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
								}`}>
								{costsBreakdown.profitAmount >= 0 ? (
									<TrendingUp size={14} />
								) : (
									<TrendingDown size={14} />
								)}
								Margem: {costsBreakdown.profitMargin.toFixed(1)}%
							</span>
						</div>

						<div>
							<div
								className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight ${
									costsBreakdown.profitAmount >= 0
										? "text-emerald-600 dark:text-emerald-400"
										: "text-red-600 dark:text-red-400"
								}`}>
								{formatCurrency(costsBreakdown.profitAmount)}
							</div>
							<p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2">
								{costsBreakdown.profitAmount >= 0
									? "Sobram em caixa para reinvestimento, reserva e sócios."
									: "Atenção: Os custos percentuais superaram o valor total da venda."}
							</p>
						</div>

						{/* Barra visual de proporção Custo x Lucro */}
						<div className="space-y-1.5 pt-2">
							<div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
								<span className="text-slate-500 dark:text-slate-400">
									Custos: {costsBreakdown.totalPercent.toFixed(1)}%
								</span>
								<span
									className={
										costsBreakdown.profitMargin >= 0
											? "text-emerald-600 dark:text-emerald-400"
											: "text-red-600 dark:text-red-400"
									}>
									Lucro: {costsBreakdown.profitMargin.toFixed(1)}%
								</span>
							</div>
							<div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
								<div
									style={{
										width: `${Math.min(100, Math.max(0, costsBreakdown.totalPercent))}%`,
									}}
									className="bg-blue-600 transition-all duration-300"
									title={`Custos: ${costsBreakdown.totalPercent.toFixed(1)}%`}
								/>
								<div
									style={{
										width: `${Math.min(100, Math.max(0, costsBreakdown.profitMargin))}%`,
									}}
									className="bg-emerald-500 transition-all duration-300"
									title={`Lucro: ${costsBreakdown.profitMargin.toFixed(1)}%`}
								/>
							</div>
						</div>
					</div>

					{/* Total de Custos */}
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
						<span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
							Total de Custos & Encargos
						</span>
						<div className="my-2">
							<div className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100">
								{formatCurrency(costsBreakdown.totalCostAmount)}
							</div>
							<span className="text-xs font-black text-blue-600 dark:text-blue-400">
								{costsBreakdown.totalPercent.toFixed(1)}% da venda bruta
							</span>
						</div>
						<span className="text-[11px] text-slate-400 font-bold">
							Soma de insumos, aluguel, equipe, impostos e taxas.
						</span>
					</div>

					{/* Valor Venda Bruta */}
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
						<span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
							Venda Bruta Informada
						</span>
						<div className="my-2">
							<div className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100">
								{formatCurrency(saleValue)}
							</div>
							<span className="text-xs font-black text-slate-500 dark:text-slate-400">
								100% da receita
							</span>
						</div>
						<span className="text-[11px] text-slate-400 font-bold">
							Modalidade: {isDelivery ? "Delivery (com taxa)" : "Balcão / Loja Física"}
						</span>
					</div>
				</div>
			</div>

			{/* Ajuste de Alíquotas Personalizadas (colapsável) */}
			{showAdjustments && (
				<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-blue-200 dark:border-blue-900 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
						<div>
							<h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
								<Sliders size={18} className="text-blue-600" />
								Personalizar Alíquotas de Custos (%)
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
								Edite as porcentagens para simular diferentes cenários de custos.
							</p>
						</div>
						<button
							type="button"
							onClick={handleResetPercentages}
							className="cursor-pointer text-xs font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
							<RotateCcw size={14} /> Restaurar padrões
						</button>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
						{DEFAULT_COSTS.map((cost) => (
							<div
								key={cost.id}
								className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
								<div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200">
									<span className="truncate">{cost.name}</span>
									<span className="text-slate-400 font-bold text-[10px]">
										Padrão: {cost.defaultPercent}%
									</span>
								</div>
								<div className="relative">
									<input
										type="number"
										step="0.1"
										min="0"
										max="100"
										value={customPercentages[cost.id] ?? cost.defaultPercent}
										onChange={(e) => {
											const val = parseFloat(e.target.value);
											setCustomPercentages((prev) => ({
												...prev,
												[cost.id]: isNaN(val) ? 0 : val,
											}));
										}}
										className="w-full pl-3 pr-7 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">
										%
									</span>
								</div>
							</div>
						))}

						{/* Alíquota de Delivery */}
						<div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
							<div className="flex items-center justify-between text-xs font-black text-amber-900 dark:text-amber-200">
								<span className="truncate">Taxa Delivery</span>
								<span className="text-amber-600/70 dark:text-amber-400/70 font-bold text-[10px]">
									Padrão: {DELIVERY_RATE}%
								</span>
							</div>
							<div className="relative">
								<input
									type="number"
									step="0.1"
									min="0"
									max="100"
									value={deliveryRateCustom}
									onChange={(e) => {
										const val = parseFloat(e.target.value);
										setDeliveryRateCustom(isNaN(val) ? 0 : val);
									}}
									className="w-full pl-3 pr-7 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
								/>
								<span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400 font-black text-xs">
									%
								</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Detailed Costs Breakdown Table */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
				<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
					<div>
						<h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
							<Receipt size={20} className="text-blue-600" />
							Detalhamento dos Custos da Venda
						</h3>
						<p className="text-xs text-slate-400 font-bold">
							Discriminação detalhada de cada custo calculado com base no valor de {formatCurrency(saleValue)}.
						</p>
					</div>
					<span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
						{costsBreakdown.items.length} itens
					</span>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
								<th className="pb-3 pl-2">Custo / Encargo</th>
								<th className="pb-3 hidden sm:table-cell">Categoria</th>
								<th className="pb-3 text-right">Alíquota</th>
								<th className="pb-3 text-right pr-2">Impacto no Valor</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs md:text-sm">
							{costsBreakdown.items.map((item) => {
								const Icon = item.icon;
								return (
									<tr
										key={item.id}
										className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
										<td className="py-3.5 pl-2 font-bold text-slate-800 dark:text-slate-200">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
													<Icon size={16} />
												</div>
												<div>
													<p className="font-black text-slate-800 dark:text-slate-100">
														{item.name}
													</p>
													{item.description && (
														<p className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:block">
															{item.description}
														</p>
													)}
												</div>
											</div>
										</td>
										<td className="py-3.5 hidden sm:table-cell text-xs font-bold text-slate-400 dark:text-slate-500">
											<span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-[11px]">
												{item.category}
											</span>
										</td>
										<td className="py-3.5 text-right font-black text-slate-600 dark:text-slate-300">
											{item.percent.toFixed(1)}%
										</td>
										<td className="py-3.5 text-right pr-2 font-black text-red-600 dark:text-red-400">
											- {formatCurrency(item.amount)}
										</td>
									</tr>
								);
							})}

							{/* Linha Total de Custos */}
							<tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 font-black">
								<td className="py-3.5 pl-2 text-slate-800 dark:text-slate-100 uppercase">
									Total de Custos
								</td>
								<td className="py-3.5 hidden sm:table-cell text-xs text-slate-400">-</td>
								<td className="py-3.5 text-right text-blue-600 dark:text-blue-400">
									{costsBreakdown.totalPercent.toFixed(1)}%
								</td>
								<td className="py-3.5 text-right pr-2 text-red-600 dark:text-red-400">
									- {formatCurrency(costsBreakdown.totalCostAmount)}
								</td>
							</tr>

							{/* Linha Final: Lucro Líquido Efetivo */}
							<tr
								className={`border-t border-slate-200 dark:border-slate-700 font-black ${
									costsBreakdown.profitAmount >= 0
										? "bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200"
										: "bg-red-50/60 dark:bg-red-950/30 text-red-950 dark:text-red-200"
								}`}>
								<td className="py-4 pl-2 text-base uppercase flex items-center gap-2">
									<span>Lucro Efetivo da Venda</span>
								</td>
								<td className="py-4 hidden sm:table-cell text-xs text-slate-400">-</td>
								<td
									className={`py-4 text-right text-base ${
										costsBreakdown.profitAmount >= 0
											? "text-emerald-600 dark:text-emerald-400"
											: "text-red-600 dark:text-red-400"
									}`}>
									{costsBreakdown.profitMargin.toFixed(1)}%
								</td>
								<td
									className={`py-4 text-right pr-2 text-base md:text-lg ${
										costsBreakdown.profitAmount >= 0
											? "text-emerald-600 dark:text-emerald-400"
											: "text-red-600 dark:text-red-400"
									}`}>
									{formatCurrency(costsBreakdown.profitAmount)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
