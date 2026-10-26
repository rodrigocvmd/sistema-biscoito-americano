import { db } from "@/lib/firebase";
import {
	collection,
	doc,
	onSnapshot,
	setDoc,
	updateDoc,
	deleteDoc,
	deleteField,
	serverTimestamp,
} from "firebase/firestore";
import { EstoqueFisicoId, InsumoEstoqueItem, InsumoEstoqueNivel } from "@/types/insumos-estoque";
import { slugifyInsumoName } from "@/lib/insumos-data";

const COLLECTION_NAME = "insumosEstoque";

/**
 * Escuta todos os itens do estoque físico em tempo real
 */
export function subscribeInsumosEstoque(callback: (items: InsumoEstoqueItem[]) => void): () => void {
	const colRef = collection(db, COLLECTION_NAME);

	return onSnapshot(
		colRef,
		(snapshot) => {
			const items: InsumoEstoqueItem[] = snapshot.docs.map((docSnap) => {
				const data = docSnap.data();
				return {
					id: docSnap.id,
					nome: data.nome || "",
					categoria: data.categoria || "",
					locais: data.locais || {},
					updatedAt: data.updatedAt?.toDate?.() || null,
				};
			});

			// Ordenar alfabeticamente por nome
			items.sort((a, b) => a.nome.localeCompare(b.nome));
			callback(items);
		},
		(error) => {
			console.error("Erro ao escutar estoque físico de insumos:", error);
			callback([]);
		}
	);
}

/**
 * Salva ou atualiza a quantidade de um insumo em um estoque físico
 */
export async function saveInsumoEstoque(
	nome: string,
	local: EstoqueFisicoId,
	nivel: InsumoEstoqueNivel,
	categoria?: string
): Promise<void> {
	const cleanName = nome.trim().toUpperCase();
	const id = slugifyInsumoName(cleanName);
	const docRef = doc(db, COLLECTION_NAME, id);

	const updateData: Record<string, any> = {
		nome: cleanName,
		[`locais.${local}`]: nivel,
		updatedAt: serverTimestamp(),
	};

	if (categoria) {
		updateData.categoria = categoria;
	}

	await setDoc(docRef, updateData, { merge: true });
}

/**
 * Remove a indicação de um local específico de um insumo
 */
export async function removeLocalFromInsumo(id: string, local: EstoqueFisicoId): Promise<void> {
	const docRef = doc(db, COLLECTION_NAME, id);
	await updateDoc(docRef, {
		[`locais.${local}`]: deleteField(),
		updatedAt: serverTimestamp(),
	});
}

/**
 * Exclui o insumo por completo do estoque físico
 */
export async function deleteInsumoEstoque(id: string): Promise<void> {
	const docRef = doc(db, COLLECTION_NAME, id);
	await deleteDoc(docRef);
}
