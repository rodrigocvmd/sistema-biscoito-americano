import { StoreId } from "./index";

export type StatusFuncionario = "ativo" | "ferias" | "afastado" | "inativo";

export interface Funcionario {
	id: string;
	nome: string;
	apelido?: string;
	cpf?: string;
	telefone?: string;
	lojaId: StoreId | "todas";
	cargo: string;
	status: StatusFuncionario;
	dataAdmissao?: string;
	salarioBase: number;
	valeTransporte: number;
	chavePix?: string;
	banco?: string;
	observacoes?: string;
	createdAt?: any;
	updatedAt?: any;
}

export type TurnoTipo =
	| "abertura"
	| "intermediario"
	| "fechamento"
	| "integral"
	| "folga"
	| "personalizado";

export type RegimeEscala = "12x36" | "6x1";

export interface DiaHorarioLoja {
	ativo: boolean;
	abertura: string;
	fechamento: string;
}

export type HorarioSemanaLoja = Record<number, DiaHorarioLoja>;

export interface LojaHorarioConfig {
	id?: string;
	lojaId: StoreId;
	horarios: HorarioSemanaLoja;
	updatedAt?: any;
}

export const HORARIO_PADRAO_SEMANA: HorarioSemanaLoja = {
	1: { ativo: true, abertura: "10:00", fechamento: "22:00" }, // Segunda
	2: { ativo: true, abertura: "10:00", fechamento: "22:00" }, // Terça
	3: { ativo: true, abertura: "10:00", fechamento: "22:00" }, // Quarta
	4: { ativo: true, abertura: "10:00", fechamento: "22:00" }, // Quinta
	5: { ativo: true, abertura: "10:00", fechamento: "22:00" }, // Sexta
	6: { ativo: true, abertura: "10:00", fechamento: "22:00" }, // Sábado
	0: { ativo: true, abertura: "12:00", fechamento: "20:00" }, // Domingo
};

export interface EscalaItem {
	id: string;
	funcionarioId: string;
	funcionarioNome: string;
	funcionarioCargo?: string;
	lojaId: StoreId;
	data: string; // YYYY-MM-DD
	turno?: TurnoTipo;
	horarioInicio?: string; // ex: "09:00"
	horarioFim?: string; // ex: "17:00"
	observacoes?: string;
	createdAt?: any;
	updatedAt?: any;
}

export type TipoLancamentoFinanceiro =
	| "salario" // Salário base ou proporcional
	| "vale_transporte" // Vale transporte
	| "retirada" // Adiantamento / vale / retirada antecipada
	| "bonus" // Bonificação / hora extra / comissão
	| "desconto" // Faltas / atrasos / outros descontos
	| "gasto_pontual" // Despesas avulsas / compras / uniformes
	| "pagamento_realizado"; // Pagamento quitado / baixa

export interface LancamentoFinanceiro {
	id: string;
	funcionarioId: string;
	funcionarioNome: string;
	lojaId?: StoreId | "todas";
	tipo: TipoLancamentoFinanceiro;
	descricao: string;
	valor: number;
	data: string; // YYYY-MM-DD
	mesReferencia: string; // YYYY-MM
	status: "pendente" | "pago" | "cancelado";
	metodoPagamento?: "pix" | "dinheiro" | "transferencia" | "outro";
	observacoes?: string;
	comprovanteUrl?: string;
	createdAt?: any;
	updatedAt?: any;
}

export const TURNO_CONFIG: Record<
	TurnoTipo,
	{ label: string; defaultInicio: string; defaultFim: string; color: string; badgeBg: string; badgeText: string }
> = {
	abertura: {
		label: "Abertura",
		defaultInicio: "09:00",
		defaultFim: "17:00",
		color: "#2563eb",
		badgeBg: "bg-blue-100 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800",
		badgeText: "text-blue-700 dark:text-blue-300",
	},
	intermediario: {
		label: "Intermediário",
		defaultInicio: "12:00",
		defaultFim: "20:00",
		color: "#d97706",
		badgeBg: "bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
		badgeText: "text-amber-700 dark:text-amber-300",
	},
	fechamento: {
		label: "Fechamento",
		defaultInicio: "14:00",
		defaultFim: "22:00",
		color: "#7c3aed",
		badgeBg: "bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
		badgeText: "text-purple-700 dark:text-purple-300",
	},
	integral: {
		label: "Integral",
		defaultInicio: "09:00",
		defaultFim: "21:00",
		color: "#059669",
		badgeBg: "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
		badgeText: "text-emerald-700 dark:text-emerald-300",
	},
	folga: {
		label: "Folga",
		defaultInicio: "",
		defaultFim: "",
		color: "#64748b",
		badgeBg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
		badgeText: "text-slate-600 dark:text-slate-400",
	},
	personalizado: {
		label: "Personalizado",
		defaultInicio: "10:00",
		defaultFim: "18:00",
		color: "#0284c7",
		badgeBg: "bg-sky-100 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800",
		badgeText: "text-sky-700 dark:text-sky-300",
	},
};

export const TIPO_LANCAMENTO_CONFIG: Record<
	TipoLancamentoFinanceiro,
	{ label: string; badgeBg: string; badgeText: string; isProvento: boolean }
> = {
	salario: {
		label: "Salário Base",
		badgeBg: "bg-blue-100 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800",
		badgeText: "text-blue-700 dark:text-blue-300",
		isProvento: true,
	},
	vale_transporte: {
		label: "Vale-Transporte",
		badgeBg: "bg-teal-100 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800",
		badgeText: "text-teal-700 dark:text-teal-300",
		isProvento: true,
	},
	bonus: {
		label: "Bonificação / Extra",
		badgeBg: "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
		badgeText: "text-emerald-700 dark:text-emerald-300",
		isProvento: true,
	},
	gasto_pontual: {
		label: "Gasto Pontual / Reembolso",
		badgeBg: "bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800",
		badgeText: "text-indigo-700 dark:text-indigo-300",
		isProvento: true,
	},
	retirada: {
		label: "Retirada / Adiantamento",
		badgeBg: "bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
		badgeText: "text-amber-700 dark:text-amber-300",
		isProvento: false, // Dedução
	},
	desconto: {
		label: "Desconto / Falta",
		badgeBg: "bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
		badgeText: "text-rose-700 dark:text-rose-300",
		isProvento: false, // Dedução
	},
	pagamento_realizado: {
		label: "Pagamento Efetuado",
		badgeBg: "bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
		badgeText: "text-purple-700 dark:text-purple-300",
		isProvento: false, // Baixa
	},
};
