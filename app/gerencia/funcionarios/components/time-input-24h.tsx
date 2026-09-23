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
 * - cursor-pointer com separação visual clara entre Horas e Minutos.
 * - Um clique no campo de hora seleciona a hora.
 * - Um clique no campo de minuto seleciona o minuto.
 * - Ao digitar o 2º dígito da hora, pula automaticamente para os minutos e os deixa selecionados.
 * - Ao digitar os minutos (1º e 2º dígitos), ambos os dígitos são preservados e validados (00 a 59),
 *   sem resetar para 00 nem sobrescrever incorretamente.
 */
export default function TimeInput24h({
	value = "10:00",
	onChange,
	disabled = false,
	required = false,
	className = "",
	id,
}: TimeInput24hProps) {
	// Divide value inicial
	const parseValue = (val?: string) => {
		const parts = (val || "10:00").split(":");
		const h = (parts[0] || "10").padStart(2, "0").slice(0, 2);
		const m = (parts[1] || "00").padStart(2, "0").slice(0, 2);
		return { h, m };
	};

	const initial = parseValue(value);
	const [hour, setHour] = useState(initial.h);
	const [minute, setMinute] = useState(initial.m);

	// Estado temporário durante digitação
	const [hourDraft, setHourDraft] = useState<string | null>(null);
	const [minuteDraft, setMinuteDraft] = useState<string | null>(null);

	const hourInputRef = useRef<HTMLInputElement>(null);
	const minuteInputRef = useRef<HTMLInputElement>(null);

	// Sincroniza quando o valor prop externo muda
	useEffect(() => {
		if (value) {
			const parsed = parseValue(value);
			setHour(parsed.h);
			setMinute(parsed.m);
			setHourDraft(null);
			setMinuteDraft(null);
		}
	}, [value]);

	// Seleção de horas com um clique
	const handleHourClick = () => {
		if (disabled) return;
		hourInputRef.current?.select();
	};

	const handleHourFocus = () => {
		hourInputRef.current?.select();
	};

	// Seleção de minutos com um clique
	const handleMinuteClick = () => {
		if (disabled) return;
		minuteInputRef.current?.select();
	};

	const handleMinuteFocus = () => {
		minuteInputRef.current?.select();
	};

	// Digitação no campo de HORA
	const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return;

		// Navegação para minutos com seta direita, Tab ou ':'
		if (e.key === "ArrowRight" || e.key === ":") {
			e.preventDefault();
			minuteInputRef.current?.focus();
			minuteInputRef.current?.select();
			return;
		}

		if (/^[0-9]$/.test(e.key)) {
			e.preventDefault();
			const digit = e.key;

			if (hourDraft === null) {
				// Primeiro dígito digitado
				const num = parseInt(digit, 10);
				// Se digitar um número > 2 (ex: 3 a 9), pode ser formatado direto como 03, 04... e ir pro minuto
				if (num > 2) {
					const finalH = `0${num}`;
					setHour(finalH);
					setHourDraft(null);
					onChange(`${finalH}:${minute}`);
					// Pula automaticamente para os minutos e seleciona
					setTimeout(() => {
						minuteInputRef.current?.focus();
						minuteInputRef.current?.select();
					}, 0);
				} else {
					// 0, 1 ou 2 aguarda o segundo dígito
					setHourDraft(digit);
				}
			} else {
				// Segundo dígito digitado
				let hNum = parseInt(`${hourDraft}${digit}`, 10);
				if (isNaN(hNum) || hNum > 23) {
					hNum = 23;
				}
				const finalH = String(hNum).padStart(2, "0");
				setHour(finalH);
				setHourDraft(null);
				onChange(`${finalH}:${minute}`);

				// Pula automaticamente para os minutos e seleciona
				setTimeout(() => {
					minuteInputRef.current?.focus();
					minuteInputRef.current?.select();
				}, 0);
			}
			return;
		}

		if (e.key === "Backspace") {
			e.preventDefault();
			setHourDraft(null);
			setHour("00");
			onChange(`00:${minute}`);
			hourInputRef.current?.select();
		}
	};

	const handleHourBlur = () => {
		if (hourDraft !== null) {
			const finalH = hourDraft.padStart(2, "0");
			setHour(finalH);
			setHourDraft(null);
			onChange(`${finalH}:${minute}`);
		}
	};

	// Digitação no campo de MINUTO
	const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return;

		// Navegação para horas com seta esquerda
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			hourInputRef.current?.focus();
			hourInputRef.current?.select();
			return;
		}

		if (/^[0-9]$/.test(e.key)) {
			e.preventDefault();
			const digit = e.key;

			if (minuteDraft === null) {
				// Primeiro dígito do minuto
				const num = parseInt(digit, 10);
				// Se digitar > 5 (ex: 6 a 9), minutos máximos são 59, formata como 06, 07.. e seleciona
				if (num > 5) {
					const finalM = `0${num}`;
					setMinute(finalM);
					setMinuteDraft(null);
					onChange(`${hour}:${finalM}`);
					setTimeout(() => {
						minuteInputRef.current?.select();
					}, 0);
				} else {
					setMinuteDraft(digit);
				}
			} else {
				// Segundo dígito do minuto
				let mNum = parseInt(`${minuteDraft}${digit}`, 10);
				if (isNaN(mNum) || mNum > 59) {
					mNum = 59;
				}
				const finalM = String(mNum).padStart(2, "0");
				setMinute(finalM);
				setMinuteDraft(null);
				onChange(`${hour}:${finalM}`);

				// Mantém selecionado para caso queira redigitar
				setTimeout(() => {
					minuteInputRef.current?.select();
				}, 0);
			}
			return;
		}

		if (e.key === "Backspace") {
			e.preventDefault();
			setMinuteDraft(null);
			setMinute("00");
			onChange(`${hour}:00`);
			minuteInputRef.current?.select();
		}
	};

	const handleMinuteBlur = () => {
		if (minuteDraft !== null) {
			const finalM = minuteDraft.padStart(2, "0");
			setMinute(finalM);
			setMinuteDraft(null);
			onChange(`${hour}:${finalM}`);
		}
	};

	// Valores exibidos
	const displayHour = hourDraft !== null ? `${hourDraft}_` : hour;
	const displayMinute = minuteDraft !== null ? `${minuteDraft}_` : minute;

	return (
		<div
			id={id}
			className={`relative flex items-center justify-between cursor-pointer select-none font-mono ${className}`}>
			<div className="flex items-center">
				{/* Input Horas */}
				<input
					ref={hourInputRef}
					type="text"
					inputMode="numeric"
					maxLength={2}
					disabled={disabled}
					required={required}
					value={displayHour}
					onClick={handleHourClick}
					onFocus={handleHourFocus}
					onKeyDown={handleHourKeyDown}
					onBlur={handleHourBlur}
					onChange={() => {}}
					className="w-[22px] bg-transparent text-center font-mono font-bold cursor-pointer focus:outline-none focus:bg-blue-100 dark:focus:bg-blue-900/60 rounded"
				/>

				<span className="text-slate-400 font-bold px-0.5 select-none">:</span>

				{/* Input Minutos */}
				<input
					ref={minuteInputRef}
					type="text"
					inputMode="numeric"
					maxLength={2}
					disabled={disabled}
					required={required}
					value={displayMinute}
					onClick={handleMinuteClick}
					onFocus={handleMinuteFocus}
					onKeyDown={handleMinuteKeyDown}
					onBlur={handleMinuteBlur}
					onChange={() => {}}
					className="w-[22px] bg-transparent text-center font-mono font-bold cursor-pointer focus:outline-none focus:bg-blue-100 dark:focus:bg-blue-900/60 rounded"
				/>
			</div>

			<Clock
				size={14}
				className="text-slate-400 pointer-events-none shrink-0 ml-1.5"
			/>
		</div>
	);
}
