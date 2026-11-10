import { db, storage } from "@/lib/firebase";
import {
	collection,
	doc,
	addDoc,
	updateDoc,
	deleteDoc,
	deleteField,
	getDoc,
	getDocs,
	setDoc,
	onSnapshot,
	query,
	serverTimestamp,
} from "firebase/firestore";
import {
	ref as storageRef,
	uploadBytes,
	getDownloadURL,
	deleteObject,
} from "firebase/storage";
import {
	CustoAnexo,
	CustoFinanceiro,
	FaturamentoFinanceiro,
	isGeneralOnlyCostCategory,
	isSpecificStoreId,
} from "@/types/financeiro-controle";

const FATURAMENTOS_COLLECTION = "financeiro_controle_faturamentos";
const CUSTOS_COLLECTION = "financeiro_controle_custos";
const CUSTOS_ANEXOS_COLLECTION = "financeiro_controle_anexos";

const LS_FATURAMENTOS_KEY = "biscoito_financeiro_controle_faturamentos_cache";
const LS_CUSTOS_KEY = "biscoito_financeiro_controle_custos_cache";

const getSortableDateKey = (item: { data?: string; mesReferencia?: string }) => {
	if (item.data && item.data.trim()) return item.data;
	if (item.mesReferencia && item.mesReferencia.trim()) return `${item.mesReferencia}-01`;
	return "";
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
			list.sort((a, b) => getSortableDateKey(b).localeCompare(getSortableDateKey(a)));

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
	if (!isSpecificStoreId(data.lojaId)) {
		throw new Error("Faturamento deve ser lançado apenas para uma loja específica.");
	}

	const rawPayload: Record<string, any> = {
		...data,
		data: data.isExtra ? "" : data.data,
		isExtra: data.isExtra ? true : undefined,
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
	if (data.lojaId !== undefined && !isSpecificStoreId(data.lojaId)) {
		throw new Error("Faturamento deve ser vinculado apenas a uma loja específica.");
	}

	const ref = doc(db, FATURAMENTOS_COLLECTION, id);
	const rawPayload: Record<string, any> = {
		...data,
		updatedAt: serverTimestamp(),
	};

	if (data.valorTotal !== undefined) {
		rawPayload.valorTotal = Number(data.valorTotal) || 0;
	}

	if (data.isExtra !== undefined) {
		rawPayload.isExtra = Boolean(data.isExtra);
		if (data.isExtra) {
			rawPayload.data = "";
		}
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
			list.sort((a, b) => getSortableDateKey(b).localeCompare(getSortableDateKey(a)));

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
	const normalizedLojaId = isGeneralOnlyCostCategory(data.categoria)
		? "geral"
		: data.lojaId;

	if (!isGeneralOnlyCostCategory(data.categoria) && !isSpecificStoreId(normalizedLojaId)) {
		throw new Error("Este tipo de custo deve ser lançado apenas para uma loja específica.");
	}

	const payload = sanitizeData({
		...data,
		lojaId: normalizedLojaId,
		data: data.isExtra ? "" : data.data,
		status: data.status || "pendente",
		valor: Number(data.valor) || 0,
		link: data.link?.trim() || undefined,
		anexos: Array.isArray(data.anexos) && data.anexos.length > 0 ? data.anexos : undefined,
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
	if (data.categoria !== undefined) {
		if (isGeneralOnlyCostCategory(data.categoria)) {
			rawPayload.lojaId = "geral";
		} else if (data.lojaId !== undefined && !isSpecificStoreId(data.lojaId)) {
			throw new Error("Este tipo de custo deve ser lançado apenas para uma loja específica.");
		}
	}
	if (data.valor !== undefined) rawPayload.valor = Number(data.valor) || 0;
	if (data.isExtra !== undefined) {
		rawPayload.isExtra = Boolean(data.isExtra);
		if (data.isExtra) {
			rawPayload.data = "";
		}
	}
	if (data.link !== undefined) {
		const trimmed = data.link.trim();
		rawPayload.link = trimmed ? trimmed : deleteField();
	}
	if (data.observacoes !== undefined) {
		const trimmed = data.observacoes.trim();
		rawPayload.observacoes = trimmed ? trimmed : deleteField();
	}
	if (data.anexos !== undefined) {
		rawPayload.anexos = Array.isArray(data.anexos) ? data.anexos : [];
	}
	const payload = sanitizeData(rawPayload);
	return await updateDoc(ref, payload);
};

export const deleteCusto = async (id: string) => {
	const ref = doc(db, CUSTOS_COLLECTION, id);
	try {
		const snap = await getDoc(ref);
		if (snap.exists()) {
			const data = snap.data() as Partial<CustoFinanceiro>;
			if (Array.isArray(data.anexos) && data.anexos.length > 0) {
				await Promise.allSettled(
					data.anexos.map((anexo) => deleteCustoAnexoStorage(anexo))
				);
			}
		}
	} catch (err) {
		console.warn("Aviso ao limpar anexos do custo excluído:", err);
	}
	return await deleteDoc(ref);
};

// ==================== ANEXOS DE CUSTOS ====================

const MAX_STORAGE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FIRESTORE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB fallback
const FIRESTORE_CHUNK_SIZE = 600_000; // ~600 KB chars per Firestore doc

const readFileAsDataUrl = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
			} else {
				reject(new Error("Falha ao ler o conteúdo do arquivo."));
			}
		};
		reader.onerror = () => reject(reader.error || new Error("Erro ao ler arquivo."));
		reader.readAsDataURL(file);
	});
};

