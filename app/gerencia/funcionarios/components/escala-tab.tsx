"use client";

import { useState, useMemo } from "react";
import {
	EscalaItem,
	Funcionario,
	RegimeEscala,
	HorarioSemanaLoja,
	HORARIO_PADRAO_SEMANA,
} from "@/types/funcionarios";
import { STORE_NAMES, StoreId } from "@/types";
import {
	createEscala,
	updateEscala,
	deleteEscala,
	gerarEscalaAutomaticaMes,
} from "@/lib/funcionarios-service";
import {
	ChevronLeft,
	ChevronRight,
	Plus,
	Calendar as CalendarIcon,
	Clock,
	Trash2,
	X,
	Store,
	Users,
	Filter,
	Sparkles,
	Grid,
	Columns,
	AlertTriangle,
	CalendarDays,
	CheckCircle2,
	Info,
	Check,
	List,
} from "lucide-react";
import TimeInput24h from "./time-input-24h";

interface EscalaTabProps {
	escalas: EscalaItem[];
	funcionarios: Funcionario[];
	selectedLoja: StoreId;
	onSelectLoja: (loja: StoreId) => void;
	mesAnoStr: string; // YYYY-MM
	onChangeMesAno: (novoMesAno: string) => void;
	lojasHorarios: Record<StoreId, HorarioSemanaLoja>;
}

const STORES: { id: StoreId; name: string }[] = [
	{ id: "conjunto", name: STORE_NAMES.conjunto },
	{ id: "terraco", name: STORE_NAMES.terraco },
	{ id: "lago", name: STORE_NAMES.lago },
	{ id: "noroeste", name: STORE_NAMES.noroeste },
];

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

const DIAS_DESCANSO = [
	{ value: 1, label: "Segunda-feira" },
	{ value: 2, label: "Terça-feira" },
	{ value: 3, label: "Quarta-feira" },
	{ value: 4, label: "Quinta-feira" },
	{ value: 5, label: "Sexta-feira" },
	{ value: 6, label: "Sábado" },
	{ value: 0, label: "Domingo" },
];

const parseTimeToMinutes = (timeStr?: string, defaultHour: number = 10): number => {
	if (!timeStr) return defaultHour * 60;
	const parts = timeStr.split(":").map(Number);
	const h = isNaN(parts[0]) ? defaultHour : parts[0];
	const m = isNaN(parts[1]) ? 0 : parts[1];
	return h * 60 + m;
};

const calculateEndTime = (startTime: string, hoursToAdd: number): string => {
	if (!startTime) return "";
	const [h, m] = startTime.split(":").map(Number);
	if (isNaN(h)) return "";
	let newH = (h + hoursToAdd) % 24;
	return `${String(newH).padStart(2, "0")}:${String(isNaN(m) ? 0 : m).padStart(2, "0")}`;
};

interface PositionedShift {
	item: EscalaItem;
	startMin: number;
	endMin: number;
	topPercent: number;
	heightPercent: number;
	colIndex: number;
	totalCols: number;
	hasOverlap: boolean;
}

// Algoritmo de posicionamento e sobreposição de horários baseado nos limites de funcionamento da loja naquele dia
const computeDayLayout = (
	dayEscalas: EscalaItem[],
	storeAbertura: string = "10:00",
	storeFechamento: string = "22:00"
) => {
	const storeStartMin = parseTimeToMinutes(storeAbertura, 10);
	const storeEndMin = parseTimeToMinutes(storeFechamento, 22);
	const storeTotalMin = Math.max(60, storeEndMin - storeStartMin);

	const folgas: EscalaItem[] = [];
	const timed: { item: EscalaItem; startMin: number; endMin: number }[] = [];

	dayEscalas.forEach((e) => {
		if (e.turno === "folga" || (!e.horarioInicio && !e.horarioFim)) {
			folgas.push(e);
		} else {
			const rawStart = parseTimeToMinutes(e.horarioInicio, 10);
			const rawEnd = parseTimeToMinutes(e.horarioFim, 22);

			// Clampa aos limites da loja
			const startMin = Math.max(storeStartMin, Math.min(storeEndMin, rawStart));
			const finalEnd = rawEnd > rawStart ? rawEnd : rawStart + 60;
			const endMin = Math.max(startMin + 30, Math.min(storeEndMin, finalEnd));

			timed.push({ item: e, startMin, endMin });
		}
	});

	// Ordena por horário de início
	timed.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

	// Clusters de sobreposição
	const clusters: { item: EscalaItem; startMin: number; endMin: number }[][] = [];
	let currentCluster: { item: EscalaItem; startMin: number; endMin: number }[] = [];
	let clusterEnd = -1;

	timed.forEach((shift) => {
		if (currentCluster.length === 0) {
			currentCluster.push(shift);
			clusterEnd = shift.endMin;
		} else if (shift.startMin < clusterEnd) {
			currentCluster.push(shift);
			clusterEnd = Math.max(clusterEnd, shift.endMin);
		} else {
			clusters.push(currentCluster);
			currentCluster = [shift];
			clusterEnd = shift.endMin;
		}
	});
	if (currentCluster.length > 0) {
		clusters.push(currentCluster);
	}

	const positioned: PositionedShift[] = [];

	clusters.forEach((cluster) => {
		const columnEnds: number[] = [];
		const clusterPositions: {
			shift: { item: EscalaItem; startMin: number; endMin: number };
			col: number;
		}[] = [];

		cluster.forEach((shift) => {
			let col = columnEnds.findIndex((end) => end <= shift.startMin);
			if (col === -1) {
				col = columnEnds.length;
				columnEnds.push(shift.endMin);
			} else {
				columnEnds[col] = shift.endMin;
			}
			clusterPositions.push({ shift, col });
		});

		const maxCols = Math.max(1, columnEnds.length);

		clusterPositions.forEach(({ shift, col }) => {
			const topPercent = Math.max(
				0,
				Math.min(100, ((shift.startMin - storeStartMin) / storeTotalMin) * 100)
			);
			const heightPercent = Math.max(
				5,
				Math.min(100 - topPercent, ((shift.endMin - shift.startMin) / storeTotalMin) * 100)
			);

			const overlapsWithOther = clusterPositions.some(
				(other) =>
					other.shift !== shift &&
					Math.max(other.shift.startMin, shift.startMin) <
						Math.min(other.shift.endMin, shift.endMin)
			);

			const totalCols = overlapsWithOther ? maxCols : 1;
			const colIndex = overlapsWithOther ? col : 0;

			positioned.push({
				item: shift.item,
				startMin: shift.startMin,
				endMin: shift.endMin,
				topPercent,
				heightPercent,
				colIndex,
				totalCols,
				hasOverlap: overlapsWithOther,
			});
		});
	});

	return { folgas, positioned, storeStartMin, storeEndMin, storeTotalMin };
};

