import { db } from "@/lib/firebase";
import {
	collection,
	doc,
	addDoc,
	updateDoc,
	deleteDoc,
	onSnapshot,
	query,
	serverTimestamp,
} from "firebase/firestore";
import {
	CustoFinanceiro,
	FaturamentoFinanceiro,
} from "@/types/financeiro-controle";

const FATURAMENTOS_COLLECTION = "financeiro_controle_faturamentos";
const CUSTOS_COLLECTION = "financeiro_controle_custos";

const LS_FATURAMENTOS_KEY = "biscoito_financeiro_controle_faturamentos_cache";
const LS_CUSTOS_KEY = "biscoito_financeiro_controle_custos_cache";

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

// ==================== FATURAMENTO ====================

export const subscribeFaturamentos = (
	callback: (data: FaturamentoFinanceiro[]) => void
) => {
	// Carrega cache local imediato se houver
	if (typeof window !== "undefined") {
		try {
			const cached = localStorage.getItem(LS_FATURAMENTOS_KEY);
			if (cached) {
				const parsed = JSON.parse(cached);
				if (Array.isArray(parsed) && parsed.length > 0) {
					callback(parsed);
				}
			}
		} catch (e) {
			console.warn("Aviso ao ler cache local de faturamento:", e);
		}
	}

	const q = query(collection(db, FATURAMENTOS_COLLECTION));

	return onSnapshot(
		q,
		(snapshot) => {
			const list: FaturamentoFinanceiro[] = snapshot.docs.map((docSnap) => ({
				id: docSnap.id,
				...(docSnap.data() as Omit<FaturamentoFinanceiro, "id">),
			}));

			// Ordenar da data mais recente para a mais antiga
			list.sort((a, b) => b.data.localeCompare(a.data));

			if (typeof window !== "undefined") {
				try {
					localStorage.setItem(LS_FATURAMENTOS_KEY, JSON.stringify(list));
				} catch (e) {
					console.warn("Erro ao salvar cache de faturamento:", e);
				}
			}

			callback(list);
		},
		(error) => {
			console.error("Erro ao escutar faturamentos no Firestore:", error);
		}
	);
};

export const createFaturamento = async (
	data: Omit<FaturamentoFinanceiro, "id" | "createdAt" | "updatedAt">
) => {
	const rawPayload: Record<string, any> = {
		...data,
		valorTotal: Number(data.valorTotal) || 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	if (data.itens && Array.isArray(data.itens)) {
		rawPayload.itens = data.itens.map((item) => ({
			...item,
			quantidade: Number(item.quantidade) || 0,
			precoUnitario: Number(item.precoUnitario) || 0,
			subtotal: Number(item.subtotal) || 0,
		}));
	}

	const payload = sanitizeData(rawPayload);
	return await addDoc(collection(db, FATURAMENTOS_COLLECTION), payload);
};

export const updateFaturamento = async (
	id: string,
	data: Partial<Omit<FaturamentoFinanceiro, "id">>
) => {
	const ref = doc(db, FATURAMENTOS_COLLECTION, id);
	const rawPayload: Record<string, any> = {
		...data,
		updatedAt: serverTimestamp(),
	};

	if (data.valorTotal !== undefined) {
		rawPayload.valorTotal = Number(data.valorTotal) || 0;
	}

	if (data.itens && Array.isArray(data.itens)) {
		rawPayload.itens = data.itens.map((item) => ({
			...item,
			quantidade: Number(item.quantidade) || 0,
			precoUnitario: Number(item.precoUnitario) || 0,
			subtotal: Number(item.subtotal) || 0,
		}));
	}

	const payload = sanitizeData(rawPayload);
	return await updateDoc(ref, payload);
};

export const deleteFaturamento = async (id: string) => {
	const ref = doc(db, FATURAMENTOS_COLLECTION, id);
	return await deleteDoc(ref);
};

// ==================== CUSTOS / DESPESAS ====================

export const subscribeCustos = (
	callback: (data: CustoFinanceiro[]) => void
) => {
	// Carrega cache local imediato se houver
	if (typeof window !== "undefined") {
		try {
			const cached = localStorage.getItem(LS_CUSTOS_KEY);
			if (cached) {
				const parsed = JSON.parse(cached);
				if (Array.isArray(parsed) && parsed.length > 0) {
					callback(parsed);
				}
			}
		} catch (e) {
			console.warn("Aviso ao ler cache local de custos:", e);
		}
	}

	const q = query(collection(db, CUSTOS_COLLECTION));

	return onSnapshot(
		q,
		(snapshot) => {
			const list: CustoFinanceiro[] = snapshot.docs.map((docSnap) => ({
				id: docSnap.id,
				...(docSnap.data() as Omit<CustoFinanceiro, "id">),
			}));

			// Ordenar da data mais recente para a mais antiga
			list.sort((a, b) => b.data.localeCompare(a.data));

			if (typeof window !== "undefined") {
				try {
					localStorage.setItem(LS_CUSTOS_KEY, JSON.stringify(list));
				} catch (e) {
					console.warn("Erro ao salvar cache de custos:", e);
				}
			}

			callback(list);
		},
		(error) => {
			console.error("Erro ao escutar custos no Firestore:", error);
		}
	);
};

export const createCusto = async (
	data: Omit<CustoFinanceiro, "id" | "createdAt" | "updatedAt">
) => {
	const payload = sanitizeData({
		...data,
		valor: Number(data.valor) || 0,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return await addDoc(collection(db, CUSTOS_COLLECTION), payload);
};

export const updateCusto = async (
	id: string,
	data: Partial<Omit<CustoFinanceiro, "id">>
) => {
	const ref = doc(db, CUSTOS_COLLECTION, id);
	const rawPayload: Record<string, any> = {
		...data,
		updatedAt: serverTimestamp(),
	};
	if (data.valor !== undefined) rawPayload.valor = Number(data.valor) || 0;
	const payload = sanitizeData(rawPayload);
	return await updateDoc(ref, payload);
};

export const deleteCusto = async (id: string) => {
	const ref = doc(db, CUSTOS_COLLECTION, id);
	return await deleteDoc(ref);
};
