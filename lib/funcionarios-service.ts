import { db } from "@/lib/firebase";
import {
	collection,
	doc,
	addDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	onSnapshot,
	query,
	where,
	orderBy,
	serverTimestamp,
	Timestamp,
	getDocs,
	writeBatch,
} from "firebase/firestore";
import {
	Funcionario,
	EscalaItem,
	LancamentoFinanceiro,
	HorarioSemanaLoja,
	HORARIO_PADRAO_SEMANA,
} from "@/types/funcionarios";
import { StoreId } from "@/types";

const FUNCIONARIOS_COLLECTION = "funcionarios";
const ESCALAS_COLLECTION = "escalas";
const FINANCEIRO_COLLECTION = "financeiro_lancamentos";
const LOJAS_HORARIOS_COLLECTION = "lojas_horarios";

// ==================== FUNCIONÁRIOS ====================

export const subscribeFuncionarios = (callback: (data: Funcionario[]) => void) => {
	const q = query(collection(db, FUNCIONARIOS_COLLECTION));
	return onSnapshot(
		q,
		(snapshot) => {
			const list: Funcionario[] = snapshot.docs.map((docSnap) => ({
				id: docSnap.id,
				...(docSnap.data() as Omit<Funcionario, "id">),
			}));
			// Ordenar alfabeticamente por nome
			list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
			callback(list);
		},
		(error) => {
			console.error("Erro ao escutar funcionários:", error);
		}
	);
};

// Helper para remover valores undefined (o Firestore rejeita campos com undefined)
const sanitizeData = <T extends Record<string, any>>(obj: T): Partial<T> => {
	const cleaned: Record<string, any> = {};
	Object.entries(obj).forEach(([key, value]) => {
		if (value !== undefined) {
			cleaned[key] = value;
		}
	});
	return cleaned as Partial<T>;
};