export const dataUrlToBlob = (dataUrl: string, fallbackType = "application/octet-stream"): Blob => {
	const parts = dataUrl.split(",");
	const meta = parts[0] || "";
	const base64Data = parts[1] || "";
	const mimeMatch = meta.match(/data:([^;]+);base64/);
	const mimeType = mimeMatch ? mimeMatch[1] : fallbackType;

	const binaryString = atob(base64Data);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return new Blob([bytes], { type: mimeType });
};

export const uploadCustoAnexo = async (file: File): Promise<CustoAnexo> => {
	if (file.size > MAX_STORAGE_FILE_BYTES) {
		throw new Error("O arquivo excede o limite máximo de 10 MB.");
	}

	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const mimeType = file.type || "application/octet-stream";
	const uploadedAt = new Date().toISOString();

	// 1. Tenta enviar para o Firebase Storage com timeout curto para não travar caso Storage não esteja habilitado
	try {
		storage.maxUploadRetryTime = 5000;
		storage.maxOperationRetryTime = 5000;
		const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
		const path = `financeiro_controle_custos/${id}_${safeName}`;
		const fileRef = storageRef(storage, path);

		const uploadPromise = (async () => {
			await uploadBytes(fileRef, file, { contentType: mimeType });
			return await getDownloadURL(fileRef);
		})();

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error("Storage upload timeout")), 6500);
		});

		const url = await Promise.race([uploadPromise, timeoutPromise]);

		return {
			id,
			nome: file.name,
			tipo: mimeType,
			tamanho: file.size,
			url,
			storagePath: path,
			uploadedAt,
		};
	} catch (storageErr) {
		console.warn("Firebase Storage indisponível, salvando anexo na database Firestore:", storageErr);
	}

	// 2. Fallback seguro: salva diretamente na collection dedicada do Firestore (financeiro_controle_anexos)
	if (file.size > MAX_FIRESTORE_FILE_BYTES) {
		throw new Error("O arquivo excede o limite de 5 MB para salvamento direto na database.");
	}

	const dataUrl = await readFileAsDataUrl(file);
	const totalLen = dataUrl.length;

	if (totalLen <= FIRESTORE_CHUNK_SIZE) {
		const docRef = await addDoc(collection(db, CUSTOS_ANEXOS_COLLECTION), {
			nome: file.name,
			tipo: mimeType,
			tamanho: file.size,
			chunkCount: 1,
			dataUrl,
			createdAt: serverTimestamp(),
		});

		return {
			id,
			nome: file.name,
			tipo: mimeType,
			tamanho: file.size,
			anexoDocId: docRef.id,
			uploadedAt,
		};
	}

	const chunkCount = Math.ceil(totalLen / FIRESTORE_CHUNK_SIZE);
	const docRef = await addDoc(collection(db, CUSTOS_ANEXOS_COLLECTION), {
		nome: file.name,
		tipo: mimeType,
		tamanho: file.size,
		chunkCount,
		createdAt: serverTimestamp(),
	});

	for (let i = 0; i < chunkCount; i++) {
		const slice = dataUrl.slice(i * FIRESTORE_CHUNK_SIZE, (i + 1) * FIRESTORE_CHUNK_SIZE);
		await setDoc(doc(db, CUSTOS_ANEXOS_COLLECTION, docRef.id, "chunks", String(i)), {
			index: i,
			data: slice,
		});
	}

	return {
		id,
		nome: file.name,
		tipo: mimeType,
		tamanho: file.size,
		anexoDocId: docRef.id,
		uploadedAt,
	};
};

