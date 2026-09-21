import { db } from "@/lib/firebase";
import {
	collection,
	doc,
	addDoc,
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
import { Funcionario, EscalaItem, LancamentoFinanceiro } from "@/types/funcionarios";
import { StoreId } from "@/types";

const FUNCIONARIOS_COLLECTION = "funcionarios";
const ESCALAS_COLLECTION = "escalas";
const FINANCEIRO_COLLECTION = "financeiro_lancamentos";

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
