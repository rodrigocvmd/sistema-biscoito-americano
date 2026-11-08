"use client";

import React, { forwardRef, useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";

export interface DateInputBRProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
	/**
	 * Data em formato ISO / Banco ("YYYY-MM-DD") ou vazia ""
	 */
	value: string;
	/**
	 * Retorna a data no formato ISO ("YYYY-MM-DD") ou "" se incompleta/inválida
	 */
	onChangeDate: (isoDate: string) => void;
	required?: boolean;
	className?: string;
}

// Converte YYYY-MM-DD para DD/MM/AAAA
function isoToBR(isoStr?: string): string {
	if (!isoStr) return "";
	const parts = isoStr.split("T")[0].split("-");
	if (parts.length === 3) {
		const [y, m, d] = parts;
		return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
	}
	return isoStr;
}

// Converte DD/MM/AAAA para YYYY-MM-DD
function brToIso(brStr: string): string {
	const parts = brStr.split("/");
	if (parts.length === 3) {
		const [d, m, y] = parts;
		if (d.length === 2 && m.length === 2 && y.length === 4) {
			const dayNum = parseInt(d, 10);
			const monthNum = parseInt(m, 10);
			const yearNum = parseInt(y, 10);
			if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
				return `${y}-${m}-${d}`;
			}
		}
	}
	return "";
}

// Formata progressivamente a digitação com as barras automáticas
function maskDate(raw: string): string {
	const digits = raw.replace(/\D/g, "").slice(0, 8);
	if (digits.length <= 2) {
		return digits;
	}
	if (digits.length <= 4) {
		return `${digits.slice(0, 2)}/${digits.slice(2)}`;
	}
	return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export const DateInputBR = forwardRef<HTMLInputElement, DateInputBRProps>(
	({ value, onChangeDate, required, className = "", id, name, ...props }, ref) => {
		const [textValue, setTextValue] = useState<string>(() => isoToBR(value));
		const pickerRef = useRef<HTMLInputElement>(null);

		// Sincroniza quando o valor prop externo muda (ex: reset ou load)
		useEffect(() => {
			setTextValue(isoToBR(value));
		}, [value]);

		const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const masked = maskDate(e.target.value);
			setTextValue(masked);

			if (masked.length === 10) {
				const iso = brToIso(masked);
				if (iso) {
					onChangeDate(iso);
				}
			} else if (masked.length === 0) {
				onChangeDate("");
			}
		};

		const handleBlur = () => {
			if (textValue.length === 10) {
				const iso = brToIso(textValue);
				if (iso) {
					onChangeDate(iso);
				} else {
					// Data inválida (ex: 32/13/2026), reverte para prop anterior
					setTextValue(isoToBR(value));
				}
			} else if (textValue.length > 0 && textValue.length < 10) {
				// Incompleta no blur: restaura anterior
				setTextValue(isoToBR(value));
			}
		};

		// Quando seleciona via calendário nativo
		const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const pickedIso = e.target.value;
			if (pickedIso) {
				setTextValue(isoToBR(pickedIso));
				onChangeDate(pickedIso);
			}
		};

		const openCalendar = () => {
			if (pickerRef.current) {
				if ("showPicker" in pickerRef.current) {
					try {
						(pickerRef.current as any).showPicker();
						return;
					} catch {}
				}
				pickerRef.current.focus();
				pickerRef.current.click();
			}
		};

		return (
			<div className="relative flex items-center w-full">
				<input
					{...props}
					ref={ref}
					id={id}
					name={name}
					type="text"
					inputMode="numeric"
					placeholder="dd/mm/aaaa"
					value={textValue}
					onChange={handleTextChange}
					onBlur={handleBlur}
					onClick={(e) => {
						e.currentTarget.select();
						props.onClick?.(e);
					}}
					onFocus={(e) => {
						e.currentTarget.select();
						props.onFocus?.(e);
					}}
					required={required}
					className={`${className} pr-10`}
				/>

				{/* Botão de abrir calendário */}
				<button
					type="button"
					tabIndex={-1}
					onClick={openCalendar}
					title="Abrir calendário"
					className="absolute right-2.5 p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
					<CalendarIcon size={16} />
				</button>

				{/* Input nativo invisível para o datepicker nativo */}
				<input
					ref={pickerRef}
					type="date"
					tabIndex={-1}
					aria-hidden="true"
					value={value || ""}
					onChange={handlePickerChange}
					className="absolute opacity-0 pointer-events-none w-0 h-0 right-0 bottom-0"
				/>
			</div>
		);
	}
);

DateInputBR.displayName = "DateInputBR";

