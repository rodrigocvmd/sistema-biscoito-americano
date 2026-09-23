"use client";

import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";

interface TimeInput24hProps {
	value?: string; // Formato "HH:mm" (24h)
	onChange: (val: string) => void;
	disabled?: boolean;
	required?: boolean;
	className?: string;
	id?: string;
}

/**
 * Componente TimeInput24h:
 * Garante entrada estritamente em formato 24 horas (00:00 às 23:59),
 * livre de AM/PM de navegadores com locale em inglês, com validação e
 * máscara automática.
 */
export default function TimeInput24h({
	value = "10:00",
	onChange,
	disabled = false,
	required = false,
	className = "",
	id,
}: TimeInput24hProps) {
	const [text, setText] = useState(value || "10:00");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (value !== undefined) {
			setText(value);
		}
	}, [value]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let val = e.target.value;

		// Remove caracteres não numéricos exceto ":"
		val = val.replace(/[^\d:]/g, "");

		// Se o usuário digitou 2 dígitos seguidos sem os dois pontos, formata
		if (val.length === 2 && !val.includes(":") && !text.endsWith(":")) {
			const hh = parseInt(val, 10);
			if (hh >= 0 && hh <= 23) {
				val = `${val}:`;
			}
		}

		if (val.length > 5) {
			val = val.slice(0, 5);
		}

		setText(val);

		// Se já formou um horário completo HH:mm válido no range 00:00 a 23:59
		if (/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
			onChange(val);
		}
	};

	const handleBlur = () => {
		if (!text) {
			if (required) {
				setText("10:00");
				onChange("10:00");
			} else {
				onChange("");
			}
			return;
		}

		// Se tiver apenas hora digitada (ex: "8" ou "14")
		const parts = text.split(":");
		let h = parseInt(parts[0], 10);
		let m = parseInt(parts[1] || "0", 10);

		if (isNaN(h)) h = 10;
		if (h < 0) h = 0;
		if (h > 23) h = 23;

		if (isNaN(m)) m = 0;
		if (m < 0) m = 0;
		if (m > 59) m = 59;

		const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
		setText(formatted);
		onChange(formatted);
	};

	return (
		<div className="relative flex items-center">
			<input
				ref={inputRef}
				id={id}
				type="text"
				inputMode="numeric"
				placeholder="HH:mm (24h)"
				maxLength={5}
				disabled={disabled}
				required={required}
				value={text}
				onChange={handleChange}
				onBlur={handleBlur}
				className={`pr-8 font-mono ${className}`}
			/>
			<Clock
				size={14}
				className="absolute right-2.5 text-slate-400 pointer-events-none shrink-0"
			/>
		</div>
	);
}