export const resolveCustoAnexoUrl = async (anexo: CustoAnexo): Promise<string> => {
	if (anexo.url) return anexo.url;
	if (!anexo.anexoDocId) {
		throw new Error("Referência do anexo inválida.");
	}

	const mainRef = doc(db, CUSTOS_ANEXOS_COLLECTION, anexo.anexoDocId);
	const snap = await getDoc(mainRef);
	if (!snap.exists()) {
		throw new Error("Arquivo anexo não encontrado na database.");
	}

	const data = snap.data() as { dataUrl?: string; chunkCount?: number; tipo?: string };
	let fullDataUrl = data.dataUrl || "";

	if (!fullDataUrl) {
		const chunksSnap = await getDocs(
			collection(db, CUSTOS_ANEXOS_COLLECTION, anexo.anexoDocId, "chunks")
		);
		const sortedChunks = chunksSnap.docs
			.map((d) => d.data() as { index: number; data: string })
			.sort((a, b) => a.index - b.index);
		fullDataUrl = sortedChunks.map((c) => c.data).join("");
	}

	if (!fullDataUrl) {
		throw new Error("Conteúdo do arquivo anexo vazio.");
	}

	const blob = dataUrlToBlob(fullDataUrl, data.tipo || anexo.tipo);
	return URL.createObjectURL(blob);
};

export const openCustoAnexo = async (anexo: CustoAnexo, preResolvedBlobUrl?: string) => {
	const directUrl = anexo.url || preResolvedBlobUrl;
	if (directUrl) {
		const opened = window.open(directUrl, "_blank", "noopener,noreferrer");
		if (!opened) {
			const a = document.createElement("a");
			a.href = directUrl;
			a.target = "_blank";
			a.rel = "noopener noreferrer";
			a.click();
		}
		return;
	}

	// Abre janela imediatamente no evento de clique para evitar bloqueador de pop-up
	const previewWin = window.open("", "_blank");
	try {
		const blobUrl = await resolveCustoAnexoUrl(anexo);
		if (previewWin) {
			previewWin.location.href = blobUrl;
		} else {
			const a = document.createElement("a");
			a.href = blobUrl;
			a.target = "_blank";
			a.rel = "noopener noreferrer";
			a.download = anexo.nome;
			a.click();
		}
	} catch (err) {
		if (previewWin) previewWin.close();
		console.error("Erro ao abrir anexo:", err);
		alert("Não foi possível abrir o arquivo anexo.");
	}
};

export const deleteCustoAnexoStorage = async (anexo: CustoAnexo) => {
	if (anexo.storagePath) {
		try {
			await deleteObject(storageRef(storage, anexo.storagePath));
		} catch (err: unknown) {
			const code =
				typeof err === "object" && err !== null && "code" in err
					? (err as { code?: string }).code
					: undefined;
			if (code !== "storage/object-not-found") {
				console.warn("Aviso ao excluir arquivo no Storage:", err);
			}
		}
	}

	if (anexo.anexoDocId) {
		try {
			const chunksSnap = await getDocs(
				collection(db, CUSTOS_ANEXOS_COLLECTION, anexo.anexoDocId, "chunks")
			);
			await Promise.all(chunksSnap.docs.map((d) => deleteDoc(d.ref)));
			await deleteDoc(doc(db, CUSTOS_ANEXOS_COLLECTION, anexo.anexoDocId));
		} catch (err) {
			console.warn("Aviso ao excluir anexo no Firestore:", err);
		}
	}
};
