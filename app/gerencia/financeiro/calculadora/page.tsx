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
	Plus,
	Trash2,
	HandCoins,
	HelpCircle,
	CheckCircle2,
	AlertTriangle,
	Tag,
} from "lucide-react";

interface CostItemConfig {
	id: string;
	name: string;
	category: "Operacional" | "Ocupação" | "Tributário & Franquia" | "Venda & Transação" | "Adicional / Promocional";
	defaultPercent: number;
	icon: any;
	description?: string;
}

interface CustomExtraCost {
	id: string;
	name: string;
	type: "percent" | "fixed";
	value: number; // % sobre a venda OU R$ fixo
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

	// Customização de alíquotas percentuais dos custos fixos base
	const [customPercentages, setCustomPercentages] = useState<Record<string, number>>(() => {
		const initial: Record<string, number> = {};
		DEFAULT_COSTS.forEach((c) => {
			initial[c.id] = c.defaultPercent;
		});
		return initial;
	});

	const [deliveryRateCustom, setDeliveryRateCustom] = useState<number>(DELIVERY_RATE);

	// Custos adicionais criados dinamicamente pelo usuário (ex: desconto comercial, taxa promocional)
	const [extraCosts, setExtraCosts] = useState<CustomExtraCost[]>([]);
	const [newCostName, setNewCostName] = useState("");
	const [newCostType, setNewCostType] = useState<"percent" | "fixed">("fixed");
	const [newCostValue, setNewCostValue] = useState("");

	// Subsídio Externo (ex.: Franquia, Parceiro, Aporte Comercial)
	const [hasSubsidy, setHasSubsidy] = useState<boolean>(false);
	const [subsidyType, setSubsidyType] = useState<"fixed" | "percent">("fixed");
	const [subsidyValueInput, setSubsidyValueInput] = useState<string>("0,00");
	const [subsidyOrigin, setSubsidyOrigin] = useState<string>("Franquia / Parceiro");

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

	// Valor numérico do subsídio externo
	const subsidyValueNum = useMemo(() => {
		if (!hasSubsidy || !subsidyValueInput) return 0;
		const cleaned = subsidyValueInput
			.replace(/\./g, "")
			.replace(",", ".")
			.trim();
		const val = parseFloat(cleaned);
		return isNaN(val) || val < 0 ? 0 : val;
	}, [hasSubsidy, subsidyValueInput]);

	// Subsídio efetivo em R$
	const effectiveSubsidyAmount = useMemo(() => {
		if (!hasSubsidy) return 0;
		if (subsidyType === "fixed") {
			return subsidyValueNum;
		}
		// Se for percentual sobre a venda bruta
		return (saleValue * subsidyValueNum) / 100;
	}, [hasSubsidy, subsidyType, subsidyValueNum, saleValue]);

