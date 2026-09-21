"use client";

import { useState, useMemo } from "react";
import { EscalaItem, Funcionario, TURNO_CONFIG, TurnoTipo } from "@/types/funcionarios";
import { STORE_NAMES, StoreId } from "@/types";
import {
	createEscala,
	updateEscala,
	deleteEscala,
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
} from "lucide-react";

interface EscalaTabProps {
	escalas: EscalaItem[];
	funcionarios: Funcionario[];
	selectedLoja: StoreId;
	onSelectLoja: (loja: StoreId) => void;
	mesAnoStr: string; // YYYY-MM
	onChangeMesAno: (novoMesAno: string) => void;
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

export default function EscalaTab({
	escalas,
	funcionarios,
	selectedLoja,
	onSelectLoja,
	mesAnoStr,
	onChangeMesAno,
}: EscalaTabProps) {
	const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("todos");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingEscala, setEditingEscala] = useState<EscalaItem | null>(null);
	const [selectedDateForNew, setSelectedDateForNew] = useState<string>("");
	const [isSaving, setIsSaving] = useState(false);

	// Form de Escala
	const [formData, setFormData] = useState({
		funcionarioId: "",
		data: "",
		turno: "abertura" as TurnoTipo,
		horarioInicio: "09:00",
		horarioFim: "17:00",
		observacoes: "",
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
	};

	const handleNextMonth = () => {
		let novoAno = ano;
		let novoMes = mes + 1;
		if (novoMes > 12) {
			novoMes = 1;
			novoAno++;
		}
		onChangeMesAno(`${novoAno}-${String(novoMes).padStart(2, "0")}`);
	};

	const handleCurrentMonth = () => {
		const now = new Date();
		const currentStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		onChangeMesAno(currentStr);
	};

	// Cálculo da grade do calendário
	const calendarDays = useMemo(() => {
		const firstDayOfMonth = new Date(ano, mes - 1, 1);
		const lastDayOfMonth = new Date(ano, mes, 0);
		const daysInMonth = lastDayOfMonth.getDate();

		// Dia da semana do 1º dia (0 = Domingo, 1 = Segunda, etc.)
		// Queremos começar na Segunda-feira (índice 0)
		let startDayOfWeek = firstDayOfMonth.getDay() - 1;
		if (startDayOfWeek === -1) startDayOfWeek = 6; // Domingo vira 6

		const days: {
			dayNum: number | null;
			dateStr: string;
			isCurrentMonth: boolean;
			isToday: boolean;
		}[] = [];

		// Dias do mês anterior para preencher
		const prevMonthLastDay = new Date(ano, mes - 1, 0).getDate();
		for (let i = startDayOfWeek - 1; i >= 0; i--) {
			const dayVal = prevMonthLastDay - i;
			const prevMonth = mes === 1 ? 12 : mes - 1;
			const prevYear = mes === 1 ? ano - 1 : ano;
			days.push({
				dayNum: dayVal,
				dateStr: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(dayVal).padStart(2, "0")}`,
				isCurrentMonth: false,
				isToday: false,
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
			});
		}

		// Completar dias da última semana
		const remaining = 7 - (days.length % 7);
		if (remaining < 7) {
			const nextMonth = mes === 12 ? 1 : mes + 1;
			const nextYear = mes === 12 ? ano + 1 : ano;
			for (let i = 1; i <= remaining; i++) {
				days.push({
					dayNum: i,
					dateStr: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`,
					isCurrentMonth: false,
					isToday: false,
				});
			}
		}

		return days;
	}, [ano, mes]);

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

	// Ações do Modal
	const openCreateModal = (dateStr?: string) => {
		setEditingEscala(null);
		const defaultDate = dateStr || `${mesAnoStr}-01`;
		setSelectedDateForNew(defaultDate);
		const defaultFunc = funcionarios.find((f) => f.status === "ativo")?.id || "";
		const defaultTurno: TurnoTipo = "abertura";
		const config = TURNO_CONFIG[defaultTurno];

		setFormData({
			funcionarioId: defaultFunc,
			data: defaultDate,
			turno: defaultTurno,
			horarioInicio: config.defaultInicio,
			horarioFim: config.defaultFim,
			observacoes: "",
		});
		setIsModalOpen(true);
	};

	const openEditModal = (escala: EscalaItem, e: React.MouseEvent) => {
		e.stopPropagation();
		setEditingEscala(escala);
		setFormData({
			funcionarioId: escala.funcionarioId,
			data: escala.data,
			turno: escala.turno,
			horarioInicio: escala.horarioInicio || "",
			horarioFim: escala.horarioFim || "",
			observacoes: escala.observacoes || "",
		});
		setIsModalOpen(true);
	};

	const handleTurnoChange = (newTurno: TurnoTipo) => {
		const config = TURNO_CONFIG[newTurno];
		setFormData((prev) => ({
			...prev,
			turno: newTurno,
			horarioInicio: config.defaultInicio,
			horarioFim: config.defaultFim,
		}));
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
				turno: formData.turno,
				horarioInicio: formData.horarioInicio || undefined,
				horarioFim: formData.horarioFim || undefined,
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
			alert("Ocorreu um erro ao salvar a escala.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!editingEscala) return;
		if (!confirm("Tem certeza que deseja remover esta escala?")) return;

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
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
				{/* Seletor do Mês/Ano */}
				<div className="flex items-center gap-2">
					<button
						onClick={handlePrevMonth}
						aria-label="Mês anterior"
						className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
						<ChevronLeft size={20} />
					</button>

					<div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
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
						className="cursor-pointer ml-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-3 py-1.5 rounded-lg transition-colors">
						Mês Atual
					</button>
				</div>

				{/* Legenda de Turnos */}
				<div className="hidden lg:flex items-center gap-2 text-2xs font-semibold text-slate-600 dark:text-slate-400">
					{Object.entries(TURNO_CONFIG).map(([key, conf]) => (
						<span
							key={key}
							className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${conf.badgeBg} ${conf.badgeText}`}>
							<span
								className="w-1.5 h-1.5 rounded-full"
								style={{ backgroundColor: conf.color }}
							/>
							{conf.label}
						</span>
					))}
				</div>

				{/* Filtro por Colaborador e Botão Nova Escala */}
				<div className="flex items-center gap-3 w-full md:w-auto">
					<div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 md:flex-none">
						<Filter size={16} className="text-slate-400" />
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

					<button
						onClick={() => openCreateModal()}
						className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 text-sm shrink-0">
						<Plus size={18} />
						<span>Adicionar Escala</span>
					</button>
				</div>
			</div>

			{/* GRADE DO CALENDÁRIO */}
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

				{/* Células dos Dias */}
				<div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
					{calendarDays.map((cell, idx) => {
						const dayEscalas = escalasByDate[cell.dateStr] || [];

						return (
							<div
								key={idx}
								onClick={() => cell.isCurrentMonth && openCreateModal(cell.dateStr)}
								className={`min-h-[115px] p-2 flex flex-col justify-between transition-colors relative group ${
									!cell.isCurrentMonth
										? "bg-slate-50/50 dark:bg-slate-950/40 text-slate-300 dark:text-slate-700 opacity-60"
										: "hover:bg-blue-50/30 dark:hover:bg-slate-800/40 cursor-pointer"
								} ${cell.isToday ? "ring-2 ring-blue-500 ring-inset bg-blue-50/10" : ""}`}>
								{/* Topo do Dia */}
								<div className="flex items-center justify-between">
									<span
										className={`text-xs font-bold rounded-lg w-6 h-6 flex items-center justify-center ${
											cell.isToday
												? "bg-blue-600 text-white shadow-sm font-black"
												: cell.isCurrentMonth
												? "text-slate-700 dark:text-slate-300"
												: "text-slate-400 dark:text-slate-600"
										}`}>
										{cell.dayNum}
									</span>

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

								{/* Lista de Escalas do Dia */}
								<div className="space-y-1 my-1 overflow-y-auto max-h-[85px] no-scrollbar">
									{dayEscalas.map((esc) => {
										const turnoConf = TURNO_CONFIG[esc.turno] || TURNO_CONFIG.abertura;
										const timeLabel =
											esc.horarioInicio && esc.horarioFim
												? `${esc.horarioInicio}-${esc.horarioFim}`
												: turnoConf.label;

										return (
											<div
												key={esc.id}
												onClick={(e) => openEditModal(esc, e)}
												title={`${esc.funcionarioNome} (${turnoConf.label} ${timeLabel}) ${
													esc.observacoes ? "- " + esc.observacoes : ""
												}`}
												className={`text-2xs p-1 rounded-lg border font-bold flex items-center justify-between gap-1 shadow-xs hover:scale-[1.02] transition-transform ${turnoConf.badgeBg} ${turnoConf.badgeText}`}>
												<div className="flex items-center gap-1 min-w-0 truncate">
													<span
														className="w-1.5 h-1.5 rounded-full shrink-0"
														style={{ backgroundColor: turnoConf.color }}
													/>
													<span className="truncate">{esc.funcionarioNome}</span>
												</div>
												<span className="text-[10px] font-semibold shrink-0 opacity-85">
													{esc.horarioInicio || turnoConf.label.substring(0, 3)}
												</span>
											</div>
										);
									})}
								</div>

								{/* Rodapé da Célula */}
								<div className="text-[10px] text-slate-400 font-medium text-right">
									{dayEscalas.length > 0 && `${dayEscalas.length} esc.`}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* MODAL DE ADICIONAR / EDITAR ESCALA */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
					<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
							<div className="flex items-center gap-2">
								<CalendarIcon className="text-blue-600 dark:text-blue-400" size={20} />
								<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
									{editingEscala ? "Editar Escala" : "Adicionar na Escala"}
								</h3>
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

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Turno / Modalidade
								</label>
								<div className="grid grid-cols-3 gap-2">
									{(
										["abertura", "intermediario", "fechamento", "integral", "folga", "personalizado"] as TurnoTipo[]
									).map((t) => {
										const conf = TURNO_CONFIG[t];
										const isSelected = formData.turno === t;

										return (
											<button
												key={t}
												type="button"
												onClick={() => handleTurnoChange(t)}
												className={`cursor-pointer px-2.5 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
													isSelected
														? `${conf.badgeBg} ${conf.badgeText} ring-2 ring-blue-500`
														: "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
												}`}>
												{conf.label}
											</button>
										);
									})}
								</div>
							</div>

							{formData.turno !== "folga" && (
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
											Horário Início
										</label>
										<input
											type="time"
											value={formData.horarioInicio}
											onChange={(e) => setFormData({ ...formData, horarioInicio: e.target.value })}
											className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
									</div>
									<div>
										<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
											Horário Fim
										</label>
										<input
											type="time"
											value={formData.horarioFim}
											onChange={(e) => setFormData({ ...formData, horarioFim: e.target.value })}
											className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
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
									placeholder="Ex: Troca de horário, atraso autorizado..."
									className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
										<span>Excluir</span>
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
										{isSaving ? "Salvando..." : editingEscala ? "Atualizar" : "Confirmar"}
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
