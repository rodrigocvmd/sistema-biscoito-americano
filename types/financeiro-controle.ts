import { StoreId } from "./index";

export type StoreIdWithGeral = StoreId | "geral";

export const STORE_NAMES_EXTENDED: Record<StoreIdWithGeral, string> = {
	lago: "Lago",
	terraco: "Terraço",
	conjunto: "Conjunto",
	noroeste: "Noroeste",
	geral: "Geral / Matriz",
};

export type CategoriaCusto =
	| "cookies"
	| "insumos"
	| "impostos"
	| "royalties"
	| "fundo_promocional"
	| "aluguel"
	| "energia"
	| "contador"
	| "folha"
	| "outros";

export interface CategoriaCustoMeta {
	id: CategoriaCusto;
	label: string;
	color: string; // Hex for charts
	bgLight: string;
	borderLight: string;
	textLight: string;
	bgDark: string;
	borderDark: string;
	textDark: string;
	description: string;
}

export const CATEGORIAS_CUSTO_CONFIG: Record<CategoriaCusto, CategoriaCustoMeta> = {
	cookies: {
		id: "cookies",
		label: "Cookies",
		color: "#d97706", // Amber 600
		bgLight: "bg-amber-50",
		borderLight: "border-amber-200",
		textLight: "text-amber-800",
		bgDark: "dark:bg-amber-950/40",
		borderDark: "dark:border-amber-800/60",
		textDark: "dark:text-amber-300",
		description: "Custos de produção, lotes e reposição de cookies",
	},
	insumos: {
		id: "insumos",
		label: "Insumos",
		color: "#ea580c", // Orange 600
		bgLight: "bg-orange-50",
		borderLight: "border-orange-200",
		textLight: "text-orange-800",
		bgDark: "dark:bg-orange-950/40",
		borderDark: "dark:border-orange-800/60",
		textDark: "dark:text-orange-300",
		description: "Ingredientes, embalagens, descartáveis e insumos de loja",
	},
	impostos: {
		id: "impostos",
		label: "Impostos",
		color: "#e11d48", // Rose 600
		bgLight: "bg-rose-50",
		borderLight: "border-rose-200",
		textLight: "text-rose-800",
		bgDark: "dark:bg-rose-950/40",
		borderDark: "dark:border-rose-800/60",
		textDark: "dark:text-rose-300",
		description: "Simples Nacional, DAS, ICMS, taxas e tributos",
	},
	royalties: {
		id: "royalties",
		label: "Royalties",
		color: "#9333ea", // Purple 600
		bgLight: "bg-purple-50",
		borderLight: "border-purple-200",
		textLight: "text-purple-800",
		bgDark: "dark:bg-purple-950/40",
		borderDark: "dark:border-purple-800/60",
		textDark: "dark:text-purple-300",
		description: "Royalties da franquia e licenciamento de marca",
	},
	fundo_promocional: {
		id: "fundo_promocional",
		label: "Fundo Promocional",
		color: "#2563eb", // Blue 600
		bgLight: "bg-blue-50",
		borderLight: "border-blue-200",
		textLight: "text-blue-800",
		bgDark: "dark:bg-blue-950/40",
		borderDark: "dark:border-blue-800/60",
		textDark: "dark:text-blue-300",
		description: "Fundo de propaganda, campanhas de marketing e divulgação",
	},
	aluguel: {
		id: "aluguel",
		label: "Aluguel",
		color: "#4f46e5", // Indigo 600
		bgLight: "bg-indigo-50",
		borderLight: "border-indigo-200",
		textLight: "text-indigo-800",
		bgDark: "dark:bg-indigo-950/40",
		borderDark: "dark:border-indigo-800/60",
		textDark: "dark:text-indigo-300",
		description: "Locação de imóveis, quiosques, condomínio e taxas de ocupação",
	},
	energia: {
		id: "energia",
		label: "Energia",
		color: "#ca8a04", // Yellow 600
		bgLight: "bg-yellow-50",
		borderLight: "border-yellow-200",
		textLight: "text-yellow-800",
		bgDark: "dark:bg-yellow-950/40",
		borderDark: "dark:border-yellow-800/60",
		textDark: "dark:text-yellow-300",
		description: "Conta de energia elétrica / luz das unidades e câmaras",
	},
	contador: {
		id: "contador",
		label: "Contador",
		color: "#059669", // Emerald 600
		bgLight: "bg-emerald-50",
		borderLight: "border-emerald-200",
		textLight: "text-emerald-800",
		bgDark: "dark:bg-emerald-950/40",
		borderDark: "dark:border-emerald-800/60",
		textDark: "dark:text-emerald-300",
		description: "Honorários contábeis, assessoria fiscal e societária",
	},
	folha: {
		id: "folha",
		label: "Folha",
		color: "#0891b2", // Cyan 600
		bgLight: "bg-cyan-50",
		borderLight: "border-cyan-200",
		textLight: "text-cyan-800",
		bgDark: "dark:bg-cyan-950/40",
		borderDark: "dark:border-cyan-800/60",
		textDark: "dark:text-cyan-300",
		description: "Salários, adiantamentos, benefícios, VT e encargos trabalhistas",
	},
	outros: {
		id: "outros",
		label: "Outros",
		color: "#64748b", // Slate 500
		bgLight: "bg-slate-50",
		borderLight: "border-slate-200",
		textLight: "text-slate-800",
		bgDark: "dark:bg-slate-900/50",
		borderDark: "dark:border-slate-700/60",
		textDark: "dark:text-slate-300",
		description: "Manutenções, internet, taxas bancárias e despesas diversas",
	},
};

