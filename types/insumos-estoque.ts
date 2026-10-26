export type EstoqueFisicoId = "casa" | "lago" | "noroeste";

export type InsumoEstoqueNivel = "zerado" | "pouco" | "suficiente";

export const ESTOQUES_FISICOS: { id: EstoqueFisicoId; name: string }[] = [
	{ id: "casa", name: "Casa" },
	{ id: "lago", name: "Lago" },
	{ id: "noroeste", name: "Noroeste" },
];

export const ESTOQUE_NIVEL_CONFIG: Record<
	InsumoEstoqueNivel,
	{
		label: string;
		color: string;
		badgeClass: string;
		dotColor: string;
		step: number;
	}
> = {
	zerado: {
		label: "Zerado",
		color: "text-red-600 dark:text-red-400",
		badgeClass: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/60",
		dotColor: "bg-red-500",
		step: 0,
	},
	pouco: {
		label: "Pouco",
		color: "text-amber-600 dark:text-amber-400",
		badgeClass: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60",
		dotColor: "bg-amber-500",
		step: 1,
	},
	suficiente: {
		label: "Suficiente",
		color: "text-emerald-600 dark:text-emerald-400",
		badgeClass: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60",
		dotColor: "bg-emerald-500",
		step: 2,
	},
};

export const STEP_TO_NIVEL: Record<number, InsumoEstoqueNivel> = {
	0: "zerado",
	1: "pouco",
	2: "suficiente",
};

export interface InsumoEstoqueItem {
	id: string; // slug
	nome: string;
	categoria?: string;
	locais: Partial<Record<EstoqueFisicoId, InsumoEstoqueNivel>>;
	updatedAt?: any;
}
