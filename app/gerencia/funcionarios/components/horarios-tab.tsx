"use client";

import { useState, useEffect } from "react";
import { STORE_NAMES, StoreId } from "@/types";
import {
	HorarioSemanaLoja,
	DiaHorarioLoja,
	HORARIO_PADRAO_SEMANA,
} from "@/types/funcionarios";
import { saveLojaHorarios } from "@/lib/funcionarios-service";
import {
	Clock,
	Store,
	Save,
	Check,
	Sparkles,
	Copy,
	AlertCircle,
	Calendar,
	CheckCircle2,
} from "lucide-react";
import TimeInput24h from "./time-input-24h";

interface HorariosTabProps {
	lojasHorarios: Record<StoreId, HorarioSemanaLoja>;
	selectedLoja: StoreId;
	onSelectLoja: (loja: StoreId) => void;
}

const STORES: { id: StoreId; name: string }[] = [
	{ id: "lago", name: STORE_NAMES.lago },
	{ id: "terraco", name: STORE_NAMES.terraco },
	{ id: "conjunto", name: STORE_NAMES.conjunto },
	{ id: "noroeste", name: STORE_NAMES.noroeste },
];

const DIAS_SEMANA_CONFIG: { key: number; label: string; short: string }[] = [
	{ key: 1, label: "Segunda-feira", short: "Seg" },
	{ key: 2, label: "Terça-feira", short: "Ter" },
	{ key: 3, label: "Quarta-feira", short: "Qua" },
	{ key: 4, label: "Quinta-feira", short: "Qui" },
	{ key: 5, label: "Sexta-feira", short: "Sex" },
	{ key: 6, label: "Sábado", short: "Sáb" },
	{ key: 0, label: "Domingo", short: "Dom" },
];

const calculateDurationHours = (abertura: string, fechamento: string): number => {
	if (!abertura || !fechamento) return 0;
	const [h1, m1] = abertura.split(":").map(Number);
	const [h2, m2] = fechamento.split(":").map(Number);
	if (isNaN(h1) || isNaN(h2)) return 0;
	const min1 = h1 * 60 + (isNaN(m1) ? 0 : m1);
	const min2 = h2 * 60 + (isNaN(m2) ? 0 : m2);
	const diff = min2 >= min1 ? min2 - min1 : 24 * 60 - min1 + min2;
	return Number((diff / 60).toFixed(1));
};