export default function EscalaTab({
	escalas,
	funcionarios,
	selectedLoja,
	onSelectLoja,
	mesAnoStr,
	onChangeMesAno,
	lojasHorarios,
}: EscalaTabProps) {
	const [viewType, setViewType] = useState<"lista" | "mes" | "semana">("lista");
	const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("todos");
	const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

	// Horários configurados para a loja atualmente selecionada
	const lojaHorariosConfig = useMemo(() => {
		return lojasHorarios[selectedLoja] || HORARIO_PADRAO_SEMANA;
	}, [lojasHorarios, selectedLoja]);

	// Horário padrão da loja para dias de semana úteis
	const defaultStoreHours = useMemo(() => {
		const seg = lojaHorariosConfig[1] || { ativo: true, abertura: "10:00", fechamento: "22:00" };
		return {
			abertura: seg.abertura || "10:00",
			fechamento: seg.fechamento || "22:00",
		};
	}, [lojaHorariosConfig]);

	// Extremos da régua semanal para esta loja (ex: 10:00 às 22:00)
	const storeWeekRange = useMemo(() => {
		let minH = 24;
		let maxH = 0;

		Object.values(lojaHorariosConfig).forEach((dia) => {
			if (dia.ativo) {
				const h1 = parseInt(dia.abertura.split(":")[0], 10);
				const h2 = parseInt(dia.fechamento.split(":")[0], 10);
				if (!isNaN(h1) && h1 < minH) minH = h1;
				if (!isNaN(h2) && h2 > maxH) maxH = h2;
			}
		});

		if (minH >= maxH) {
			minH = 10;
			maxH = 22;
		}

		const hours = Array.from({ length: maxH - minH + 1 }, (_, i) => minH + i);
		return { minH, maxH, hours, totalMinutes: (maxH - minH) * 60 };
	}, [lojaHorariosConfig]);

	// Estado do Modal de Edição/Criação Pontual (SEM Turno / Modalidade)
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingEscala, setEditingEscala] = useState<EscalaItem | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [formData, setFormData] = useState({
		funcionarioId: "",
		data: "",
		isFolga: false,
		horarioInicio: "10:00",
		horarioFim: "22:00",
		observacoes: "",
	});

	// Estado do Modal de Geração Automática Mensal (12x36 ou 6x1)
	const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
	const [isGeneratingAuto, setIsGeneratingAuto] = useState(false);
	const [autoFormData, setAutoFormData] = useState({
		funcionarioId: "",
		regime: "12x36" as RegimeEscala,
		primeiroDiaTrabalho: `${mesAnoStr}-01`,
		horarioInicio: defaultStoreHours.abertura,
		horarioFim: defaultStoreHours.fechamento,
		diaDescansoSemanal: 1, // Segunda-feira
		gerarDiasDeFolga: true,
	});

	// Navegação de Mês
	const [ano, mes] = mesAnoStr.split("-").map(Number);

	const handlePrevMonth = () => {
		let novoAno = ano;
		let novoMes = mes - 1;
		if (novoMes < 1) {
			novoMes = 12;
			novoAno--;
		}
		onChangeMesAno(`${novoAno}-${String(novoMes).padStart(2, "0")}`);
		setSelectedWeekIndex(0);
	};

	const handleNextMonth = () => {
		let novoAno = ano;
		let novoMes = mes + 1;
		if (novoMes > 12) {
			novoMes = 1;
			novoAno++;
		}
		onChangeMesAno(`${novoAno}-${String(novoMes).padStart(2, "0")}`);
		setSelectedWeekIndex(0);
	};

	const handleCurrentMonth = () => {
		const now = new Date();
		const currentStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		onChangeMesAno(currentStr);
		setSelectedWeekIndex(0);
	};

	// Helper para obter o dia da semana a partir de YYYY-MM-DD
	const getDayOfWeek = (dateStr: string) => {
		const [y, m, d] = dateStr.split("-").map(Number);
		return new Date(y, m - 1, d).getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
	};

	// Cálculo dos dias do mês (calendário padrão Seg a Dom)
	const calendarDays = useMemo(() => {
		const firstDayOfMonth = new Date(ano, mes - 1, 1);
		const lastDayOfMonth = new Date(ano, mes, 0);
		const daysInMonth = lastDayOfMonth.getDate();

		let startDayOfWeek = firstDayOfMonth.getDay() - 1;
		if (startDayOfWeek === -1) startDayOfWeek = 6;

		const days: {
			dayNum: number | null;
			dateStr: string;
			isCurrentMonth: boolean;
			isToday: boolean;
			dayOfWeek: number;
		}[] = [];

		// Dias do mês anterior
		const prevMonthLastDay = new Date(ano, mes - 1, 0).getDate();
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			const dayVal = prevMonthLastDay - i;
			const prevMonth = mes === 1 ? 12 : mes - 1;
			const prevYear = mes === 1 ? ano - 1 : ano;
			const dateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(dayVal).padStart(2, "0")}`;
			days.push({
				dayNum: dayVal,
				dateStr,
				isCurrentMonth: false,
				isToday: false,
				dayOfWeek: new Date(prevYear, prevMonth - 1, dayVal).getDay(),
			});
		}

		// Dias do mês atual
		const today = new Date();
		const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
			today.getDate()
		).padStart(2, "0")}`;

		for (let day = 1; day <= daysInMonth; day++) {
			const dateStr = `${ano}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			days.push({
				dayNum: day,
				dateStr,
				isCurrentMonth: true,
				isToday: dateStr === todayStr,
				dayOfWeek: new Date(ano, mes - 1, day).getDay(),
			});
		}

		// Completar dias da última semana
		const remaining = 7 - (days.length % 7);
		if (remaining < 7) {
			const nextMonth = mes === 12 ? 1 : mes + 1;
			const nextYear = mes === 12 ? ano + 1 : ano;
			for (let i = 1; i <= remaining; i++) {
				const dateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
				days.push({
					dayNum: i,
					dateStr,
					isCurrentMonth: false,
					isToday: false,
					dayOfWeek: new Date(nextYear, nextMonth - 1, i).getDay(),
				});
			}
		}

		return days;
	}, [ano, mes]);

	// Apenas os dias do mês atual (1 a 28/30/31) para a visualização em lista
	const monthDays = useMemo(() => {
		return calendarDays.filter((d) => d.isCurrentMonth);
	}, [calendarDays]);

	// Divide em semanas para a visualização semanal - apenas semanas que contêm dias do mês selecionado
	const weeks = useMemo(() => {
		const result: (typeof calendarDays)[] = [];
		for (let i = 0; i < calendarDays.length; i += 7) {
			const weekChunk = calendarDays.slice(i, i + 7);
			if (weekChunk.some((d) => d.isCurrentMonth)) {
				result.push(weekChunk);
			}
		}
		return result;
	}, [calendarDays]);

	// Garante que o índice da semana selecionada seja sempre válido ao trocar de mês
	const safeWeekIndex = Math.min(selectedWeekIndex, Math.max(0, weeks.length - 1));

	// Escalas filtradas da loja atual
	const lojaEscalas = useMemo(() => {
		return escalas.filter((e) => {
			const matchesLoja = e.lojaId === selectedLoja;
			const matchesEmployee =
				selectedEmployeeFilter === "todos" || e.funcionarioId === selectedEmployeeFilter;
			return matchesLoja && matchesEmployee;
		});
	}, [escalas, selectedLoja, selectedEmployeeFilter]);

	// Mapear escalas por data
	const escalasByDate = useMemo(() => {
		const map: Record<string, EscalaItem[]> = {};
		lojaEscalas.forEach((esc) => {
			if (!map[esc.data]) map[esc.data] = [];
			map[esc.data].push(esc);
		});
		return map;
	}, [lojaEscalas]);

	// Cálculo da pré-visualização da geração automática
	const autoPreview = useMemo(() => {
		if (!autoFormData.funcionarioId || !autoFormData.primeiroDiaTrabalho) return null;
		const totalDiasMes = new Date(ano, mes, 0).getDate();
		const startDay = parseInt(autoFormData.primeiroDiaTrabalho.split("-")[2], 10) || 1;

		let workDays = 0;
		let restDays = 0;

		if (autoFormData.regime === "12x36") {
			for (let d = startDay; d <= totalDiasMes; d++) {
				if ((d - startDay) % 2 === 0) workDays++;
				else restDays++;
			}
		} else {
			for (let d = startDay; d <= totalDiasMes; d++) {
				const dt = new Date(ano, mes - 1, d);
				if (dt.getDay() === autoFormData.diaDescansoSemanal) restDays++;
				else workDays++;
			}
		}

		return { workDays, restDays, totalDiasMes, startDay };
	}, [autoFormData, ano, mes]);

	// Ações do Modal de Geração Automática
	const openAutoModal = () => {
		const defaultFunc = funcionarios.find((f) => f.status === "ativo")?.id || "";
		setAutoFormData({
			funcionarioId: defaultFunc,
			regime: "12x36",
			primeiroDiaTrabalho: `${mesAnoStr}-01`,
			horarioInicio: defaultStoreHours.abertura,
			horarioFim: defaultStoreHours.fechamento, // 12h padrão
			diaDescansoSemanal: 1, // Segunda-feira
			gerarDiasDeFolga: true,
		});
		setIsAutoModalOpen(true);
	};

	const handleRegimeChange = (regime: RegimeEscala) => {
		if (regime === "12x36") {
			setAutoFormData((prev) => ({
				...prev,
				regime,
				horarioInicio: defaultStoreHours.abertura,
				horarioFim: calculateEndTime(defaultStoreHours.abertura, 12),
			}));
		} else {
			setAutoFormData((prev) => ({
				...prev,
				regime,
				horarioInicio: defaultStoreHours.abertura,
				horarioFim: calculateEndTime(defaultStoreHours.abertura, 9),
			}));
		}
	};

	const handleStartTimeChange = (newStart: string) => {
		const duration = autoFormData.regime === "12x36" ? 12 : 9;
		const newEnd = calculateEndTime(newStart, duration);
		setAutoFormData((prev) => ({
			...prev,
			horarioInicio: newStart,
			horarioFim: newEnd,
		}));
	};

	const handleAutoSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!autoFormData.funcionarioId || !autoFormData.primeiroDiaTrabalho) return;

		const func = funcionarios.find((f) => f.id === autoFormData.funcionarioId);
		if (!func) return;

		try {
			setIsGeneratingAuto(true);
			const { countTrabalho, countFolga } = await gerarEscalaAutomaticaMes({
				funcionarioId: func.id,
				funcionarioNome: func.apelido || func.nome,
				funcionarioCargo: func.cargo,
				lojaId: selectedLoja,
				mesAnoStr,
				regime: autoFormData.regime,
				primeiroDiaTrabalho: autoFormData.primeiroDiaTrabalho,
				horarioInicio: autoFormData.horarioInicio,
				horarioFim: autoFormData.horarioFim,
				diaDescansoSemanal: autoFormData.diaDescansoSemanal,
				gerarDiasDeFolga: autoFormData.gerarDiasDeFolga,
			});

			alert(
				`Escala do mês gerada com sucesso para ${func.nome}!\n` +
					`• ${countTrabalho} dias de trabalho agendados (${autoFormData.regime === "12x36" ? "12h/dia" : "9h/dia"})\n` +
					(countFolga > 0 ? `• ${countFolga} dias de descanso/folga registrados.\n\n` : "\n") +
					`Você pode clicar em qualquer dia no calendário para fazer ajustes pontuais específicos sem afetar os outros dias.`
			);

			setIsAutoModalOpen(false);
		} catch (error) {
			console.error("Erro ao gerar escala automática:", error);
			alert("Ocorreu um erro ao gerar a escala automática.");
		} finally {
			setIsGeneratingAuto(false);
		}
	};

	// Ações do Modal Pontual (Criar / Editar / Remover Dia Específico) - SEM SEÇÃO TURNO/MODALIDADE
	const openCreateModal = (dateStr?: string, defaultHour?: string) => {
		setEditingEscala(null);
		const defaultDate = dateStr || `${mesAnoStr}-01`;
		const defaultFunc = funcionarios.find((f) => f.status === "ativo")?.id || "";

		// Obter o horário da loja para aquele dia específico
		const dayOfWeek = getDayOfWeek(defaultDate);
		const diaConfig = lojaHorariosConfig[dayOfWeek] || {
			ativo: true,
			abertura: "10:00",
			fechamento: "22:00",
		};

		setFormData({
			funcionarioId: defaultFunc,
			data: defaultDate,
			isFolga: false,
			horarioInicio: defaultHour || diaConfig.abertura || "10:00",
			horarioFim: diaConfig.fechamento || "22:00",
			observacoes: "",
		});
		setIsModalOpen(true);
	};

	const openEditModal = (escala: EscalaItem, e: React.MouseEvent) => {
		e.stopPropagation();
		setEditingEscala(escala);
		const isFolga = escala.turno === "folga" || (!escala.horarioInicio && !escala.horarioFim);

		setFormData({
			funcionarioId: escala.funcionarioId,
			data: escala.data,
			isFolga,
			horarioInicio: escala.horarioInicio || "10:00",
			horarioFim: escala.horarioFim || "22:00",
			observacoes: escala.observacoes || "",
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.funcionarioId || !formData.data) return;

		const func = funcionarios.find((f) => f.id === formData.funcionarioId);
		if (!func) return;

		try {
			setIsSaving(true);
			const payload = {
				funcionarioId: func.id,
				funcionarioNome: func.apelido || func.nome,
				funcionarioCargo: func.cargo,
				lojaId: selectedLoja,
				data: formData.data,
				turno: formData.isFolga ? ("folga" as const) : ("personalizado" as const),
				horarioInicio: formData.isFolga ? undefined : formData.horarioInicio || undefined,
				horarioFim: formData.isFolga ? undefined : formData.horarioFim || undefined,
				observacoes: formData.observacoes.trim() || undefined,
			};

			if (editingEscala) {
				await updateEscala(editingEscala.id, payload);
			} else {
				await createEscala(payload);
			}

			setIsModalOpen(false);
		} catch (error) {
			console.error("Erro ao salvar escala:", error);
			alert("Ocorreu um erro ao salvar a escala pontual.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!editingEscala) return;
		if (!confirm("Deseja remover a escala deste dia específico? Os demais dias do colaborador permanecerão intactos."))
			return;

		try {
			setIsSaving(true);
			await deleteEscala(editingEscala.id);
			setIsModalOpen(false);
		} catch (error) {
			console.error("Erro ao excluir escala:", error);
			alert("Erro ao excluir escala.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* SUB-ABAS DAS 4 LOJAS */}
			<div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 overflow-x-auto shadow-inner">
				{STORES.map((store) => {
					const isSelected = selectedLoja === store.id;
					const count = escalas.filter((e) => e.lojaId === store.id).length;

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
							<span
								className={`text-xs px-2 py-0.5 rounded-full font-bold ${
									isSelected
										? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
										: "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
								}`}>
								{count}
							</span>
						</button>
					);
				})}
			</div>

			{/* BARRA DE CONTROLE DO CALENDÁRIO */}
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
				{/* Seletor do Mês/Ano e Navegação */}
				<div className="flex flex-wrap items-center gap-2">
					<button
						onClick={handlePrevMonth}
						aria-label="Mês anterior"
						className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
						<ChevronLeft size={20} />
					</button>

					<div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
						<CalendarIcon size={18} className="text-blue-600 dark:text-blue-400" />
						<span className="text-base font-black text-slate-800 dark:text-slate-200">
							{MESES[mes - 1]} {ano}
						</span>
					</div>

					<button
						onClick={handleNextMonth}
						aria-label="Próximo mês"
						className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
						<ChevronRight size={20} />
					</button>

					<button
						onClick={handleCurrentMonth}
						className="cursor-pointer text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-3 py-1.5 rounded-lg transition-colors">
						Mês Atual
					</button>

					{/* Badge Indicativo dos Horários da Loja Selecionada */}
					<div
						title="Horários de funcionamento configurados para esta loja na sub-aba Horários"
						className="hidden sm:flex items-center gap-1.5 text-2xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200/60 dark:border-blue-900/60">
						<Clock size={12} />
						<span>
							Horários da Loja (24h): {lojaHorariosConfig[1]?.abertura || "10:00"} às{" "}
							{lojaHorariosConfig[1]?.fechamento || "22:00"}
						</span>
					</div>
				</div>

				{/* Ações, Filtros e Alternador de Modo */}
				<div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-between xl:justify-end">
					{/* Alternador Lista / Grade Mês / Semana */}
					<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
						<button
							onClick={() => setViewType("lista")}
							className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
								viewType === "lista"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400"
							}`}>
							<List size={15} />
							<span>Lista</span>
						</button>
						<button
							onClick={() => setViewType("mes")}
							className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
								viewType === "mes"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400"
							}`}>
							<Grid size={15} />
							<span>Grade</span>
						</button>
						<button
							onClick={() => setViewType("semana")}
							className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
								viewType === "semana"
									? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400"
							}`}>
							<Columns size={15} />
							<span>Semana</span>
						</button>
					</div>

					{/* Filtro por Colaborador */}
					<div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
						<Filter size={15} className="text-slate-400" />
						<select
							value={selectedEmployeeFilter}
							onChange={(e) => setSelectedEmployeeFilter(e.target.value)}
							aria-label="Filtrar por colaborador na escala"
							className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer">
							<option value="todos">Todos Colaboradores</option>
							{funcionarios.map((f) => (
								<option key={f.id} value={f.id}>
									{f.apelido || f.nome}
								</option>
							))}
						</select>
					</div>

					{/* BOTÃO PRINCIPAL: GERAR ESCALA MENSAL (12x36 ou 6x1) */}
					<button
						onClick={openAutoModal}
						className="cursor-pointer px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 text-xs shrink-0">
						<Sparkles size={16} />
						<span>Gerar Escala Mensal</span>
					</button>

					{/* Botão Secundário: Adicionar Dia Avulso */}
					<button
						onClick={() => openCreateModal()}
						title="Inserir um dia pontual avulso"
						className="cursor-pointer px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 text-xs shrink-0">
						<Plus size={15} />
						<span>Dia Avulso</span>
					</button>
				</div>
			</div>

			{/* ========================================================= */}
			{/* VISÃO 1: LISTA DOS DIAS DO MÊS COM LINHA DO TEMPO NO EIXO X */}
			{/* ========================================================= */}
			{viewType === "lista" && (
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
					{/* Cabeçalho da Régua Temporal */}
					<div className="overflow-x-auto border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80">
						<div className="min-w-[700px] lg:min-w-0 w-full flex items-center">
							<div className="w-36 sm:w-44 shrink-0 px-4 py-3 text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-700">
								Dia do Mês
							</div>
							<div className="flex-1 relative h-10 flex items-center pr-2">
								{storeWeekRange.hours.map((hour, idx) => {
									const leftPercent =
										((hour - storeWeekRange.minH) /
											(storeWeekRange.maxH - storeWeekRange.minH)) *
										100;
									return (
										<div
											key={hour}
											style={{ left: `${leftPercent}%` }}
											className="absolute -translate-x-1/2 flex flex-col items-center">
											<span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
												{String(hour).padStart(2, "0")}:00
											</span>
											<span className="w-px h-2 bg-slate-300 dark:bg-slate-600 mt-0.5" />
										</div>
									);
								})}
							</div>
						</div>
					</div>

					{/* Linhas dos Dias do Mês com bordas e divisões bem definidas */}
					<div className="overflow-x-auto divide-y divide-slate-200 dark:divide-slate-800">
						<div className="min-w-[700px] lg:min-w-0 w-full">
							{monthDays.map((cell) => {
								const dayEscalas = escalasByDate[cell.dateStr] || [];
								const diaConfig = lojaHorariosConfig[cell.dayOfWeek] || {
									ativo: true,
									abertura: "10:00",
									fechamento: "22:00",
								};
								const isLojaAberta = diaConfig.ativo;
								const { folgas, positioned } = computeDayLayout(
									dayEscalas,
									diaConfig.abertura || "10:00",
									diaConfig.fechamento || "22:00"
								);
								const isWeekend = cell.dayOfWeek === 0 || cell.dayOfWeek === 6;

								// Calcula a altura da linha baseado na quantidade de faixas sobrepostas
								const maxConcurrentTracks = positioned.reduce(
									(acc, p) => Math.max(acc, p.totalCols),
									1
								);
								const rowMinHeight = Math.max(56, maxConcurrentTracks * 38 + 16);

								return (
									<div
										key={cell.dateStr}
										onClick={() => openCreateModal(cell.dateStr)}
										className={`flex items-stretch transition-colors group cursor-pointer border-b border-slate-200/90 dark:border-slate-800 last:border-b-0 ${
											cell.isToday
												? "bg-blue-50/30 dark:bg-blue-950/25"
												: isWeekend
												? "bg-slate-50/50 dark:bg-slate-900/50 hover:bg-blue-50/20 dark:hover:bg-slate-800/40"
												: "hover:bg-blue-50/20 dark:hover:bg-slate-800/30"
										}`}>
										{/* Coluna Fixa do Dia (Eixo Y) */}
										<div className="w-36 sm:w-44 shrink-0 px-3 py-2.5 flex items-center justify-between border-r border-slate-200 dark:border-slate-800 bg-inherit select-none">
											<div className="flex items-center gap-2">
												<span
													className={`text-xs font-black rounded-lg w-7 h-7 flex items-center justify-center shrink-0 ${
														cell.isToday
															? "bg-blue-600 text-white shadow-sm"
															: isWeekend
															? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-black"
															: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
													}`}>
													{cell.dayNum}
												</span>
												<div className="min-w-0">
													<div className="flex items-center gap-1">
														<span
															className={`text-xs font-bold leading-tight ${
																isWeekend
																	? "text-amber-600 dark:text-amber-400 font-black"
																	: "text-slate-700 dark:text-slate-300"
															}`}>
															{DIAS_SEMANA[cell.dayOfWeek === 0 ? 6 : cell.dayOfWeek - 1]}
														</span>
													</div>
													<div className="text-[10px] font-mono text-slate-400 leading-tight">
														{isLojaAberta ? (
															<span>
																{diaConfig.abertura}-{diaConfig.fechamento}
															</span>
														) : (
															<span className="text-rose-500 font-bold">Fechada</span>
														)}
													</div>
												</div>
											</div>

											{/* Botão de adicionar e badge de contagem */}
											<div className="flex items-center gap-1">
												{dayEscalas.length > 0 && (
													<span
														title={`${dayEscalas.length} colaboradores agendados`}
														className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
														{dayEscalas.length}
													</span>
												)}
												<button
													onClick={(e) => {
														e.stopPropagation();
														openCreateModal(cell.dateStr);
													}}
													title="Adicionar escala neste dia"
													className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-md text-blue-600 dark:text-blue-400 transition-opacity">
													<Plus size={14} />
												</button>
											</div>
										</div>

										{/* Linha do Tempo no Eixo X */}
										<div
											style={{ minHeight: `${rowMinHeight}px` }}
											className="flex-1 relative py-1.5 px-1 bg-inherit">
											{/* Marcadores Verticais das Horas (Régua de Fundo) */}
											{storeWeekRange.hours.map((hour) => {
												const leftPercent =
													((hour - storeWeekRange.minH) /
														(storeWeekRange.maxH - storeWeekRange.minH)) *
													100;
												return (
													<div
														key={hour}
														style={{ left: `${leftPercent}%` }}
														className="absolute top-0 bottom-0 border-l border-slate-200/80 dark:border-slate-800 pointer-events-none"
													/>
												);
											})}

											{/* Badges de Folga */}
											{folgas.length > 0 && (
												<div className="absolute top-1 right-2 z-10 flex items-center gap-1 max-w-[200px] overflow-x-auto no-scrollbar pointer-events-auto">
													{folgas.map((f) => (
														<span
															key={f.id}
															onClick={(e) => openEditModal(f, e)}
															title={`Folga: ${f.funcionarioNome} (Clique para alterar)`}
															className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300/70 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold truncate hover:bg-slate-300 transition-colors">
															🌴 {f.funcionarioNome}
														</span>
													))}
												</div>
											)}

											{/* Blocos de Turnos no Eixo X */}
											{positioned.map(
												({ item, startMin, endMin, colIndex, totalCols, hasOverlap }) => {
													// Converte os minutos para percentual horizontal dentro dos limites visíveis da loja
													const visibleMin = storeWeekRange.minH * 60;
													const visibleMax = storeWeekRange.maxH * 60;
													const totalVisibleMin = Math.max(60, visibleMax - visibleMin);

													const clampedStart = Math.max(visibleMin, Math.min(visibleMax, startMin));
													const clampedEnd = Math.max(clampedStart + 30, Math.min(visibleMax, endMin));

													const leftPercent = Math.max(
														0,
														Math.min(100, ((clampedStart - visibleMin) / totalVisibleMin) * 100)
													);
													const rightPercent = Math.max(
														0,
														Math.min(100, ((clampedEnd - visibleMin) / totalVisibleMin) * 100)
													);
													const widthPercent = Math.max(3, rightPercent - leftPercent);

													// Posicionamento vertical para sobreposições (lanes/faixas)
													const trackHeight = 32;
													const topOffset = 6 + colIndex * (trackHeight + 4);

													return (
														<div
															key={item.id}
															onClick={(e) => openEditModal(item, e)}
															style={{
																left: `${leftPercent}%`,
																width: `${widthPercent}%`,
																top: `${topOffset}px`,
																height: `${trackHeight}px`,
															}}
															title={`${item.funcionarioNome} (${item.horarioInicio || diaConfig.abertura} - ${
																item.horarioFim || diaConfig.fechamento
															})${hasOverlap ? " [Sobreposição]" : ""}${
																item.observacoes ? " - " + item.observacoes : ""
															}\n(Clique para alterar este dia pontual)`}
															className="absolute rounded-lg border border-blue-300 dark:border-blue-700/60 bg-blue-50/95 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-900 dark:text-blue-200 shadow-xs px-2 flex items-center justify-between gap-1 overflow-hidden transition-all hover:z-30 hover:shadow-md cursor-pointer select-none">
															<div className="flex items-center gap-1.5 min-w-0 truncate">
																<span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-600 dark:bg-blue-400" />
																<span className="text-[11px] font-black truncate leading-none">
																	{item.funcionarioNome}
																</span>
																<span className="text-[10px] font-semibold opacity-75 truncate leading-none hidden sm:inline">
																	• {item.funcionarioCargo || "Colaborador"}
																</span>
															</div>

															<div className="flex items-center gap-1 shrink-0">
																{hasOverlap && (
																	<span
																		title="Turno com sobreposição"
																		className="text-amber-500 text-[10px]">
																		●
																	</span>
																)}
																<span className="text-[10px] font-mono font-bold bg-white/70 dark:bg-slate-900/70 px-1 py-0.5 rounded leading-none">
																	{item.horarioInicio} - {item.horarioFim}
																</span>
															</div>
														</div>
													);
												}
											)}

											{/* Feedback visual quando o dia não tem escalas */}
											{dayEscalas.length === 0 && (
												<div className="h-full flex items-center justify-center text-2xs font-medium text-slate-400/70 select-none pointer-events-none py-2">
													Sem colaboradores escalados!
												</div>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* ========================================================= */}
			{/* VISÃO 2: GRADE MENSAL (CALENDÁRIO TRADICIONAL)            */}
			{/* ========================================================= */}
			{viewType === "mes" && (
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
					{/* Cabeçalho dos Dias da Semana */}
					<div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-center text-xs font-black text-slate-600 dark:text-slate-400 py-3">
						{DIAS_SEMANA.map((dia, idx) => (
							<div
								key={dia}
								className={idx === 5 || idx === 6 ? "text-amber-600 dark:text-amber-400" : ""}>
								{dia}
							</div>
						))}
					</div>

					{/* Grade dos Dias do Mês */}
					<div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
						{calendarDays.map((cell, idx) => {
							const dayEscalas = escalasByDate[cell.dateStr] || [];

							// Horário configurado para esta loja neste dia específico da semana
							const diaConfig = lojaHorariosConfig[cell.dayOfWeek] || {
								ativo: true,
								abertura: "10:00",
								fechamento: "22:00",
							};

							const isLojaAberta = diaConfig.ativo;
							const { folgas, positioned } = computeDayLayout(
								dayEscalas,
								diaConfig.abertura || "10:00",
								diaConfig.fechamento || "22:00"
							);

							return (
								<div
									key={idx}
									onClick={() => cell.isCurrentMonth && openCreateModal(cell.dateStr)}
									className={`min-h-[220px] p-2 flex flex-col justify-between transition-colors relative group ${
										!cell.isCurrentMonth
											? "bg-slate-50/40 dark:bg-slate-950/40 text-slate-300 dark:text-slate-700 opacity-60"
											: "hover:bg-blue-50/20 dark:hover:bg-slate-800/30 cursor-pointer"
									} ${cell.isToday ? "ring-2 ring-blue-500 ring-inset bg-blue-50/10" : ""}`}>
									{/* Topo do Dia */}
									<div className="flex items-center justify-between shrink-0 mb-1">
										<div className="flex items-center gap-1.5">
											<span
												className={`text-xs font-bold rounded-lg w-6 h-6 flex items-center justify-center ${
													cell.isToday
														? "bg-blue-600 text-white shadow-sm font-black"
														: cell.isCurrentMonth
														? "text-slate-700 dark:text-slate-300 font-black"
														: "text-slate-400 dark:text-slate-600"
												}`}>
												{cell.dayNum}
											</span>

											{/* Indicador de Horário de Abertura da Loja neste Dia */}
											{isLojaAberta ? (
												<span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">
													{diaConfig.abertura}-{diaConfig.fechamento}
												</span>
											) : (
												<span className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-1 rounded">
													Fechada
												</span>
											)}
										</div>

										{/* Badges de Folga no Topo */}
										{folgas.length > 0 && (
											<div className="flex items-center gap-1 overflow-x-auto max-w-[100px] no-scrollbar">
												{folgas.map((f) => (
													<span
														key={f.id}
														onClick={(e) => openEditModal(f, e)}
														title={`Folga: ${f.funcionarioNome} (Clique para editar/remover este dia)`}
														className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold truncate hover:bg-slate-200">
														🌴 {f.funcionarioNome}
													</span>
												))}
											</div>
										)}

										{cell.isCurrentMonth && (
											<button
												onClick={(e) => {
													e.stopPropagation();
													openCreateModal(cell.dateStr);
												}}
												className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-slate-700 rounded-md text-blue-600 dark:text-blue-400 transition-opacity">
												<Plus size={14} />
											</button>
										)}
									</div>

									{/* TIMELINE DO DIA REFLETINDO OS LIMITES DE HORÁRIO DA LOJA */}
									<div
										className="relative flex-1 w-full rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 overflow-hidden min-h-[160px]"
										title={`Clique para agendar escala neste dia (${diaConfig.abertura} às ${diaConfig.fechamento})`}>
										{/* Linha Central Guia de Fundo */}
										<div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-slate-200/50 dark:border-slate-700/40 pointer-events-none" />

										{/* Cards de Escala Posicionados Proporcionalmente */}
										{positioned.map(
											({ item, topPercent, heightPercent, colIndex, totalCols, hasOverlap }) => {
												const widthPercent = 100 / totalCols;
												const leftPercent = colIndex * widthPercent;

												return (
													<div
														key={item.id}
														onClick={(e) => openEditModal(item, e)}
														style={{
															top: `${topPercent}%`,
															height: `${heightPercent}%`,
															left: `calc(${leftPercent}% + 1px)`,
															width: `calc(${widthPercent}% - 2px)`,
														}}
														title={`${item.funcionarioNome} (${item.horarioInicio || diaConfig.abertura} - ${
															item.horarioFim || diaConfig.fechamento
														})${hasOverlap ? " [Sobreposição]" : ""}${
															item.observacoes ? " - " + item.observacoes : ""
														}\n(Clique para alterar este dia pontual)`}
														className="absolute rounded-lg border border-blue-300 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 shadow-xs px-1.5 py-1 flex flex-col justify-start overflow-hidden transition-all hover:z-20 hover:scale-[1.02] hover:shadow-md cursor-pointer select-none">
														{/* Cabeçalho do Card */}
														<div className="flex items-center justify-between gap-1 w-full min-w-0">
															<div className="flex items-center gap-1 min-w-0 truncate">
																<span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-600 dark:bg-blue-400" />
																<span className="text-[11px] font-black truncate leading-tight">
																	{item.funcionarioNome}
																</span>
															</div>
															{hasOverlap && (
																<span
																	title="Horário com sobreposição"
																	className="shrink-0 text-amber-500 text-[9px]">
																	●
																</span>
															)}
														</div>

														{/* Horário Formatado */}
														<span className="text-[10px] font-bold opacity-90 truncate leading-tight mt-0.5">
															{item.horarioInicio} - {item.horarioFim}
														</span>

														{/* Observação / Cargo */}
														{heightPercent >= 30 && (
															<span className="text-[9px] font-medium opacity-75 truncate leading-tight mt-auto">
																{item.observacoes || item.funcionarioCargo}
															</span>
														)}
													</div>
												);
											}
										)}
									</div>

									{/* Rodapé do Dia: Contagem de Colaboradores */}
									<div className="text-[10px] text-slate-400 font-bold text-right mt-1">
										{dayEscalas.length > 0
											? `${dayEscalas.length} ${dayEscalas.length === 1 ? "escala" : "escalas"}`
											: ""}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* ========================================================= */}
			{/* VISÃO 2: VISÃO SEMANAL DETALHADA COM RÉGUA DA LOJA        */}
			{/* ========================================================= */}
			{viewType === "semana" && (
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-4">
					{/* Seletor de Semanas do Mês (Apenas Semanas do Mês Selecionado) */}
					<div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
						<span className="text-xs font-bold text-slate-600 dark:text-slate-400">
							Selecione a semana de {MESES[mes - 1]}:
						</span>
						<div className="flex gap-1.5 overflow-x-auto">
							{weeks.map((wk, idx) => {
								const currentMonthDaysInWeek = wk.filter((d) => d.isCurrentMonth);
								const first = currentMonthDaysInWeek[0] || wk[0];
								const last = currentMonthDaysInWeek[currentMonthDaysInWeek.length - 1] || wk[6];
								const isSelected = safeWeekIndex === idx;

								return (
									<button
										key={idx}
										onClick={() => setSelectedWeekIndex(idx)}
										className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
											isSelected
												? "bg-blue-600 text-white shadow-sm font-black"
												: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
										}`}>
										Semana {idx + 1} ({first.dayNum}/{first.dateStr.split("-")[1]} a {last.dayNum}/
										{last.dateStr.split("-")[1]})
									</button>
								);
							})}
						</div>
					</div>

					{/* Container com Régua Horária e 7 Colunas de Dias */}
					<div className="overflow-x-auto">
						<div className="min-w-[850px]">
							{/* Cabeçalho dos 7 Dias da Semana Selecionada */}
							<div className="grid grid-cols-[65px_repeat(7,1fr)] border-b border-slate-200 dark:border-slate-800 pb-3 text-center">
								<div className="text-2xs font-bold text-slate-400 pt-1">HORA</div>
								{weeks[safeWeekIndex]?.map((day, idx) => {
									const diaConfig = lojaHorariosConfig[day.dayOfWeek] || {
										ativo: true,
										abertura: "10:00",
										fechamento: "22:00",
									};

									return (
										<div
											key={idx}
											className={`space-y-1 ${
												!day.isCurrentMonth ? "opacity-35 select-none" : ""
											}`}>
											<span className="text-2xs font-bold text-slate-500 uppercase">
												{DIAS_SEMANA[idx]}
											</span>
											<div className="flex items-center justify-center gap-1">
												<span
													className={`text-sm font-black w-7 h-7 rounded-full flex items-center justify-center ${
														day.isToday
															? "bg-blue-600 text-white shadow-sm"
															: day.isCurrentMonth
															? "text-slate-800 dark:text-slate-200"
															: "text-slate-400 dark:text-slate-600"
													}`}>
													{day.dayNum}
												</span>
											</div>
											<span className="text-[10px] font-mono text-slate-400 block">
												{diaConfig.ativo
													? `${diaConfig.abertura}-${diaConfig.fechamento}`
													: "Fechada"}
											</span>
										</div>
									);
								})}
							</div>

							{/* Corpo com Grid Horário Dinâmico da Loja */}
							<div className="grid grid-cols-[65px_repeat(7,1fr)] relative h-[600px] divide-x divide-slate-100 dark:divide-slate-800">
								{/* Coluna da Esquerda: Régua com as Horas */}
								<div className="relative border-r border-slate-200 dark:border-slate-800 select-none">
									{storeWeekRange.hours.map((hour) => {
										const topPercent =
											((hour - storeWeekRange.minH) /
												(storeWeekRange.maxH - storeWeekRange.minH)) *
											100;
										return (
											<div
												key={hour}
												style={{ top: `${topPercent}%` }}
												className="absolute right-2 -translate-y-1/2 text-2xs font-bold font-mono text-slate-400 dark:text-slate-500">
												{String(hour).padStart(2, "0")}:00
											</div>
										);
									})}
								</div>

								{/* Colunas dos 7 Dias */}
								{weeks[safeWeekIndex]?.map((day, dIdx) => {
									const dayEscalas = escalasByDate[day.dateStr] || [];
									const diaConfig = lojaHorariosConfig[day.dayOfWeek] || {
										ativo: true,
										abertura: "10:00",
										fechamento: "22:00",
									};

									const { folgas, positioned } = computeDayLayout(
										dayEscalas,
										diaConfig.abertura || "10:00",
										diaConfig.fechamento || "22:00"
									);

									return (
										<div
											key={dIdx}
											onClick={() => day.isCurrentMonth && openCreateModal(day.dateStr)}
											className={`relative h-full transition-colors ${
												!day.isCurrentMonth
													? "bg-slate-100/50 dark:bg-slate-950/60 opacity-35 cursor-not-allowed select-none"
													: "hover:bg-blue-50/10 cursor-pointer"
											}`}>
											{/* Linhas Horárias Horizontais */}
											{storeWeekRange.hours.map((hour) => {
												const topPercent =
													((hour - storeWeekRange.minH) /
														(storeWeekRange.maxH - storeWeekRange.minH)) *
													100;
												return (
													<div
														key={hour}
														style={{ top: `${topPercent}%` }}
														className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-800/80 pointer-events-none"
													/>
												);
											})}

											{/* Folgas */}
											{folgas.length > 0 && (
												<div className="absolute top-1 left-1 right-1 z-10 flex flex-col gap-1">
													{folgas.map((f) => (
														<span
															key={f.id}
															onClick={(e) => {
																if (!day.isCurrentMonth) return;
																openEditModal(f, e);
															}}
															className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold truncate">
															🌴 {f.funcionarioNome} (Folga)
														</span>
													))}
												</div>
											)}

											{/* Cards Proporcionais de Escala */}
											{positioned.map(
												({ item, topPercent, heightPercent, colIndex, totalCols, hasOverlap }) => {
													const widthPercent = 100 / totalCols;
													const leftPercent = colIndex * widthPercent;

													return (
														<div
															key={item.id}
															onClick={(e) => {
																if (!day.isCurrentMonth) return;
																openEditModal(item, e);
															}}
															style={{
																top: `${topPercent}%`,
																height: `${heightPercent}%`,
																left: `calc(${leftPercent}% + 2px)`,
																width: `calc(${widthPercent}% - 4px)`,
															}}
															className={`absolute rounded-xl border border-blue-300 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 p-2 shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:z-30 hover:scale-[1.01] hover:shadow-lg ${
																day.isCurrentMonth ? "cursor-pointer" : "cursor-not-allowed"
															}`}>
															<div className="min-w-0">
																<div className="flex items-center justify-between gap-1">
																	<span className="font-black text-xs truncate">
																		{item.funcionarioNome}
																	</span>
																	{hasOverlap && (
																		<span
																			title="Sobreposição de horário"
																			className="text-amber-500 shrink-0">
																			<AlertTriangle size={12} />
																		</span>
																	)}
																</div>
																<span className="text-[10px] font-semibold opacity-85 block truncate">
																	{item.funcionarioCargo || "Colaborador"}
																</span>
															</div>

															<div className="pt-1 border-t border-current/10 flex items-center justify-between text-2xs font-bold">
																<span>
																	{item.horarioInicio} - {item.horarioFim}
																</span>
															</div>
														</div>
													);
												}
											)}
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ================================================================= */}
			{/* MODAL 1: GERADOR AUTOMÁTICO DE ESCALA MENSAL (12x36 ou 6x1)       */}
			{/* ================================================================= */}
			{isAutoModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
						{/* Cabeçalho */}
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
							<div className="flex items-center gap-2.5">
								<div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl">
									<Sparkles size={18} />
								</div>
								<div>
									<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
										Gerar Escala Mensal
									</h3>
									<p className="text-xs text-slate-500 dark:text-slate-400">
										{STORE_NAMES[selectedLoja]} • {MESES[mes - 1]} {ano}
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsAutoModalOpen(false)}
								className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
								<X size={18} />
							</button>
						</div>

						{/* Formulário */}
						<form onSubmit={handleAutoSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
							{/* Seleção do Colaborador */}
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Colaborador *
								</label>
								<select
									required
									value={autoFormData.funcionarioId}
									onChange={(e) =>
										setAutoFormData({ ...autoFormData, funcionarioId: e.target.value })
									}
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
									<option value="">Selecione um funcionário...</option>
									{funcionarios.map((f) => (
										<option key={f.id} value={f.id}>
											{f.nome} {f.apelido ? `(${f.apelido})` : ""} - {f.cargo}
										</option>
									))}
								</select>
							</div>

							{/* 1. Regime de Escala: 12x36 ou 6x1 */}
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									1. Regime de Escala *
								</label>
								<div className="grid grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() => handleRegimeChange("12x36")}
										className={`cursor-pointer p-3 rounded-2xl border text-left transition-all ${
											autoFormData.regime === "12x36"
												? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-500"
												: "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
										}`}>
										<div className="flex items-center justify-between mb-1">
											<span className="font-black text-sm text-slate-900 dark:text-slate-100">
												12x36
											</span>
											{autoFormData.regime === "12x36" && (
												<Check size={16} className="text-blue-600" />
											)}
										</div>
										<p className="text-2xs text-slate-500 dark:text-slate-400 leading-snug">
											Dias alternados (12 horas por dia trabalhado)
										</p>
									</button>

									<button
										type="button"
										onClick={() => handleRegimeChange("6x1")}
										className={`cursor-pointer p-3 rounded-2xl border text-left transition-all ${
											autoFormData.regime === "6x1"
												? "border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-500"
												: "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
										}`}>
										<div className="flex items-center justify-between mb-1">
											<span className="font-black text-sm text-slate-900 dark:text-slate-100">
												6x1
											</span>
											{autoFormData.regime === "6x1" && (
												<Check size={16} className="text-blue-600" />
											)}
										</div>
										<p className="text-2xs text-slate-500 dark:text-slate-400 leading-snug">
											1 descanso semanal (9 horas contínuas por dia)
										</p>
									</button>
								</div>
							</div>

							{/* 2. Horário / Período Diário */}
							<div>
								<div className="flex items-center justify-between mb-1.5">
									<label className="text-xs font-bold text-slate-700 dark:text-slate-300">
										2. Horário Diário ({autoFormData.regime === "12x36" ? "12h" : "9h"}) *
									</label>
									<span className="text-2xs text-blue-600 dark:text-blue-400 font-semibold">
										{autoFormData.regime === "12x36"
											? "12 horas por turno"
											: "9 horas contínuas (foco em 9h)"}
									</span>
								</div>

								{/* Presets Rápidos Baseados no Funcionamento da Loja */}
								<div className="flex flex-wrap gap-1.5 mb-2.5">
									{autoFormData.regime === "12x36" ? (
										<>
											<button
												type="button"
												onClick={() =>
													setAutoFormData((prev) => ({
														...prev,
														horarioInicio: defaultStoreHours.abertura,
														horarioFim: calculateEndTime(defaultStoreHours.abertura, 12),
													}))
												}
												className="cursor-pointer px-2.5 py-1 rounded-lg text-2xs font-bold border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
												Horário da Loja ({defaultStoreHours.abertura} às{" "}
												{calculateEndTime(defaultStoreHours.abertura, 12)})
											</button>
											<button
												type="button"
												onClick={() =>
													setAutoFormData((prev) => ({
														...prev,
														horarioInicio: "09:00",
														horarioFim: "21:00",
													}))
												}
												className="cursor-pointer px-2.5 py-1 rounded-lg text-2xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
												09:00 às 21:00
											</button>
											<button
												type="button"
												onClick={() =>
													setAutoFormData((prev) => ({
														...prev,
														horarioInicio: "10:00",
														horarioFim: "22:00",
													}))
												}
												className="cursor-pointer px-2.5 py-1 rounded-lg text-2xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
												10:00 às 22:00
											</button>
										</>
									) : (
										<>
											<button
												type="button"
												onClick={() =>
													setAutoFormData((prev) => ({
														...prev,
														horarioInicio: defaultStoreHours.abertura,
														horarioFim: calculateEndTime(defaultStoreHours.abertura, 9),
													}))
												}
												className="cursor-pointer px-2.5 py-1 rounded-lg text-2xs font-bold border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
												Abertura Loja ({defaultStoreHours.abertura} às{" "}
												{calculateEndTime(defaultStoreHours.abertura, 9)})
											</button>
											<button
												type="button"
												onClick={() =>
													setAutoFormData((prev) => ({
														...prev,
														horarioInicio: "13:00",
														horarioFim: "22:00",
													}))
												}
												className="cursor-pointer px-2.5 py-1 rounded-lg text-2xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
												13:00 às 22:00 (9h)
											</button>
											<button
												type="button"
												onClick={() =>
													setAutoFormData((prev) => ({
														...prev,
														horarioInicio: "14:00",
														horarioFim: "23:00",
													}))
												}
												className="cursor-pointer px-2.5 py-1 rounded-lg text-2xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
												14:00 às 23:00 (9h)
											</button>
										</>
									)}
								</div>

								{/* Campos de Início e Fim (24h) */}
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="block text-2xs font-bold text-slate-500 mb-1">
											Horário Início
										</label>
										<TimeInput24h
											required
											value={autoFormData.horarioInicio}
											onChange={(val) => handleStartTimeChange(val)}
											className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
									<div>
										<label className="block text-2xs font-bold text-slate-500 mb-1">
											Horário Fim ({autoFormData.regime === "12x36" ? "+12h" : "+9h"})
										</label>
										<TimeInput24h
											required
											value={autoFormData.horarioFim}
											onChange={(val) =>
												setAutoFormData({ ...autoFormData, horarioFim: val })
											}
											className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
								</div>
							</div>

							{/* 3. Primeiro Dia de Trabalho no Mês */}
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									3. Primeiro Dia de Trabalho no Mês *
								</label>
								<input
									type="date"
									required
									value={autoFormData.primeiroDiaTrabalho}
									onChange={(e) =>
										setAutoFormData({ ...autoFormData, primeiroDiaTrabalho: e.target.value })
									}
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
								/>
								<span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
									{autoFormData.regime === "12x36"
										? "A app alternará trabalho e folga a partir desta data até o fim do mês."
										: "A app aplicará a jornada a partir desta data até o fim do mês, respeitando o descanso semanal."}
								</span>
							</div>

							{/* 4. Dia de Descanso Semanal (Obrigatório se 6x1) */}
							{autoFormData.regime === "6x1" && (
								<div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800/80 space-y-2">
									<label className="block text-xs font-black text-amber-900 dark:text-amber-200">
										4. Dia da Semana de Descanso (Folga Semanal) *
									</label>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
										{DIAS_DESCANSO.map((dia) => (
											<button
												key={dia.value}
												type="button"
												onClick={() =>
													setAutoFormData({ ...autoFormData, diaDescansoSemanal: dia.value })
												}
												className={`cursor-pointer px-2.5 py-2 rounded-xl text-2xs font-bold border transition-all text-center ${
													autoFormData.diaDescansoSemanal === dia.value
														? "bg-amber-600 text-white border-amber-600 shadow-xs font-black"
														: "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
												}`}>
												{dia.label}
											</button>
										))}
									</div>
								</div>
							)}

							{/* Box de Pré-visualização do Resumo */}
							{autoPreview && (
								<div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 rounded-2xl border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
									<Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
									<div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
										<p className="font-black">Resumo do Preenchimento:</p>
										<p>
											Serão gerados <strong>{autoPreview.workDays} dias de trabalho</strong> (
											{autoFormData.horarioInicio} às {autoFormData.horarioFim}) e{" "}
											<strong>{autoPreview.restDays} dias de descanso</strong> a partir do dia{" "}
											{autoPreview.startDay} até o fim de {MESES[mes - 1]}.
										</p>
										<p className="text-[11px] text-blue-700 dark:text-blue-300">
											💡 <em>Dica:</em> Após gerar, você poderá clicar em qualquer dia específico no
											calendário para editar horários ou excluir pontualmente sem alterar os demais dias.
										</p>
									</div>
								</div>
							)}

							{/* Botões do Rodapé */}
							<div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setIsAutoModalOpen(false)}
									className="cursor-pointer px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
									Cancelar
								</button>
								<button
									type="submit"
									disabled={isGeneratingAuto || !autoFormData.funcionarioId}
									className="cursor-pointer px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow transition-all flex items-center gap-2">
									<Sparkles size={16} />
									<span>
										{isGeneratingAuto ? "Preenchendo Mês..." : "Gerar e Preencher Escala"}
									</span>
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* ================================================================= */}
			{/* MODAL 2: AJUSTE PONTUAL DE DIA ESPECÍFICO (SEM SEÇÃO TURNO)       */}
			{/* ================================================================= */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
							<div className="flex items-center gap-2">
								<CalendarIcon className="text-blue-600 dark:text-blue-400" size={20} />
								<div>
									<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
										{editingEscala ? "Ajuste Pontual de Escala" : "Adicionar Escala Avulsa"}
									</h3>
									<p className="text-2xs text-slate-400">
										{editingEscala
											? "Altere apenas este dia específico sem afetar o resto do mês"
											: "Cadastre um dia avulso na escala"}
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsModalOpen(false)}
								className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
								<X size={18} />
							</button>
						</div>

						<form onSubmit={handleSubmit} className="p-6 space-y-4">
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Loja
								</label>
								<div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm">
									<Store size={16} className="text-blue-600 dark:text-blue-400" />
									<span>{STORE_NAMES[selectedLoja]}</span>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Colaborador *
								</label>
								<select
									required
									value={formData.funcionarioId}
									onChange={(e) => setFormData({ ...formData, funcionarioId: e.target.value })}
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
									<option value="">Selecione um funcionário...</option>
									{funcionarios.map((f) => (
										<option key={f.id} value={f.id}>
											{f.nome} {f.apelido ? `(${f.apelido})` : ""} - {f.cargo}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Data da Escala *
								</label>
								<input
									type="date"
									required
									value={formData.data}
									onChange={(e) => setFormData({ ...formData, data: e.target.value })}
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							{/* Opção Simples: Dia de Folga ou Trabalho */}
							<div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
								<label className="flex items-center gap-2 cursor-pointer select-none">
									<input
										type="checkbox"
										checked={formData.isFolga}
										onChange={(e) => setFormData({ ...formData, isFolga: e.target.checked })}
										className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
									/>
									<span className="text-xs font-bold text-slate-700 dark:text-slate-300">
										🌴 Marcar como Dia de Folga / Descanso
									</span>
								</label>
								{formData.isFolga && (
									<span className="text-2xs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
										Sem horário
									</span>
								)}
							</div>

							{/* Horários Início e Fim (Somente se não for Folga) */}
							{!formData.isFolga && (
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="text-xs font-bold text-slate-700 dark:text-slate-300">
											Horário de Trabalho
										</label>
										<button
											type="button"
											onClick={() =>
												setFormData((prev) => ({
													...prev,
													horarioInicio: defaultStoreHours.abertura,
													horarioFim: defaultStoreHours.fechamento,
												}))
											}
											className="cursor-pointer text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
											Puxar horário da loja ({defaultStoreHours.abertura} às{" "}
											{defaultStoreHours.fechamento})
										</button>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-2xs font-bold text-slate-500 mb-1">
												Horário Início
											</label>
											<TimeInput24h
												required={!formData.isFolga}
												value={formData.horarioInicio}
												onChange={(val) =>
													setFormData({ ...formData, horarioInicio: val })
												}
												className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>
										<div>
											<label className="block text-2xs font-bold text-slate-500 mb-1">
												Horário Fim
											</label>
											<TimeInput24h
												required={!formData.isFolga}
												value={formData.horarioFim}
												onChange={(val) => setFormData({ ...formData, horarioFim: val })}
												className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
										</div>
									</div>
								</div>
							)}

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Observações (opcional)
								</label>
								<input
									type="text"
									value={formData.observacoes}
									onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
									placeholder="Ex: Troca pontual, cobertura de plantão..."
									className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
								{editingEscala ? (
									<button
										type="button"
										onClick={handleDelete}
										disabled={isSaving}
										className="cursor-pointer px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors">
										<Trash2 size={16} />
										<span>Excluir Dia</span>
									</button>
								) : (
									<div />
								)}

								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setIsModalOpen(false)}
										className="cursor-pointer px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
										Cancelar
									</button>
									<button
										type="submit"
										disabled={isSaving}
										className="cursor-pointer px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm transition-all">
										{isSaving ? "Salvando..." : editingEscala ? "Atualizar Dia" : "Confirmar"}
									</button>
								</div>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
