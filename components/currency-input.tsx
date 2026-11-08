"use client";

import React, { forwardRef } from "react";

export interface CurrencyInputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
	value: string | number;
	onChangeValue: (numericValue: number, formattedString: string) => void;
	prefix?: string;
	integerOnly?: boolean;
	selectAllOnClick?: boolean;
}

/**
 * Converte qualquer valor (number ou string) em string formatada "0,00" ou "0" se integerOnly
 */
export function formatCurrencyValue(val: number | string, integerOnly = false): string {
	if (val === "" || val === undefined || val === null) return integerOnly ? "0" : "0,00";
	let num: number;
	if (typeof val === "number") {
		num = isNaN(val) ? 0 : val;
		if (integerOnly) {
			num = Math.round(num);
		}
	} else {
		// Se já vier formatado ou como string numérica
		const digits = val.replace(/\D/g, "");
		if (!digits) return integerOnly ? "0" : "0,00";
		if (integerOnly) {
			num = parseInt(digits, 10);
		} else {
			num = parseInt(digits, 10) / 100;
		}
	}
	if (integerOnly) {
		return num.toLocaleString("pt-BR", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		});
	}
	return num.toLocaleString("pt-BR", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

/**
 * Input monetário estilo ATM / Caixa Eletrônico:
 * - integerOnly = false: máscara progressiva de centavos (1 -> 0,01 -> 0,15 -> 1,59)
 * - integerOnly = true: valor inteiro em reais, sem centavos (1 -> 1 -> 15 -> 150 -> 1.500)
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
	(
		{
			value,
			onChangeValue,
			prefix,
			integerOnly = false,
			selectAllOnClick = false,
			className = "",
			onFocus,
			onClick,
			...props
		},
		ref
	) => {
		const formattedDisplay = formatCurrencyValue(value, integerOnly);

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const raw = e.target.value;
			const digits = raw.replace(/\D/g, "");
			if (!digits) {
				onChangeValue(0, integerOnly ? "0" : "0,00");
				return;
			}
			if (integerOnly) {
				const numeric = parseInt(digits, 10);
				const formatted = numeric.toLocaleString("pt-BR", {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				});
				onChangeValue(numeric, formatted);
			} else {
				const numeric = parseInt(digits, 10) / 100;
				const formatted = numeric.toLocaleString("pt-BR", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				});
				onChangeValue(numeric, formatted);
			}
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

			// Se todo o texto estiver selecionado e o usuário apertar Backspace ou Delete
			const input = e.currentTarget;
			const isAllSelected =
				input.selectionStart === 0 &&
				input.selectionEnd !== null &&
				input.selectionEnd === input.value.length;

			if (isAllSelected && (e.key === "Backspace" || e.key === "Delete")) {
				e.preventDefault();
				onChangeValue(0, integerOnly ? "0" : "0,00");
				return;
			}

			if (e.key === "Backspace") {
				e.preventDefault();
				const currentStr =
					typeof value === "number"
						? integerOnly
							? Math.round(value).toFixed(0)
							: (value * 100).toFixed(0)
						: String(value ?? "");
				const digits = currentStr.replace(/\D/g, "");
				if (digits.length <= 1) {
					onChangeValue(0, integerOnly ? "0" : "0,00");
					return;
				}
				const newDigits = digits.slice(0, -1);
				if (integerOnly) {
					const numeric = parseInt(newDigits, 10);
					const formatted = numeric.toLocaleString("pt-BR", {
						minimumFractionDigits: 0,
						maximumFractionDigits: 0,
					});
					onChangeValue(numeric, formatted);
				} else {
					const numeric = parseInt(newDigits, 10) / 100;
					const formatted = numeric.toLocaleString("pt-BR", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					});
					onChangeValue(numeric, formatted);
				}
				return;
			}

			if (e.key === "Delete") {
				e.preventDefault();
				onChangeValue(0, integerOnly ? "0" : "0,00");
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
					if (selectAllOnClick) {
						e.target.select();
					} else {
						const len = e.target.value.length;
						e.target.setSelectionRange(len, len);
					}
					if (onFocus) onFocus(e);
				}}
				onClick={(e) => {
					if (selectAllOnClick) {
						e.currentTarget.select();
					} else {
						const inputEl = e.currentTarget;
						const len = inputEl.value.length;
						inputEl.setSelectionRange(len, len);
					}
					if (onClick) onClick(e);
				}}
				className={className}
			/>
		);
	}
);

CurrencyInput.displayName = "CurrencyInput";
