"use client";

import { useEffect, useState } from "react";
import {
	Funcionario,
	EscalaItem,
	LancamentoFinanceiro,
} from "@/types/funcionarios";
import { StoreId } from "@/types";
import {
	subscribeFuncionarios,
	subscribeEscalas,
	subscribeFinanceiro,
} from "@/lib/funcionarios-service";
import FuncionariosTab from "./components/funcionarios-tab";
import EscalaTab from "./components/escala-tab";
import FinanceiroTab from "./components/financeiro-tab";
import HorariosTab from "./components/horarios-tab";
import { Calendar, DollarSign, Users, Loader2, Clock } from "lucide-react";
import {
	subscribeLojasHorarios,
} from "@/lib/funcionarios-service";
import { HorarioSemanaLoja, HORARIO_PADRAO_SEMANA } from "@/types/funcionarios";

type MainSubTab = "escala" | "horarios" | "financeiro" | "funcionarios";

export default function FuncionariosPage() {
	const [activeTab, setActiveTab] = useState<MainSubTab>("escala");

	// Estados Globais de Dados
	const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
	const [escalas, setEscalas] = useState<EscalaItem[]>([]);
	const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
	const [lojasHorarios, setLojasHorarios] = useState<Record<StoreId, HorarioSemanaLoja>>({
		conjunto: HORARIO_PADRAO_SEMANA,
		terraco: HORARIO_PADRAO_SEMANA,
		lago: HORARIO_PADRAO_SEMANA,
		noroeste: HORARIO_PADRAO_SEMANA,
	});
	const [loading, setLoading] = useState(true);

	// Estado do Mês/Ano selecionado (formato YYYY-MM)
	const [mesAnoStr, setMesAnoStr] = useState(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	});

	// Loja selecionada para a aba de Escala e Horários
	const [selectedLojaEscala, setSelectedLojaEscala] = useState<StoreId>("lago");

	// Inscrição em Tempo Real: Funcionários
	useEffect(() => {
		const unsubscribe = subscribeFuncionarios((data) => {
			setFuncionarios(data);
			setLoading(false);
		});
		return () => unsubscribe();
	}, []);

	// Inscrição em Tempo Real: Horários das Lojas
	useEffect(() => {
		const unsubscribe = subscribeLojasHorarios((configs) => {
			setLojasHorarios(configs);
		});
		return () => unsubscribe();
	}, []);

	// Inscrição em Tempo Real: Escalas (atualiza quando o mês muda)
	useEffect(() => {
		const unsubscribe = subscribeEscalas(null, mesAnoStr, (data) => {
			setEscalas(data);
		});
		return () => unsubscribe();
	}, [mesAnoStr]);

	// Inscrição em Tempo Real: Financeiro (atualiza quando o mês muda)
	useEffect(() => {
		const unsubscribe = subscribeFinanceiro(mesAnoStr, (data) => {
			setLancamentos(data);
		});
		return () => unsubscribe();
	}, [mesAnoStr]);

	const subTabs: { id: MainSubTab; label: string; icon: typeof Calendar }[] = [
		{ id: "escala", label: "Escala", icon: Calendar },
		{ id: "financeiro", label: "Financeiro", icon: DollarSign },
		{ id: "funcionarios", label: "Funcionários", icon: Users },
		{ id: "horarios", label: "Horários", icon: Clock },
	];

	return (
		<div className="space-y-6">
			{/* CABEÇALHO DO MÓDULO E SUB-ABAS PRINCIPAIS */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
				<div className="space-y-1">
					<h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
						<Users className="text-blue-600 dark:text-blue-400" size={24} />
						<span>Gestão de Equipe</span>
					</h2>
					<p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
						Controle de escalas por loja, holerites, vales e cadastro centralizado de funcionários.
					</p>
				</div>

				{/* Botões de Seleção de Sub-Aba */}
				<div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto">
					{subTabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.id;

						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`cursor-pointer px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
									isActive
										? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
										: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
								}`}>
								<Icon size={18} />
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* CONTEÚDO DA SUB-ABA ATIVA */}
			{loading ? (
				<div className="bg-white dark:bg-slate-900 p-16 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-400">
					<Loader2 className="animate-spin text-blue-600" size={32} />
					<span className="text-sm font-semibold">Carregando dados da equipe...</span>
				</div>
			) : (
				<>
					{activeTab === "escala" && (
						<EscalaTab
							escalas={escalas}
							funcionarios={funcionarios}
							selectedLoja={selectedLojaEscala}
							onSelectLoja={setSelectedLojaEscala}
							mesAnoStr={mesAnoStr}
							onChangeMesAno={setMesAnoStr}
							lojasHorarios={lojasHorarios}
						/>
					)}

					{activeTab === "horarios" && (
						<HorariosTab
							lojasHorarios={lojasHorarios}
							selectedLoja={selectedLojaEscala}
							onSelectLoja={setSelectedLojaEscala}
						/>
					)}

					{activeTab === "financeiro" && (
						<FinanceiroTab
							funcionarios={funcionarios}
							lancamentos={lancamentos}
							escalas={escalas}
							mesAnoStr={mesAnoStr}
							onChangeMesAno={setMesAnoStr}
						/>
					)}

					{activeTab === "funcionarios" && (
						<FuncionariosTab funcionarios={funcionarios} mesAnoStr={mesAnoStr} />
					)}
				</>
			)}
		</div>
	);
}