	// Total de custos e receitas calculados
	const calculation = useMemo(() => {
		// 1. Custos padrão
		const standardItems = DEFAULT_COSTS.map((cost) => {
			const percent = customPercentages[cost.id] ?? cost.defaultPercent;
			const amount = (saleValue * percent) / 100;
			return {
				id: cost.id,
				name: cost.name,
				category: cost.category,
				percent,
				amount,
				icon: cost.icon,
				description: cost.description,
				isRemovable: false,
			};
		});

		// 2. Taxa de Delivery (se ativado)
		if (isDelivery) {
			standardItems.push({
				id: "taxaDelivery",
				name: "Taxa Delivery",
				category: "Venda & Transação",
				percent: deliveryRateCustom,
				amount: (saleValue * deliveryRateCustom) / 100,
				icon: Truck,
				description: "Comissão da plataforma de entrega (ex: iFood)",
				isRemovable: false,
			});
		}

		// 3. Custos adicionais customizados
		const extraItems = extraCosts.map((extra) => {
			let amount = 0;
			let percent = 0;

			if (extra.type === "percent") {
				percent = extra.value;
				amount = (saleValue * extra.value) / 100;
			} else {
				amount = extra.value;
				percent = saleValue > 0 ? (amount / saleValue) * 100 : 0;
			}

			return {
				id: extra.id,
				name: extra.name,
				category: "Adicional / Promocional" as const,
				percent,
				amount,
				icon: Tag,
				description: extra.type === "percent" ? `${extra.value}% sobre a venda` : `Valor fixo de R$ ${extra.value.toFixed(2)}`,
				isRemovable: true,
			};
		});

		const allItems = [...standardItems, ...extraItems];

		const totalCostAmount = allItems.reduce((acc, curr) => acc + curr.amount, 0);
		const totalCostPercent = saleValue > 0 ? (totalCostAmount / saleValue) * 100 : allItems.reduce((acc, curr) => acc + curr.percent, 0);

		// Receita Total Efetiva = Valor da Venda + Subsídio Externo
		const totalRevenue = saleValue + effectiveSubsidyAmount;

		// Lucro Líquido Efetivo = Receita Total - Total de Custos
		const profitAmount = totalRevenue - totalCostAmount;

		// Margem de Lucro Efetiva calculada sobre a venda base (ou receita total se venda for 0)
		const baseForMargin = saleValue > 0 ? saleValue : totalRevenue;
		const profitMargin = baseForMargin > 0 ? (profitAmount / baseForMargin) * 100 : 0;

		// Se pagou?
		// A venda se paga quando a receita total (venda + subsídio) cobre todos os custos (lucro >= 0)
		const paysItself = profitAmount >= 0;
		// Quanta receita ainda falta para se pagar (breakeven deficit)
		const deficit = profitAmount < 0 ? Math.abs(profitAmount) : 0;

		return {
			items: allItems,
			totalCostAmount,
			totalCostPercent,
			totalRevenue,
			effectiveSubsidyAmount,
			profitAmount,
			profitMargin,
			paysItself,
			deficit,
		};
	}, [saleValue, customPercentages, isDelivery, deliveryRateCustom, extraCosts, effectiveSubsidyAmount]);

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
		setExtraCosts([]);
	};

	const handleAddExtraCost = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newCostValue.trim()) return;

		const cleaned = newCostValue.replace(/\./g, "").replace(",", ".").trim();
		const val = parseFloat(cleaned);
		if (isNaN(val) || val <= 0) return;

		const fallbackName = newCostName.trim()
			? newCostName.trim()
			: newCostType === "fixed"
			? `Custo Adicional (Fixo R$ ${val.toFixed(2)})`
			: `Custo Adicional (${val}% da venda)`;

		const newCost: CustomExtraCost = {
			id: `extra-${Date.now()}`,
			name: fallbackName,
			type: newCostType,
			value: val,
		};

		setExtraCosts((prev) => [...prev, newCost]);
		setNewCostName("");
		setNewCostValue("");
	};

	const handleRemoveExtraCost = (id: string) => {
		setExtraCosts((prev) => prev.filter((c) => c.id !== id));
	};

	// Helper para selecionar todo o texto ao clicar/focar no input
	const handleSelectAll = (e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) => {
		(e.target as HTMLInputElement).select();
	};

	const quickValues = [0, 25, 50, 100, 200, 500];

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
							Simule o lucro líquido efetivo, custos operacionais, custos adicionais e análise de subsídio externo.
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
						<span>{showAdjustments ? "Ocultar Alíquotas" : "Ajustar Alíquotas Base (%)"}</span>
					</button>

					{showAdjustments && (
						<button
							type="button"
							onClick={handleResetPercentages}
							title="Restaurar alíquotas padrão e limpar adicionais"
							className="cursor-pointer p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700">
							<RotateCcw size={16} />
						</button>
					)}
				</div>
			</div>

			{/* Main Input & Key Metrics Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
				{/* Coluna da Esquerda: Inputs da Venda, Subsídio e Delivery */}
				<div className="lg:col-span-5 space-y-6">
					{/* Input Card Principal */}
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
									Valor Bruto da Venda
								</label>
								{saleValue === 0 && (
									<span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:purple-300">
										Distribuição / Brinde
									</span>
								)}
							</div>

							<div className="relative">
								<span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">
									R$
								</span>
								<input
									type="text"
									value={saleValueInput}
									onChange={(e) => setSaleValueInput(e.target.value)}
									onFocus={handleSelectAll}
									onClick={handleSelectAll}
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
										{qv === 0 ? "R$ 0 (Grátis)" : `R$ ${qv}`}
									</button>
								))}
							</div>
						</div>

						{/* Checkbox: Venda Delivery */}
						<div className="pt-2 border-t border-slate-100 dark:border-slate-800">
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

						{/* Seção: Subsídio Externo (Franquia / Parceria) */}
						<div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
							<button
								type="button"
								onClick={() => setHasSubsidy(!hasSubsidy)}
								className={`cursor-pointer w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-left ${
									hasSubsidy
										? "bg-purple-50/70 dark:bg-purple-950/30 border-purple-500 text-purple-950 dark:text-purple-200 shadow-sm"
										: "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
								}`}>
								<div className="flex items-center gap-3">
									<div
										className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
											hasSubsidy
												? "bg-purple-600 text-white"
												: "bg-white dark:bg-slate-700 text-slate-400"
										}`}>
										<HandCoins size={20} />
									</div>
									<div>
										<p className="text-sm font-black uppercase tracking-tight">
											Possui Subsídio Externo?
										</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
											Reembolso/Aporte da franqueadora ou parceiro
										</p>
									</div>
								</div>

								<div
									className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
										hasSubsidy
											? "bg-purple-600 border-purple-600 text-white"
											: "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
									}`}>
									{hasSubsidy && <span className="text-xs font-black">✓</span>}
								</div>
							</button>

							{/* Campos do Subsídio quando ativo */}
							{hasSubsidy && (
								<div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 space-y-3 animate-in fade-in duration-200">
									<div className="flex items-center justify-between gap-2">
										<span className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">
											Configuração do Subsídio
										</span>
										{/* Toggle R$ fixo ou % */}
										<div className="flex bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
											<button
												type="button"
												onClick={() => setSubsidyType("fixed")}
												className={`cursor-pointer px-2.5 py-1 rounded-md text-[11px] font-black transition-all ${
													subsidyType === "fixed"
														? "bg-purple-600 text-white shadow-xs"
														: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
												}`}>
												R$ Fixo
											</button>
											<button
												type="button"
												onClick={() => setSubsidyType("percent")}
												className={`cursor-pointer px-2.5 py-1 rounded-md text-[11px] font-black transition-all ${
													subsidyType === "percent"
														? "bg-purple-600 text-white shadow-xs"
														: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
												}`}>
												% Venda
											</button>
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										<div>
											<label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
												Origem / Descrição (opcional)
											</label>
											<input
												type="text"
												value={subsidyOrigin}
												onChange={(e) => setSubsidyOrigin(e.target.value)}
												onFocus={handleSelectAll}
												onClick={handleSelectAll}
												placeholder="Ex: Franquia"
												className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
											/>
										</div>
										<div>
											<label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
												Valor {subsidyType === "fixed" ? "(R$)" : "(%)"}
											</label>
											<div className="relative">
												<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
													{subsidyType === "fixed" ? "R$" : "%"}
												</span>
												<input
													type="text"
													value={subsidyValueInput}
													onChange={(e) => setSubsidyValueInput(e.target.value)}
													onFocus={handleSelectAll}
													onClick={handleSelectAll}
													placeholder={subsidyType === "fixed" ? "0,00" : "0"}
													className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-purple-700 dark:text-purple-300"
												/>
											</div>
										</div>
									</div>

									<div className="text-[11px] font-bold text-purple-900/80 dark:text-purple-300/80 pt-1">
										Aporte recebido:{" "}
										<strong className="text-purple-700 dark:text-purple-200 font-black">
											+ {formatCurrency(calculation.effectiveSubsidyAmount)}
										</strong>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Adicionar Mais Custos (Descontos, Taxas Promocionais, etc) */}
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
								<Plus size={16} className="text-blue-600" />
								Adicionar Outro Custo / Desconto
							</h3>
							<span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
								{extraCosts.length} adicionado(s)
							</span>
						</div>

						<form onSubmit={handleAddExtraCost} className="space-y-3">
							<div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
								<div className="sm:col-span-6">
									<input
										type="text"
										value={newCostName}
										onChange={(e) => setNewCostName(e.target.value)}
										onFocus={handleSelectAll}
										onClick={handleSelectAll}
										placeholder="Nome (opcional)"
										className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
								<div className="sm:col-span-3">
									<select
										value={newCostType}
										onChange={(e) => setNewCostType(e.target.value as any)}
										className="w-full px-2.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300 focus:outline-none">
										<option value="fixed">R$ Fixo</option>
										<option value="percent">% Venda</option>
									</select>
								</div>
								<div className="sm:col-span-3">
									<input
										type="text"
										value={newCostValue}
										onChange={(e) => setNewCostValue(e.target.value)}
										onFocus={handleSelectAll}
										onClick={handleSelectAll}
										placeholder={newCostType === "fixed" ? "Valor R$" : "Alíquota %"}
										className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<button
								type="submit"
								disabled={!newCostValue.trim()}
								className="cursor-pointer w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm">
								<Plus size={14} />
								<span>Incluir Custo na Análise</span>
							</button>
						</form>

						{/* Lista de custos extras incluídos */}
						{extraCosts.length > 0 && (
							<div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
								{extraCosts.map((extra) => {
									const calculatedAmt =
										extra.type === "percent"
											? (saleValue * extra.value) / 100
											: extra.value;

									return (
										<div
											key={extra.id}
											className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
											<div className="min-w-0">
												<p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
													{extra.name}
												</p>
												<p className="text-[10px] font-bold text-slate-400">
													{extra.type === "percent"
														? `${extra.value}% sobre a venda`
														: `R$ ${extra.value.toFixed(2)} fixo`}
												</p>
											</div>

											<div className="flex items-center gap-2 shrink-0">
												<span className="text-xs font-black text-red-600 dark:text-red-400">
													- {formatCurrency(calculatedAmt)}
												</span>
												<button
													type="button"
													onClick={() => handleRemoveExtraCost(extra.id)}
													className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
													title="Remover custo">
													<Trash2 size={14} />
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				{/* Coluna da Direita: Grandes Métricas e Análise de 'Se Pagou' */}
				<div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
					{/* Card de Análise: A Venda Se Pagou? (Principal) */}
					<div
						className={`rounded-3xl p-6 md:p-8 border-2 transition-all flex flex-col justify-between gap-5 shadow-sm ${
							calculation.paysItself
								? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500 dark:border-emerald-500/80"
								: "bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-500 dark:border-red-500/80"
						}`}>
						<div className="flex items-center justify-between gap-2 flex-wrap">
							<div className="flex items-center gap-2">
								{calculation.paysItself ? (
									<span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
										<CheckCircle2 size={18} />
									</span>
								) : (
									<span className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-xs">
										<AlertTriangle size={18} />
									</span>
								)}
								<div>
									<h3 className="text-base md:text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 leading-none">
										{calculation.paysItself
											? "A Operação Se Pagou! (Superávit)"
											: "A Operação Não Se Pagou (Déficit)"}
									</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
										{calculation.paysItself
											? "A receita total (venda + subsídio) cobriu 100% dos custos e despesas."
											: `Faltam ${formatCurrency(calculation.deficit)} para atingir o ponto de equilíbrio.`}
									</p>
								</div>
							</div>

							<span
								className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
									calculation.paysItself
										? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
										: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
								}`}>
								{calculation.paysItself ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
								Margem: {calculation.profitMargin.toFixed(1)}%
							</span>
						</div>

						{/* Valor do Lucro Efetivo */}
						<div className="py-2">
							<span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
								Resultado Líquido Efetivo (Lucro)
							</span>
							<div
								className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight ${
									calculation.paysItself
										? "text-emerald-600 dark:text-emerald-400"
										: "text-red-600 dark:text-red-400"
								}`}>
								{formatCurrency(calculation.profitAmount)}
							</div>
						</div>

						{/* Informações de Subsídio se presente */}
						{hasSubsidy && (
							<div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between text-xs font-black">
								<span className="text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
									<HandCoins size={16} />
									Subsídio Externo ({subsidyOrigin}):
								</span>
								<span className="text-purple-700 dark:text-purple-200 font-black">
									+ {formatCurrency(calculation.effectiveSubsidyAmount)}
								</span>
							</div>
						)}

						{/* Barra visual de proporção Custo x Lucro */}
						<div className="space-y-1.5 pt-1">
							<div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
								<span className="text-slate-500 dark:text-slate-400">
									Custos Totais: {formatCurrency(calculation.totalCostAmount)}
								</span>
								<span
									className={
										calculation.paysItself
											? "text-emerald-600 dark:text-emerald-400"
											: "text-red-600 dark:text-red-400"
									}>
									{calculation.paysItself ? "Sobra Líquida" : "Déficit Líquido"}:{" "}
									{formatCurrency(Math.abs(calculation.profitAmount))}
								</span>
							</div>

							<div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
								<div
									style={{
										width: `${Math.min(
											100,
											calculation.totalRevenue > 0
												? (calculation.totalCostAmount / calculation.totalRevenue) * 100
												: 100,
										)}%`,
									}}
									className="bg-blue-600 transition-all duration-300"
									title={`Custos: ${formatCurrency(calculation.totalCostAmount)}`}
								/>
								<div
									style={{
										width: `${Math.min(
											100,
											calculation.totalRevenue > 0 && calculation.profitAmount > 0
												? (calculation.profitAmount / calculation.totalRevenue) * 100
												: 0,
										)}%`,
									}}
									className="bg-emerald-500 transition-all duration-300"
									title={`Lucro: ${formatCurrency(Math.max(0, calculation.profitAmount))}`}
								/>
							</div>
						</div>
					</div>

					{/* 3 Cards de Resumo */}
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						{/* Venda Bruta */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
							<span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
								Venda do Cliente
							</span>
							<div className="my-1.5">
								<div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">
									{formatCurrency(saleValue)}
								</div>
								<span className="text-[11px] font-bold text-slate-400">
									{isDelivery ? "Delivery (+ Taxa)" : "Balcão / Loja"}
								</span>
							</div>
						</div>

						{/* Subsídio / Aporte */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
							<span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
								Subsídio Externo
							</span>
							<div className="my-1.5">
								<div className="text-xl md:text-2xl font-black text-purple-700 dark:text-purple-300">
									{formatCurrency(calculation.effectiveSubsidyAmount)}
								</div>
								<span className="text-[11px] font-bold text-slate-400">
									{hasSubsidy ? subsidyOrigin : "Nenhum"}
								</span>
							</div>
						</div>

						{/* Custos Totais */}
						<div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
							<span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
								Total Custos & Taxas
							</span>
							<div className="my-1.5">
								<div className="text-xl md:text-2xl font-black text-red-600 dark:text-red-400">
									{formatCurrency(calculation.totalCostAmount)}
								</div>
								<span className="text-[11px] font-bold text-slate-400">
									{calculation.items.length} itens considerados
								</span>
							</div>
						</div>
					</div>

					{/* Dica Didática */}
					<div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 font-medium flex items-start gap-2.5">
						<Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
						<span>
							<strong>Distribuição / Bonificação:</strong> Caso produtos sejam doados ou vendidos a custo
							zero em campanhas subsidiadas pela franquia, insira R$ 0,00 na venda e ative o subsídio com
							o valor do reembolso recebido para avaliar se o subsídio cobriu toda a cadeia de custos.
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
								Personalizar Alíquotas de Custos Base (%)
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
								Edite as porcentagens padrão para simular diferentes cenários de custos operacionais.
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
										onFocus={handleSelectAll}
										onClick={handleSelectAll}
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
									onFocus={handleSelectAll}
									onClick={handleSelectAll}
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
							Detalhamento de Custos e Entradas
						</h3>
						<p className="text-xs text-slate-400 font-bold">
							Discriminação detalhada de cada custo e receitas aplicadas na simulação.
						</p>
					</div>
					<span className="text-xs font-black px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
						{calculation.items.length} itens de custos
					</span>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
								<th className="pb-3 pl-2">Item / Descrição</th>
								<th className="pb-3 hidden sm:table-cell">Categoria</th>
								<th className="pb-3 text-right">Proporção</th>
								<th className="pb-3 text-right pr-2">Impacto no Caixa</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs md:text-sm">
							{/* Linha 1: Venda do Cliente (Receita) */}
							<tr className="bg-slate-50/40 dark:bg-slate-800/20 font-bold">
								<td className="py-3.5 pl-2 text-slate-800 dark:text-slate-100 flex items-center gap-3">
									<div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
										<DollarSign size={16} />
									</div>
									<div>
										<p className="font-black text-slate-800 dark:text-slate-100">
											Valor Bruto da Venda
										</p>
										<p className="text-[11px] text-slate-400">
											{isDelivery ? "Venda via Delivery" : "Venda Balcão / Loja"}
										</p>
									</div>
								</td>
								<td className="py-3.5 hidden sm:table-cell text-xs font-semibold text-slate-500">
									Receita Direta
								</td>
								<td className="py-3.5 text-right font-black text-slate-600 dark:text-slate-300">
									100%
								</td>
								<td className="py-3.5 text-right pr-2 font-black text-emerald-600 dark:text-emerald-400">
									+ {formatCurrency(saleValue)}
								</td>
							</tr>

							{/* Linha 2 (Se ativo): Subsídio Externo */}
							{hasSubsidy && (
								<tr className="bg-purple-50/30 dark:bg-purple-950/20 font-bold">
									<td className="py-3.5 pl-2 text-purple-900 dark:text-purple-200 flex items-center gap-3">
										<div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
											<HandCoins size={16} />
										</div>
										<div>
											<p className="font-black text-purple-900 dark:text-purple-100">
												Subsídio Externo ({subsidyOrigin})
											</p>
											<p className="text-[11px] text-purple-600 dark:text-purple-400">
												Aporte recebido de terceiros/franquia
											</p>
										</div>
									</td>
									<td className="py-3.5 hidden sm:table-cell text-xs font-semibold text-purple-600 dark:text-purple-400">
										Subsídio / Parceria
									</td>
									<td className="py-3.5 text-right font-black text-purple-700 dark:text-purple-300">
										{saleValue > 0
											? `${((calculation.effectiveSubsidyAmount / saleValue) * 100).toFixed(1)}%`
											: "-"}
									</td>
									<td className="py-3.5 text-right pr-2 font-black text-purple-600 dark:text-purple-400">
										+ {formatCurrency(calculation.effectiveSubsidyAmount)}
									</td>
								</tr>
							)}

							{/* Lista de Custos */}
							{calculation.items.map((item) => {
								const Icon = item.icon;
								return (
									<tr
										key={item.id}
										className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
										<td className="py-3.5 pl-2 font-bold text-slate-800 dark:text-slate-200">
											<div className="flex items-center justify-between pr-2">
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

												{item.isRemovable && (
													<button
														type="button"
														onClick={() => handleRemoveExtraCost(item.id)}
														className="text-slate-400 hover:text-red-600 p-1 rounded-md"
														title="Excluir custo">
														<Trash2 size={14} />
													</button>
												)}
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
									Total de Custos & Despesas
								</td>
								<td className="py-3.5 hidden sm:table-cell text-xs text-slate-400">-</td>
								<td className="py-3.5 text-right text-blue-600 dark:text-blue-400">
									{calculation.totalCostPercent.toFixed(1)}%
								</td>
								<td className="py-3.5 text-right pr-2 text-red-600 dark:text-red-400">
									- {formatCurrency(calculation.totalCostAmount)}
								</td>
							</tr>

							{/* Linha Final: Lucro Líquido Efetivo */}
							<tr
								className={`border-t border-slate-200 dark:border-slate-700 font-black ${
									calculation.paysItself
										? "bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200"
										: "bg-red-50/60 dark:bg-red-950/30 text-red-950 dark:text-red-200"
								}`}>
								<td className="py-4 pl-2 text-base uppercase flex items-center gap-2">
									<span>Resultado Efetivo (Lucro / Prejuízo)</span>
								</td>
								<td className="py-4 hidden sm:table-cell text-xs text-slate-400">
									{calculation.paysItself ? "Superávit" : "Déficit"}
								</td>
								<td
									className={`py-4 text-right text-base ${
										calculation.paysItself
											? "text-emerald-600 dark:text-emerald-400"
											: "text-red-600 dark:text-red-400"
									}`}>
									{calculation.profitMargin.toFixed(1)}%
								</td>
								<td
									className={`py-4 text-right pr-2 text-base md:text-lg ${
										calculation.paysItself
											? "text-emerald-600 dark:text-emerald-400"
											: "text-red-600 dark:text-red-400"
									}`}>
									{formatCurrency(calculation.profitAmount)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