export const createFuncionario = async (data: Omit<Funcionario, "id" | "createdAt" | "updatedAt">) => {
	const payload = sanitizeData({
		...data,
		salarioBase: Number(data.salarioBase) || 0,
		valeTransporte: Number(data.valeTransporte) || 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return await addDoc(collection(db, FUNCIONARIOS_COLLECTION), payload);
};

export const updateFuncionario = async (id: string, data: Partial<Omit<Funcionario, "id">>) => {
	const ref = doc(db, FUNCIONARIOS_COLLECTION, id);
	const rawPayload: Record<string, any> = {
		...data,
		updatedAt: serverTimestamp(),
	};
	if (data.salarioBase !== undefined) rawPayload.salarioBase = Number(data.salarioBase) || 0;
	if (data.valeTransporte !== undefined) rawPayload.valeTransporte = Number(data.valeTransporte) || 0;
	const payload = sanitizeData(rawPayload);
	return await updateDoc(ref, payload);
};

export const deleteFuncionario = async (id: string) => {
	const ref = doc(db, FUNCIONARIOS_COLLECTION, id);
	return await deleteDoc(ref);
};

// ==================== ESCALAS ====================

export const subscribeEscalas = (
	lojaId: StoreId | null,
	startMonthStr: string, // YYYY-MM
	callback: (data: EscalaItem[]) => void
) => {
	const startPrefix = `${startMonthStr}-01`;
	const endPrefix = `${startMonthStr}-31`;

	let q;
	if (lojaId) {
		q = query(
			collection(db, ESCALAS_COLLECTION),
			where("lojaId", "==", lojaId),
			where("data", ">=", startPrefix),
			where("data", "<=", endPrefix)
		);
	} else {
		q = query(
			collection(db, ESCALAS_COLLECTION),
			where("data", ">=", startPrefix),
			where("data", "<=", endPrefix)
		);
	}

	return onSnapshot(
		q,
		(snapshot) => {
			const list: EscalaItem[] = snapshot.docs.map((docSnap) => ({
				id: docSnap.id,
				...(docSnap.data() as Omit<EscalaItem, "id">),
			}));
			list.sort((a, b) => a.data.localeCompare(b.data) || (a.horarioInicio || "").localeCompare(b.horarioInicio || ""));
			callback(list);
		},
		(error) => {
			console.error("Erro ao escutar escalas:", error);
		}
	);
};

export const createEscala = async (data: Omit<EscalaItem, "id" | "createdAt" | "updatedAt">) => {
	const payload = sanitizeData({
		...data,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return await addDoc(collection(db, ESCALAS_COLLECTION), payload);
};

export const updateEscala = async (id: string, data: Partial<Omit<EscalaItem, "id">>) => {
	const ref = doc(db, ESCALAS_COLLECTION, id);
	const payload = sanitizeData({
		...data,
		updatedAt: serverTimestamp(),
	});
	return await updateDoc(ref, payload);
};

export const deleteEscala = async (id: string) => {
	const ref = doc(db, ESCALAS_COLLECTION, id);
	return await deleteDoc(ref);
};

export interface GerarEscalaMensalParams {
	funcionarioId: string;
	funcionarioNome: string;
	funcionarioCargo?: string;
	lojaId: StoreId;
	mesAnoStr: string; // YYYY-MM
	regime: "12x36" | "6x1";
	primeiroDiaTrabalho: string; // YYYY-MM-DD
	horarioInicio: string; // ex: "10:00"
	horarioFim: string; // ex: "22:00" (12h) ou "19:00" (9h)
	diaDescansoSemanal?: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
	gerarDiasDeFolga?: boolean;
}

export const gerarEscalaAutomaticaMes = async (params: GerarEscalaMensalParams) => {
	const {
		funcionarioId,
		funcionarioNome,
		funcionarioCargo,
		lojaId,
		mesAnoStr,
		regime,
		primeiroDiaTrabalho,
		horarioInicio,
		horarioFim,
		diaDescansoSemanal = 0,
		gerarDiasDeFolga = true,
	} = params;

	const [ano, mes] = mesAnoStr.split("-").map(Number);
	const totalDiasMes = new Date(ano, mes, 0).getDate();
	const startDay = parseInt(primeiroDiaTrabalho.split("-")[2], 10);

	// 1. Buscar escalas pré-existentes deste colaborador nesta loja e mês para limpar e não duplicar
	const startPrefix = `${mesAnoStr}-01`;
	const endPrefix = `${mesAnoStr}-31`;
	const q = query(
		collection(db, ESCALAS_COLLECTION),
		where("funcionarioId", "==", funcionarioId),
		where("lojaId", "==", lojaId),
		where("data", ">=", startPrefix),
		where("data", "<=", endPrefix)
	);
	const existingSnap = await getDocs(q);

	const batch = writeBatch(db);

	// Remove escalas antigas deste colaborador no mês nesta loja
	existingSnap.forEach((d) => {
		batch.delete(d.ref);
	});

	let countTrabalho = 0;
	let countFolga = 0;

	// 2. Gerar conforme o regime
	if (regime === "12x36") {
		// Dias alternados a partir de startDay
		for (let day = startDay; day <= totalDiasMes; day++) {
			const dateStr = `${ano}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			const isWorkDay = (day - startDay) % 2 === 0;

			if (isWorkDay) {
				const newRef = doc(collection(db, ESCALAS_COLLECTION));
				const dataPayload = sanitizeData({
					funcionarioId,
					funcionarioNome,
					funcionarioCargo,
					lojaId,
					data: dateStr,
					turno: "integral",
					horarioInicio,
					horarioFim,
					observacoes: "Escala 12x36",
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				});
				batch.set(newRef, dataPayload);
				countTrabalho++;
			} else if (gerarDiasDeFolga) {
				const newRef = doc(collection(db, ESCALAS_COLLECTION));
				const dataPayload = sanitizeData({
					funcionarioId,
					funcionarioNome,
					funcionarioCargo,
					lojaId,
					data: dateStr,
					turno: "folga",
					horarioInicio: "",
					horarioFim: "",
					observacoes: "Folga 12x36",
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				});
				batch.set(newRef, dataPayload);
				countFolga++;
			}
		}
	} else if (regime === "6x1") {
		// 6 dias de trabalho por 1 dia de descanso na semana
		for (let day = startDay; day <= totalDiasMes; day++) {
			const dateStr = `${ano}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			const dateObj = new Date(ano, mes - 1, day);
			const dayOfWeek = dateObj.getDay(); // 0 a 6

			if (dayOfWeek === diaDescansoSemanal) {
				if (gerarDiasDeFolga) {
					const newRef = doc(collection(db, ESCALAS_COLLECTION));
					const dataPayload = sanitizeData({
						funcionarioId,
						funcionarioNome,
						funcionarioCargo,
						lojaId,
						data: dateStr,
						turno: "folga",
						horarioInicio: "",
						horarioFim: "",
						observacoes: "Descanso Semanal (6x1)",
						createdAt: serverTimestamp(),
						updatedAt: serverTimestamp(),
					});
					batch.set(newRef, dataPayload);
					countFolga++;
				}
			} else {
				const newRef = doc(collection(db, ESCALAS_COLLECTION));
				const dataPayload = sanitizeData({
					funcionarioId,
					funcionarioNome,
					funcionarioCargo,
					lojaId,
					data: dateStr,
					turno: "personalizado",
					horarioInicio,
					horarioFim,
					observacoes: "Escala 6x1 (9h)",
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
				});
				batch.set(newRef, dataPayload);
				countTrabalho++;
			}
		}
	}

	await batch.commit();

	return { countTrabalho, countFolga };
};

// ==================== FINANCEIRO ====================

export const subscribeFinanceiro = (
	mesReferencia: string, // YYYY-MM
	callback: (data: LancamentoFinanceiro[]) => void
) => {
	const q = query(
		collection(db, FINANCEIRO_COLLECTION),
		where("mesReferencia", "==", mesReferencia)
	);

	return onSnapshot(
		q,
		(snapshot) => {
			const list: LancamentoFinanceiro[] = snapshot.docs.map((docSnap) => ({
				id: docSnap.id,
				...(docSnap.data() as Omit<LancamentoFinanceiro, "id">),
			}));
			list.sort((a, b) => b.data.localeCompare(a.data));
			callback(list);
		},
		(error) => {
			console.error("Erro ao escutar lançamentos financeiros:", error);
		}
	);
};

export const createLancamentoFinanceiro = async (
	data: Omit<LancamentoFinanceiro, "id" | "createdAt" | "updatedAt">
) => {
	const payload = sanitizeData({
		...data,
		valor: Number(data.valor) || 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return await addDoc(collection(db, FINANCEIRO_COLLECTION), payload);
};

export const updateLancamentoFinanceiro = async (
	id: string,
	data: Partial<Omit<LancamentoFinanceiro, "id">>
) => {
	const ref = doc(db, FINANCEIRO_COLLECTION, id);
	const rawPayload: Record<string, any> = {
		...data,
		updatedAt: serverTimestamp(),
	};
	if (data.valor !== undefined) rawPayload.valor = Number(data.valor) || 0;
	const payload = sanitizeData(rawPayload);
	return await updateDoc(ref, payload);
};

export const deleteLancamentoFinanceiro = async (id: string) => {
	const ref = doc(db, FINANCEIRO_COLLECTION, id);
	return await deleteDoc(ref);
};

// Gera lançamentos automáticos de salário e VT para os funcionários ativos no mês selecionado
export const gerarFolhaAutomaticaMes = async (
	mesReferencia: string,
	funcionarios: Funcionario[],
	lancamentosExistentes: LancamentoFinanceiro[]
) => {
	const batch = writeBatch(db);
	let generatedCount = 0;
	const [ano, mes] = mesReferencia.split("-");
	const dataPadrao = `${mesReferencia}-05`; // Data de referência padrão 5º dia útil

	for (const func of funcionarios) {
		if (func.status !== "ativo") continue;

		// Verificar se já tem salário base no mês
		const hasSalario = lancamentosExistentes.some(
			(l) => l.funcionarioId === func.id && l.tipo === "salario" && l.mesReferencia === mesReferencia
		);

		if (!hasSalario && (func.salarioBase || 0) > 0) {
			const newRef = doc(collection(db, FINANCEIRO_COLLECTION));
			batch.set(newRef, {
				funcionarioId: func.id,
				funcionarioNome: func.nome,
				lojaId: func.lojaId,
				tipo: "salario",
				descricao: `Salário Base - ${mes}/${ano}`,
				valor: Number(func.salarioBase),
				data: dataPadrao,
				mesReferencia,
				status: "pendente",
				metodoPagamento: "pix",
				observacoes: "Gerado automaticamente",
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});
			generatedCount++;
		}

		// Verificar se já tem VT no mês
		const hasVt = lancamentosExistentes.some(
			(l) => l.funcionarioId === func.id && l.tipo === "vale_transporte" && l.mesReferencia === mesReferencia
		);

		if (!hasVt && (func.valeTransporte || 0) > 0) {
			const newRef = doc(collection(db, FINANCEIRO_COLLECTION));
			batch.set(newRef, {
				funcionarioId: func.id,
				funcionarioNome: func.nome,
				lojaId: func.lojaId,
				tipo: "vale_transporte",
				descricao: `Vale-Transporte - ${mes}/${ano}`,
				valor: Number(func.valeTransporte),
				data: `${mesReferencia}-01`,
				mesReferencia,
				status: "pendente",
				metodoPagamento: "pix",
				observacoes: "Gerado automaticamente",
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});
			generatedCount++;
		}
	}

	if (generatedCount > 0) {
		await batch.commit();
	}

	return generatedCount;
};

// ==================== HORÁRIOS DAS LOJAS ====================

export const subscribeLojasHorarios = (
	callback: (configs: Record<StoreId, HorarioSemanaLoja>) => void
) => {
	const q = query(collection(db, LOJAS_HORARIOS_COLLECTION));
	return onSnapshot(
		q,
		(snapshot) => {
			const configs: Record<string, HorarioSemanaLoja> = {
				conjunto: { ...HORARIO_PADRAO_SEMANA },
				terraco: { ...HORARIO_PADRAO_SEMANA },
				lago: { ...HORARIO_PADRAO_SEMANA },
				noroeste: { ...HORARIO_PADRAO_SEMANA },
			};

			snapshot.docs.forEach((d) => {
				const data = d.data();
				if (data.horarios) {
					configs[d.id] = {
						...HORARIO_PADRAO_SEMANA,
						...data.horarios,
					};
				}
			});

			callback(configs as Record<StoreId, HorarioSemanaLoja>);
		},
		(error) => {
			console.error("Erro ao escutar horários das lojas:", error);
		}
	);
};

export const saveLojaHorarios = async (lojaId: StoreId, horarios: HorarioSemanaLoja) => {
	const ref = doc(db, LOJAS_HORARIOS_COLLECTION, lojaId);
	return await setDoc(
		ref,
		{
			lojaId,
			horarios,
			updatedAt: serverTimestamp(),
		},
		{ merge: true }
	);
};

