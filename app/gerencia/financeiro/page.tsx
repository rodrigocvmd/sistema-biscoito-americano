"use client";

import { useEffect, useState } from "react";
import {
	Funcionario,
	EscalaItem,
	LancamentoFinanceiro,
} from "@/types/funcionarios";
import {
	subscribeFuncionarios,
	subscribeEscalas,
	subscribeFinanceiro,
} from "@/lib/funcionarios-service";
import FinanceiroTab from "@/app/gerencia/funcionarios/components/financeiro-tab";
import { Loader2 } from "lucide-react";

export default function FinanceiroPage() {
	const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
	const [escalas, setEscalas] = useState<EscalaItem[]>([]);
	const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
	const [loading, setLoading] = useState(true);

	// Estado do Mês/Ano selecionado (formato YYYY-MM)
	const [mesAnoStr, setMesAnoStr] = useState(() => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		return `${year}-${month}`;
	});

	// Inscrição em Tempo Real: Funcionários
	useEffect(() => {
		const unsubscribe = subscribeFuncionarios((data) => {
			setFuncionarios(data);
			setLoading(false);
		});
		return () => unsubscribe();
	}, []);

	// Inscrição em Tempo Real: Escalas do Mês Atual
	useEffect(() => {
		const unsubscribe = subscribeEscalas(null, mesAnoStr, (data) => {
			setEscalas(data);
		});
		return () => unsubscribe();
	}, [mesAnoStr]);

	// Inscrição em Tempo Real: Lançamentos Financeiros do Mês Atual
	useEffect(() => {
		const unsubscribe = subscribeFinanceiro(mesAnoStr, (data) => {
			setLancamentos(data);
		});
		return () => unsubscribe();
	}, [mesAnoStr]);

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center p-20 gap-3">
				<Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={40} />
				<p className="text-sm font-bold text-slate-500 dark:text-slate-400">
					Carregando dados financeiros...
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<FinanceiroTab
				funcionarios={funcionarios}
				lancamentos={lancamentos}
				escalas={escalas}
				mesAnoStr={mesAnoStr}
				onChangeMesAno={setMesAnoStr}
			/>
		</div>
	);
}