export default function HorariosTab({
	lojasHorarios,
	selectedLoja,
	onSelectLoja,
}: HorariosTabProps) {
	const [currentHorarios, setCurrentHorarios] = useState<HorarioSemanaLoja>(() => {
		return lojasHorarios[selectedLoja] || HORARIO_PADRAO_SEMANA;
	});

	const [isSaving, setIsSaving] = useState(false);
	const [savedSuccess, setSavedSuccess] = useState(false);

	// Quando o usuário troca de loja ou chegam dados atualizados do Firestore
	useEffect(() => {
		if (lojasHorarios[selectedLoja]) {
			setCurrentHorarios(lojasHorarios[selectedLoja]);
		} else {
			setCurrentHorarios(HORARIO_PADRAO_SEMANA);
		}
		setSavedSuccess(false);
	}, [selectedLoja, lojasHorarios]);

	const handleDayChange = (dayKey: number, field: keyof DiaHorarioLoja, value: any) => {
		setCurrentHorarios((prev) => ({
			...prev,
			[dayKey]: {
				...prev[dayKey],
				[field]: value,
			},
		}));
		setSavedSuccess(false);
	};

	const copyToAllDays = (sourceDayKey: number) => {
		const source = currentHorarios[sourceDayKey];
		const updated: HorarioSemanaLoja = { ...currentHorarios };
		DIAS_SEMANA_CONFIG.forEach((d) => {
			updated[d.key] = { ...source };
		});
		setCurrentHorarios(updated);
		setSavedSuccess(false);
	};

	const applyPreset = (abertura: string, fechamento: string, domAbertura = "12:00", domFechamento = "20:00") => {
		const updated: HorarioSemanaLoja = { ...currentHorarios };
		[1, 2, 3, 4, 5, 6].forEach((key) => {
			updated[key] = { ativo: true, abertura, fechamento };
		});
		updated[0] = { ativo: true, abertura: domAbertura, fechamento: domFechamento };
		setCurrentHorarios(updated);
		setSavedSuccess(false);
	};

	const handleSave = async () => {
		try {
			setIsSaving(true);
			await saveLojaHorarios(selectedLoja, currentHorarios);
			setSavedSuccess(true);
			setTimeout(() => setSavedSuccess(false), 3000);
		} catch (error) {
			console.error("Erro ao salvar horários da loja:", error);
			alert("Ocorreu um erro ao salvar os horários da loja.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Sub-abas das 4 Lojas */}
			<div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 overflow-x-auto shadow-inner">
				{STORES.map((store) => {
					const isSelected = selectedLoja === store.id;

					return (
						<button
							key={store.id}
							onClick={() => onSelectLoja(store.id)}
							className={`cursor-pointer flex-1 min-w-[140px] px-4 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all ${
								isSelected
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							<Store size={18} />
							<span>{store.name}</span>
						</button>
					);
				})}
			</div>

			{/* Cartão de Configuração e Ações */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
				{/* Cabeçalho */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Clock className="text-blue-600 dark:text-blue-400" size={22} />
							<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
								Horário de Funcionamento — Loja {STORE_NAMES[selectedLoja]}
							</h3>
						</div>
						<p className="text-xs text-slate-500 dark:text-slate-400">
							Defina os horários de abertura e fechamento para cada dia da semana. O calendário de escalas desta loja refletirá exatamente estes limites.
						</p>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<button
							onClick={handleSave}
							disabled={isSaving}
							className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all flex items-center gap-2">
							{savedSuccess ? (
								<>
									<Check size={16} className="text-emerald-300" />
									<span>Salvo com Sucesso!</span>
								</>
							) : (
								<>
									<Save size={16} />
									<span>{isSaving ? "Salvando..." : "Salvar Horários"}</span>
								</>
							)}
						</button>
					</div>
				</div>

				{/* Presets Rápidos */}
				<div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-800 text-xs">
					<span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
						<Sparkles size={14} className="text-blue-500" />
						Preenchimento Rápido:
					</span>
					<button
						type="button"
						onClick={() => applyPreset("10:00", "22:00", "12:00", "20:00")}
						className="cursor-pointer px-3 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors">
						Padrão Shopping (10h às 22h • Dom 12h às 20h)
					</button>
					<button
						type="button"
						onClick={() => applyPreset("09:00", "21:00", "10:00", "18:00")}
						className="cursor-pointer px-3 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors">
						Comércio de Rua (09h às 21h • Dom 10h às 18h)
					</button>
					<button
						type="button"
						onClick={() => applyPreset("08:00", "23:00", "08:00", "23:00")}
						className="cursor-pointer px-3 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors">
						Horário Amplo (08h às 23h todos os dias)
					</button>
				</div>

				{/* Tabela / Grade dos 7 Dias da Semana */}
				<div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
					{DIAS_SEMANA_CONFIG.map(({ key, label }) => {
						const diaData = currentHorarios[key] || {
							ativo: true,
							abertura: "10:00",
							fechamento: "22:00",
						};
						const duration = calculateDurationHours(diaData.abertura, diaData.fechamento);

						return (
							<div
								key={key}
								className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
									diaData.ativo
										? "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
										: "bg-slate-50/40 dark:bg-slate-950/40 opacity-70"
								}`}>
								{/* Identificação do Dia e Checkbox Ativo */}
								<div className="flex items-center gap-3 w-48 shrink-0">
									<label className="flex items-center gap-2 cursor-pointer select-none">
										<input
											type="checkbox"
											checked={diaData.ativo}
											onChange={(e) => handleDayChange(key, "ativo", e.target.checked)}
											className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 rounded-md"
										/>
										<span
											className={`text-sm font-black ${
												key === 0 || key === 6
													? "text-amber-600 dark:text-amber-400"
													: "text-slate-800 dark:text-slate-200"
											}`}>
											{label}
										</span>
									</label>
								</div>

								{/* Horários de Abertura e Fechamento */}
								{diaData.ativo ? (
									<div className="flex flex-wrap items-center gap-4">
										<div className="flex items-center gap-2">
											<span className="text-xs text-slate-500 font-semibold">Abertura:</span>
											<TimeInput24h
												value={diaData.abertura}
												onChange={(val) => handleDayChange(key, "abertura", val)}
												className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>

										<div className="flex items-center gap-2">
											<span className="text-xs text-slate-500 font-semibold">Fechamento:</span>
											<TimeInput24h
												value={diaData.fechamento}
												onChange={(val) => handleDayChange(key, "fechamento", val)}
												className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>

										<span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
											{duration}h de funcionamento
										</span>
									</div>
								) : (
									<div className="flex items-center text-xs font-bold text-slate-400 italic">
										Loja fechada neste dia
									</div>
								)}

								{/* Ação de Cópia */}
								<div className="flex items-center justify-end">
									{diaData.ativo && (
										<button
											type="button"
											onClick={() => copyToAllDays(key)}
											title={`Copiar horário de ${label} para todos os outros dias`}
											className="cursor-pointer text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
											<Copy size={13} />
											<span>Copiar para os demais dias</span>
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>

				{/* Mensagem de Ajuda */}
				<div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
					<CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
					<div className="space-y-1">
						<p className="font-black">Integração Direta com o Calendário de Escalas:</p>
						<p>
							Ao alterar os horários desta loja, a sub-aba <strong>Escala</strong> adaptará automaticamente os limites do calendário, a régua de horas e a fração visual preenchida pelos cards de cada funcionário.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