export type MetodoPagamento = "pix" | "boleto" | "cartao" | "dinheiro" | "debito" | "outro";

export interface CustoFinanceiro {
	id: string;
	lojaId: StoreIdWithGeral;
	categoria: CategoriaCusto;
	descricao: string;
	valor: number;
	data: string; // YYYY-MM-DD - Dia do custo (OBRIGATÓRIO)
	mesReferencia: string; // YYYY-MM
	metodoPagamento?: MetodoPagamento;
	status?: "pago" | "pendente";
	observacoes?: string;
	comprovanteUrl?: string;
	createdAt?: any;
	updatedAt?: any;
}

export interface FaturamentoItem {
	id: string;
	nome: string;
	categoria?: string;
	quantidade: number;
	precoUnitario: number;
	subtotal: number;
}

export type CanalVenda = "balcao" | "ifood" | "delivery_proprio" | "encomenda" | "eventos" | "geral";

export const CANAL_VENDA_CONFIG: Record<CanalVenda, { label: string; badge: string }> = {
	balcao: { label: "Balcão / Loja Física", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
	ifood: { label: "iFood / Delivery App", badge: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
	delivery_proprio: { label: "Delivery Próprio", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
	encomenda: { label: "Encomendas Especiais", badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300" },
	eventos: { label: "Eventos / Corporativo", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
	geral: { label: "Geral Consolidado", badge: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
};

export interface FaturamentoFinanceiro {
	id: string;
	lojaId: StoreIdWithGeral;
	data: string; // YYYY-MM-DD
	mesReferencia: string; // YYYY-MM
	tipo: "geral" | "discriminado";
	valorTotal: number;
	canal?: CanalVenda;
	descricao?: string;
	itens?: FaturamentoItem[];
	observacoes?: string;
	createdAt?: any;
	updatedAt?: any;
}

export type PeriodoModo = "mes" | "mes_anterior" | "7dias" | "30dias" | "ano" | "custom" | "todos";

export type ChartTipoVisualizacao = "barras" | "linha" | "rosca";
export type ChartModoAgrupamento = "temporal" | "categorias" | "lojas";
