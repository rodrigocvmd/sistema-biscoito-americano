import React from "react";
import { InsumoResponsavel } from "@/lib/insumos-data";

interface ResponsavelTagProps {
	nome: InsumoResponsavel | string;
	size?: "sm" | "md";
	removable?: boolean;
	onRemove?: () => void;
	onClick?: () => void;
	selected?: boolean;
}

export function getResponsavelColor(nome: string) {
	switch (nome) {
		case "Rodrigo":
			return {
				bg: "bg-blue-50 dark:bg-blue-950/50",
				text: "text-blue-700 dark:text-blue-300",
				border: "border-blue-200 dark:border-blue-800/80",
				activeBg: "bg-blue-600 text-white border-blue-600 shadow-sm",
				dot: "bg-blue-500",
			};
		case "Ana":
			return {
				bg: "bg-rose-50 dark:bg-rose-950/50",
				text: "text-rose-700 dark:text-rose-300",
				border: "border-rose-200 dark:border-rose-800/80",
				activeBg: "bg-rose-600 text-white border-rose-600 shadow-sm",
				dot: "bg-rose-500",
			};
		case "Edson":
			return {
				bg: "bg-amber-50 dark:bg-amber-950/50",
				text: "text-amber-800 dark:text-amber-300",
				border: "border-amber-200 dark:border-amber-800/80",
				activeBg: "bg-amber-600 text-white border-amber-600 shadow-sm",
				dot: "bg-amber-500",
			};
		default:
			return {
				bg: "bg-slate-100 dark:bg-slate-800",
				text: "text-slate-700 dark:text-slate-300",
				border: "border-slate-200 dark:border-slate-700",
				activeBg: "bg-slate-700 text-white border-slate-700",
				dot: "bg-slate-400",
			};
	}
}

export function ResponsavelTag({
	nome,
	size = "sm",
	removable,
	onRemove,
	onClick,
	selected,
}: ResponsavelTagProps) {
	const colors = getResponsavelColor(nome);
	const sizeClasses = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-2xs";

	const baseClasses = `inline-flex items-center gap-1.5 font-black uppercase tracking-wider rounded-lg border transition-all select-none ${sizeClasses}`;

	if (selected !== undefined) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={`cursor-pointer ${baseClasses} ${
					selected
						? colors.activeBg
						: `${colors.bg} ${colors.text} ${colors.border} opacity-50 hover:opacity-100`
				}`}>
				<span
					className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-white" : colors.dot}`}
				/>
				<span>{nome}</span>
			</button>
		);
	}

	return (
		<span className={`${baseClasses} ${colors.bg} ${colors.text} ${colors.border}`}>
			<span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
			<span>{nome}</span>
			{removable && onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					className="cursor-pointer ml-0.5 -mr-0.5 text-slate-400 hover:text-red-500 font-bold leading-none">
					×
				</button>
			)}
		</span>
	);
}

export function ResponsavelTagsList({
	responsaveis,
	emptyText = "Não definido",
}: {
	responsaveis?: (InsumoResponsavel | string)[];
	emptyText?: string;
}) {
	if (!responsaveis || responsaveis.length === 0) {
		return <span className="text-2xs font-medium text-slate-400 italic">{emptyText}</span>;
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{responsaveis.map((resp) => (
				<ResponsavelTag key={resp} nome={resp} />
			))}
		</div>
	);
}
