"use client";

import React, { forwardRef } from "react";

export interface CurrencyInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
	value: string | number;
	onChangeValue: (numericValue: number, formattedString: string) => void;
	prefix?: string;
}

/**
 * Converte qualquer valor (number ou string) em string formatada "0,00"
 */
export function formatCurrencyValue(val: number | string): string {
	if (val === "" || val === undefined || val === null) return "0,00";
	let num: number;
	if (typeof val === "number") {
		num = isNaN(val) ? 0 : val;
	} else {
		// Se já vier formatado ou como string numérica
		const digits = val.replace(/\D/g, "");
		if (!digits) return "0,00";
		num = parseInt(digits, 10) / 100;
	}
	return num.toLocaleString("pt-BR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

/**
 * Input monetário estilo ATM / Caixa Eletrônico (máscara progressiva da direita para a esquerda):
 * - User digita 1 -> 0,01
 * - User digita 5 -> 0,15
 * - User digita 9 -> 1,59
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
	({ value, onChangeValue, prefix, className = "", onFocus, onClick, ...props }, ref) => {
		const formattedDisplay = formatCurrencyValue(value);

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const raw = e.target.value;
			const digits = raw.replace(/\D/g, "");
			if (!digits) {
				onChangeValue(0, "0,00");
				return;
			}
			const numeric = parseInt(digits, 10) / 100;
			const formatted = numeric.toLocaleString("pt-BR", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});
			onChangeValue(numeric, formatted);
		};

		const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
			// Permite teclas de controle (Tab, Enter, Escape, setas)
			if (
				e.key === "Tab" ||
				e.key === "Enter" ||
				e.key === "Escape" ||
				e.key === "ArrowLeft" ||
				e.key === "ArrowRight" ||
				e.key === "ArrowUp" ||
				e.key === "ArrowDown"
			) {
				return;
			}

			if (e.key === "Backspace") {
				e.preventDefault();
				const currentStr = typeof value === "number" ? (value * 100).toFixed(0) : String(value ?? "");
				const digits = currentStr.replace(/\D/g, "");
				if (digits.length <= 1) {
					onChangeValue(0, "0,00");
					return;
				}
				const newDigits = digits.slice(0, -1);
				const numeric = parseInt(newDigits, 10) / 100;
				const formatted = numeric.toLocaleString("pt-BR", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				});
				onChangeValue(numeric, formatted);
				return;
			}

			if (e.key === "Delete") {
				e.preventDefault();
				onChangeValue(0, "0,00");
				return;
			}

			// Se não for dígito e nem combinação Ctrl/Cmd, ignora
			if (!/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
			}
		};

		return (
			<input
				{...props}
				ref={ref}
				type="text"
				inputMode="numeric"
				value={formattedDisplay}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onFocus={(e) => {
					// Posiciona o cursor no final
					const len = e.target.value.length;
					e.target.setSelectionRange(len, len);
					if (onFocus) onFocus(e);
				}}
				onClick={(e) => {
					const input = e.currentTarget;
					const len = input.value.length;
					input.setSelectionRange(len, len);
					if (onClick) onClick(e);
				}}
				className={className}
			/>
		);
	}
);

CurrencyInput.displayName = "CurrencyInput";
