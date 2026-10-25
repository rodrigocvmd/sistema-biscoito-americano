"use client";

import { useState, useMemo } from "react";
import {
	BarChart3,
	TrendingUp,
	PieChart,
	Sliders,
	Eye,
	Check,
} from "lucide-react";
import {
	ChartTipoVisualizacao,
	ChartModoAgrupamento,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
} from "@/types/financeiro-controle";

interface DataPointTemporal {
	label: string; // Ex: "15/10" ou "Seg"
	fullDate: string; // "2026-10-15"
	faturamento: number;
	custos: number;
	lucro: number;
}

interface DataPointCategoria {
	categoria: CategoriaCusto;
	label: string;
	valor: number;
	percent: number;
	color: string;
}

interface DataPointLoja {
	lojaId: string;
	nome: string;
	faturamento: number;
	custos: number;
	lucro: number;
}

interface ControleChartProps {
	temporalData: DataPointTemporal[];
	categoriaData: DataPointCategoria[];
	lojaData: DataPointLoja[];
	totalFaturamento: number;
	totalCustos: number;
	totalLucro: number;
}

const formatCurrency = (val: number) => {
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
		maximumFractionDigits: 2,
	}).format(val || 0);
};

const formatCompactCurrency = (val: number) => {
	if (Math.abs(val) >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
	if (Math.abs(val) >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`;
	return `R$ ${Math.round(val)}`;
};

export default function ControleChart({
	temporalData,
	categoriaData,
	lojaData,
	totalFaturamento,
	totalCustos,
	totalLucro,
}: ControleChartProps) {
	// Configurações do gráfico controladas pelo usuário
	const [tipoVisualizacao, setTipoVisualizacao] = useState<ChartTipoVisualizacao>("barras");
	const [modoAgrupamento, setModoAgrupamento] = useState<ChartModoAgrupamento>("temporal");
	const [showFaturamento, setShowFaturamento] = useState(true);
	const [showCustos, setShowCustos] = useState(true);
	const [showLucro, setShowLucro] = useState(false);

	// Estado de hover/interação
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	// Dimensões do SVG
	const SVG_WIDTH = 780;
	const SVG_HEIGHT = 300;
	const MARGIN = { top: 25, right: 30, bottom: 45, left: 65 };
	const innerW = SVG_WIDTH - MARGIN.left - MARGIN.right;
	const innerH = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

	// Se mudar para modo categorias e o tipo for linha, ajusta para rosca ou barras
	const effectiveTipo = useMemo(() => {
		if (modoAgrupamento === "categorias" && tipoVisualizacao === "linha") {
			return "rosca";
		}
		return tipoVisualizacao;
	}, [modoAgrupamento, tipoVisualizacao]);

	// Dados e escala conforme o modo
	const { maxVal, points } = useMemo(() => {
		let max = 100;
		if (modoAgrupamento === "temporal") {
			temporalData.forEach((d) => {
				if (showFaturamento && d.faturamento > max) max = d.faturamento;
				if (showCustos && d.custos > max) max = d.custos;
				if (showLucro && d.lucro > max) max = d.lucro;
			});
			return { maxVal: max * 1.15, points: temporalData };
		} else if (modoAgrupamento === "lojas") {
			lojaData.forEach((d) => {
				if (showFaturamento && d.faturamento > max) max = d.faturamento;
				if (showCustos && d.custos > max) max = d.custos;
				if (showLucro && d.lucro > max) max = d.lucro;
			});
			return { maxVal: max * 1.15, points: lojaData };
		} else {
			categoriaData.forEach((d) => {
				if (d.valor > max) max = d.valor;
			});
			return { maxVal: max * 1.15, points: categoriaData };
		}
	}, [modoAgrupamento, temporalData, lojaData, categoriaData, showFaturamento, showCustos, showLucro]);

	// Linhas da grade Y
	const yTicks = useMemo(() => {
		const count = 4;
		const step = maxVal / count;
		return Array.from({ length: count + 1 }, (_, i) => {
			const val = i * step;
			const y = MARGIN.top + innerH - (val / maxVal) * innerH;
			return { val, y };
		});
	}, [maxVal, innerH, MARGIN.top]);

	return (
		<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 transition-colors">
			{/* Cabeçalho de Controle e Configuração do Gráfico */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
							<BarChart3 size={18} />
						</span>
						<h3 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
							Análise Visual & Gráficos
						</h3>
					</div>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
						Personalize a visualização temporal, composição de despesas e comparativos por loja
					</p>
				</div>

				{/* Botões de Configuração */}
				<div className="flex flex-wrap items-center gap-2.5">
					{/* Agrupamento / Dimensão */}
					<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-bold">
						<button
							type="button"
							onClick={() => setModoAgrupamento("temporal")}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								modoAgrupamento === "temporal"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							Evolução Diária
						</button>
						<button
							type="button"
							onClick={() => setModoAgrupamento("categorias")}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								modoAgrupamento === "categorias"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							Por Categoria
						</button>
						<button
							type="button"
							onClick={() => setModoAgrupamento("lojas")}
							className={`px-3 py-1.5 rounded-lg transition-all ${
								modoAgrupamento === "lojas"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-black"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							Por Loja
						</button>
					</div>

					{/* Tipo de Gráfico */}
					<div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
						<button
							type="button"
							title="Gráfico de Barras"
							onClick={() => setTipoVisualizacao("barras")}
							className={`p-1.5 rounded-lg transition-all ${
								effectiveTipo === "barras"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
									: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
							}`}>
							<BarChart3 size={16} />
						</button>
						{modoAgrupamento !== "categorias" && (
							<button
								type="button"
								title="Gráfico de Linha"
								onClick={() => setTipoVisualizacao("linha")}
								className={`p-1.5 rounded-lg transition-all ${
									effectiveTipo === "linha"
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
										: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
								}`}>
								<TrendingUp size={16} />
							</button>
						)}
						<button
							type="button"
							title="Gráfico de Rosca / Distribuição"
							onClick={() => setTipoVisualizacao("rosca")}
							className={`p-1.5 rounded-lg transition-all ${
								effectiveTipo === "rosca"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
									: "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
							}`}>
							<PieChart size={16} />
						</button>
					</div>

					{/* Toggles de Séries (Apenas quando não for modo categorias puro) */}
					{modoAgrupamento !== "categorias" && (
						<div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
							<button
								type="button"
								onClick={() => setShowFaturamento(!showFaturamento)}
								className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
									showFaturamento
										? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-black"
										: "opacity-40 hover:opacity-80"
								}`}>
								<span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
								Faturamento
							</button>
							<button
								type="button"
								onClick={() => setShowCustos(!showCustos)}
								className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
									showCustos
										? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-black"
										: "opacity-40 hover:opacity-80"
								}`}>
								<span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
								Custos
							</button>
							<button
								type="button"
								onClick={() => setShowLucro(!showLucro)}
								className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
									showLucro
										? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-black"
										: "opacity-40 hover:opacity-80"
								}`}>
								<span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
								Lucro
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Área de Renderização dos Gráficos */}
			<div className="relative w-full overflow-x-auto select-none pt-2">
				{/* 1. MODO ROSCA / DISTRIBUIÇÃO */}
				{effectiveTipo === "rosca" ? (
					<div className="flex flex-col lg:flex-row items-center justify-around gap-8 py-4">
						{/* Donut Chart SVG */}
						<div className="relative w-64 h-64 shrink-0 flex items-center justify-center">
							<svg width={256} height={256} viewBox="0 0 256 256" className="transform -rotate-90">
								{categoriaData.length === 0 ? (
									<circle
										cx={128}
										cy={128}
										r={85}
										fill="none"
										stroke="currentColor"
										strokeWidth={32}
										className="text-slate-100 dark:text-slate-800"
									/>
								) : (
									(() => {
										let currentAngle = 0;
										const radius = 85;
										const strokeW = 34;
										const circumference = 2 * Math.PI * radius;

										return categoriaData.map((cat, idx) => {
											const strokeDasharray = `${(cat.percent / 100) * circumference} ${circumference}`;
											const strokeDashoffset = -((currentAngle / 360) * circumference);
											currentAngle += (cat.percent / 100) * 360;

											const isHovered = hoveredIndex === idx;

											return (
												<circle
													key={cat.categoria}
													cx={128}
													cy={128}
													r={radius}
													fill="none"
													stroke={cat.color}
													strokeWidth={isHovered ? strokeW + 6 : strokeW}
													strokeDasharray={strokeDasharray}
													strokeDashoffset={strokeDashoffset}
													onMouseEnter={() => setHoveredIndex(idx)}
													onMouseLeave={() => setHoveredIndex(null)}
													className="transition-all duration-300 cursor-pointer"
													strokeLinecap="round"
												/>
											);
										});
									})()
								)}
							</svg>

							{/* Centro do Donut com Totais */}
							<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
								<span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
									{hoveredIndex !== null && categoriaData[hoveredIndex]
										? categoriaData[hoveredIndex].label
										: "Custos Totais"}
								</span>
								<span className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
									{hoveredIndex !== null && categoriaData[hoveredIndex]
										? formatCurrency(categoriaData[hoveredIndex].valor)
										: formatCurrency(totalCustos)}
								</span>
								<span className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
									{hoveredIndex !== null && categoriaData[hoveredIndex]
										? `${categoriaData[hoveredIndex].percent.toFixed(1)}% do total`
										: `${categoriaData.length} categorias`}
								</span>
							</div>
						</div>

						{/* Legenda Detalhada em Grid */}
						<div className="flex-1 w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
							{categoriaData.length === 0 ? (
								<p className="text-sm text-slate-400 col-span-2 text-center py-6">
									Nenhum custo cadastrado para o período selecionado.
								</p>
							) : (
								categoriaData.map((cat, idx) => {
									const isHovered = hoveredIndex === idx;
									return (
										<div
											key={cat.categoria}
											onMouseEnter={() => setHoveredIndex(idx)}
											onMouseLeave={() => setHoveredIndex(null)}
											className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
												isHovered
													? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-xs"
													: "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800"
											}`}>
											<div className="flex items-center gap-2.5 min-w-0">
												<span
													className="w-3.5 h-3.5 rounded-md shrink-0"
													style={{ backgroundColor: cat.color }}
												/>
												<div className="truncate">
													<p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
														{cat.label}
													</p>
													<p className="text-[10px] text-slate-400 dark:text-slate-500">
														{cat.percent.toFixed(1)}% dos custos
													</p>
												</div>
											</div>
											<span className="text-xs font-black text-slate-900 dark:text-slate-100 shrink-0 ml-2">
												{formatCurrency(cat.valor)}
											</span>
										</div>
									);
								})
							)}
						</div>
					</div>
				) : (
					/* 2. MODO BARRAS OU LINHA (SVG DINÂMICO) */
					<div className="min-w-[650px]">
						<svg
							viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
							className="w-full h-auto overflow-visible"
							onMouseLeave={() => setHoveredIndex(null)}>
							<defs>
								{/* Gradiente Faturamento */}
								<linearGradient id="gradFatArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
									<stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
								</linearGradient>
								{/* Gradiente Custos */}
								<linearGradient id="gradCustosArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
									<stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
								</linearGradient>
								{/* Gradiente Lucro */}
								<linearGradient id="gradLucroArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
									<stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
								</linearGradient>
							</defs>

							{/* Linhas de Grade Horizontais */}
							{yTicks.map((tick, i) => (
								<g key={i}>
									<line
										x1={MARGIN.left}
										y1={tick.y}
										x2={MARGIN.left + innerW}
										y2={tick.y}
										stroke="currentColor"
										strokeDasharray="3 3"
										className="text-slate-200 dark:text-slate-800"
									/>
									<text
										x={MARGIN.left - 8}
										y={tick.y + 4}
										textAnchor="end"
										className="text-[10px] font-semibold fill-slate-400 dark:fill-slate-500">
										{formatCompactCurrency(tick.val)}
									</text>
								</g>
							))}

							{/* Eixo Base X */}
							<line
								x1={MARGIN.left}
								y1={MARGIN.top + innerH}
								x2={MARGIN.left + innerW}
								y2={MARGIN.top + innerH}
								stroke="currentColor"
								className="text-slate-300 dark:text-slate-700"
							/>

							{/* RENDERIZAÇÃO: BARRAS */}
							{effectiveTipo === "barras" && (
								<>
									{modoAgrupamento === "categorias" ? (
										/* Barras de Categorias */
										categoriaData.map((cat, idx) => {
											const slotW = innerW / Math.max(categoriaData.length, 1);
											const barW = Math.min(32, slotW * 0.65);
											const h = (cat.valor / maxVal) * innerH;
											const x = MARGIN.left + idx * slotW + (slotW - barW) / 2;
											const y = MARGIN.top + innerH - h;
											const isHovered = hoveredIndex === idx;

											return (
												<g
													key={cat.categoria}
													onMouseEnter={() => setHoveredIndex(idx)}
													onMouseLeave={() => setHoveredIndex(null)}
													className="cursor-pointer">
													<rect
														x={x}
														y={y}
														width={barW}
														height={Math.max(h, 2)}
														rx={4}
														fill={cat.color}
														opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
														className="transition-all duration-200"
													/>
													<text
														x={x + barW / 2}
														y={MARGIN.top + innerH + 18}
														textAnchor="middle"
														className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400">
														{cat.label.slice(0, 7)}
													</text>
												</g>
											);
										})
									) : (
										/* Barras Temporais ou por Loja */
										points.map((pt: any, idx) => {
											const slotW = innerW / Math.max(points.length, 1);
											const activeSeriesCount = (showFaturamento ? 1 : 0) + (showCustos ? 1 : 0) + (showLucro ? 1 : 0);
											const barW = Math.min(22, (slotW * 0.75) / Math.max(activeSeriesCount, 1));
											const totalBarsW = barW * activeSeriesCount + (activeSeriesCount - 1) * 2;
											const startX = MARGIN.left + idx * slotW + (slotW - totalBarsW) / 2;
											const isHovered = hoveredIndex === idx;

											let currentX = startX;

											const fatH = ((pt.faturamento || 0) / maxVal) * innerH;
											const custH = ((pt.custos || 0) / maxVal) * innerH;
											const lucH = (Math.max(pt.lucro || 0, 0) / maxVal) * innerH;

											const labelText = modoAgrupamento === "lojas" ? pt.nome : pt.label;

											return (
												<g
													key={idx}
													onMouseEnter={() => setHoveredIndex(idx)}
													onMouseLeave={() => setHoveredIndex(null)}
													className="cursor-pointer">
													{/* Highlight de fundo da coluna */}
													{isHovered && (
														<rect
															x={MARGIN.left + idx * slotW}
															y={MARGIN.top}
															width={slotW}
															height={innerH}
															fill="currentColor"
															className="text-slate-100/60 dark:text-slate-800/40"
															rx={6}
														/>
													)}

													{/* Barra Faturamento */}
													{showFaturamento && (
														<rect
															x={currentX}
															y={MARGIN.top + innerH - fatH}
															width={barW}
															height={Math.max(fatH, 2)}
															rx={3}
															fill="#10b981"
															opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
															className="transition-all duration-200"
														/>
													)}

													{/* Barra Custos */}
													{showCustos && (
														<rect
															x={currentX + (showFaturamento ? barW + 2 : 0)}
															y={MARGIN.top + innerH - custH}
															width={barW}
															height={Math.max(custH, 2)}
															rx={3}
															fill="#f43f5e"
															opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
															className="transition-all duration-200"
														/>
													)}

													{/* Barra Lucro */}
													{showLucro && (
														<rect
															x={currentX + (showFaturamento ? barW + 2 : 0) + (showCustos ? barW + 2 : 0)}
															y={MARGIN.top + innerH - lucH}
															width={barW}
															height={Math.max(lucH, 2)}
															rx={3}
															fill="#3b82f6"
															opacity={hoveredIndex === null || isHovered ? 1 : 0.45}
															className="transition-all duration-200"
														/>
													)}

													{/* Label X */}
													<text
														x={MARGIN.left + idx * slotW + slotW / 2}
														y={MARGIN.top + innerH + 18}
														textAnchor="middle"
														className={`text-[10px] ${
															isHovered ? "font-black fill-blue-600 dark:fill-blue-400" : "font-semibold fill-slate-500 dark:fill-slate-400"
														}`}>
														{labelText}
													</text>
												</g>
											);
										})
									)}
								</>
							)}

							{/* RENDERIZAÇÃO: LINHA / ÁREA SUAVE */}
							{effectiveTipo === "linha" && points.length > 1 && (
								<>
									{(() => {
										const slotW = innerW / (points.length - 1);

										const getCoords = (key: string) => {
											return points.map((p: any, i) => {
												const x = MARGIN.left + i * slotW;
												const val = Math.max(p[key] || 0, 0);
												const y = MARGIN.top + innerH - (val / maxVal) * innerH;
												return { x, y, val };
											});
										};

										const makeLinePath = (coords: { x: number; y: number }[]) => {
											return coords.reduce((acc, curr, i, arr) => {
												if (i === 0) return `M ${curr.x} ${curr.y}`;
												const prev = arr[i - 1];
												const cx = (prev.x + curr.x) / 2;
												return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
											}, "");
										};

										const fatCoords = getCoords("faturamento");
										const custCoords = getCoords("custos");
										const lucCoords = getCoords("lucro");

										const fatPath = makeLinePath(fatCoords);
										const custPath = makeLinePath(custCoords);
										const lucPath = makeLinePath(lucCoords);

										const fatArea = `${fatPath} L ${MARGIN.left + innerW} ${MARGIN.top + innerH} L ${MARGIN.left} ${MARGIN.top + innerH} Z`;
										const custArea = `${custPath} L ${MARGIN.left + innerW} ${MARGIN.top + innerH} L ${MARGIN.left} ${MARGIN.top + innerH} Z`;

										return (
											<g>
												{/* Áreas preenchidas */}
												{showFaturamento && <path d={fatArea} fill="url(#gradFatArea)" />}
												{showCustos && <path d={custArea} fill="url(#gradCustosArea)" />}

												{/* Linhas */}
												{showFaturamento && (
													<path d={fatPath} fill="none" stroke="#10b981" strokeWidth={2.8} strokeLinecap="round" />
												)}
												{showCustos && (
													<path d={custPath} fill="none" stroke="#f43f5e" strokeWidth={2.8} strokeLinecap="round" />
												)}
												{showLucro && (
													<path d={lucPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="4 4" />
												)}

												{/* Pontos Interativos */}
												{points.map((pt: any, idx) => {
													const x = MARGIN.left + idx * slotW;
													const isHovered = hoveredIndex === idx;

													return (
														<g
															key={idx}
															onMouseEnter={() => setHoveredIndex(idx)}
															onMouseLeave={() => setHoveredIndex(null)}
															className="cursor-pointer">
															{/* Linha vertical guia no hover */}
															{isHovered && (
																<line
																	x1={x}
																	y1={MARGIN.top}
																	x2={x}
																	y2={MARGIN.top + innerH}
																	stroke="currentColor"
																	strokeDasharray="2 2"
																	className="text-slate-400 dark:text-slate-600"
																/>
															)}

															{/* Bolinhas */}
															{showFaturamento && (
																<circle
																	cx={fatCoords[idx].x}
																	cy={fatCoords[idx].y}
																	r={isHovered ? 5.5 : 3.5}
																	fill="#10b981"
																	stroke="#ffffff"
																	strokeWidth={2}
																	className="transition-all"
																/>
															)}
															{showCustos && (
																<circle
																	cx={custCoords[idx].x}
																	cy={custCoords[idx].y}
																	r={isHovered ? 5.5 : 3.5}
																	fill="#f43f5e"
																	stroke="#ffffff"
																	strokeWidth={2}
																	className="transition-all"
																/>
															)}

															{/* Labels no eixo X (mostra espaçado se muitos) */}
															{(points.length <= 15 || idx % Math.ceil(points.length / 10) === 0) && (
																<text
																	x={x}
																	y={MARGIN.top + innerH + 18}
																	textAnchor="middle"
																	className="text-[10px] font-semibold fill-slate-500 dark:fill-slate-400">
																	{modoAgrupamento === "lojas" ? pt.nome : pt.label}
																</text>
															)}
														</g>
													);
												})}
											</g>
										);
									})()}
								</>
							)}

							{/* Tooltip Dinâmica Flutuante no SVG */}
							{hoveredIndex !== null && points[hoveredIndex] && (
								(() => {
									const pt: any = points[hoveredIndex];
									const slotW = innerW / Math.max(points.length, 1);
									let tooltipX = MARGIN.left + hoveredIndex * slotW + slotW / 2;
									if (tooltipX > SVG_WIDTH - 140) tooltipX = SVG_WIDTH - 140;
									if (tooltipX < 140) tooltipX = 140;
									const tooltipY = MARGIN.top + 10;

									const title =
										modoAgrupamento === "categorias"
											? pt.label
											: modoAgrupamento === "lojas"
											? pt.nome
											: pt.fullDate || pt.label;

									return (
										<g transform={`translate(${tooltipX}, ${tooltipY})`} className="pointer-events-none">
											<rect
												x={-90}
												y={0}
												width={180}
												height={modoAgrupamento === "categorias" ? 54 : 80}
												rx={10}
												fill="#0f172a"
												opacity={0.92}
												stroke="#334155"
												strokeWidth={1}
											/>
											<text x={0} y={16} textAnchor="middle" className="text-[11px] font-black fill-white">
												{title}
											</text>

											{modoAgrupamento === "categorias" ? (
												<>
													<text x={0} y={32} textAnchor="middle" className="text-[11px] font-bold fill-rose-300">
														{formatCurrency(pt.valor)}
													</text>
													<text x={0} y={45} textAnchor="middle" className="text-[9px] fill-slate-300">
														{pt.percent.toFixed(1)}% dos custos
													</text>
												</>
											) : (
												<>
													{showFaturamento && (
														<text x={-75} y={34} className="text-[10px] font-semibold fill-emerald-300">
															Fat: {formatCurrency(pt.faturamento || 0)}
														</text>
													)}
													{showCustos && (
														<text x={-75} y={49} className="text-[10px] font-semibold fill-rose-300">
															Custo: {formatCurrency(pt.custos || 0)}
														</text>
													)}
													<text x={-75} y={64} className="text-[10px] font-black fill-blue-300">
														Líq: {formatCurrency((pt.faturamento || 0) - (pt.custos || 0))}
													</text>
												</>
											)}
										</g>
									);
								})()
							)}
						</svg>
					</div>
				)}
			</div>
		</div>
	);
}
