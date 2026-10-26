import { db } from "@/lib/firebase";
import {
	collection,
	addDoc,
	updateDoc,
	doc,
	serverTimestamp,
	onSnapshot,
	query,
	orderBy,
	limit,
	writeBatch,
	Timestamp,
} from "firebase/firestore";
import { AppNotification } from "@/types/notifications";

const NOTIFICATIONS_COLLECTION = "notificacoes";

export interface CreateNotificationInput {
	type: string;
	title: string;
	message: string;
	storeId?: string;
	storeName?: string;
	itemId?: string;
	itemName?: string;
	metadata?: Record<string, any>;
}

/**
 * Cria uma nova notificação no sistema
 */
export async function createNotification(input: CreateNotificationInput): Promise<string> {
	try {
		const colRef = collection(db, NOTIFICATIONS_COLLECTION);
		const docRef = await addDoc(colRef, {
			type: input.type,
			title: input.title,
			message: input.message,
			read: false,
			createdAt: serverTimestamp(),
			storeId: input.storeId || null,
			storeName: input.storeName || null,
			itemId: input.itemId || null,
			itemName: input.itemName || null,
			metadata: input.metadata || {},
		});
		return docRef.id;
	} catch (error) {
		console.error("Erro ao criar notificação:", error);
		throw error;
	}
}

/**
 * Escuta notificações em tempo real ordenadas das mais recentes para as mais antigas
 */
export function subscribeNotifications(
	callback: (notifications: AppNotification[]) => void,
	maxLimit = 50
): () => void {
	const colRef = collection(db, NOTIFICATIONS_COLLECTION);
	const q = query(colRef, orderBy("createdAt", "desc"), limit(maxLimit));

	return onSnapshot(
		q,
		(snapshot) => {
			const items: AppNotification[] = snapshot.docs.map((docSnap) => {
				const data = docSnap.data();
				let createdAt = new Date();
				if (data.createdAt instanceof Timestamp) {
					createdAt = data.createdAt.toDate();
				} else if (data.createdAt?.toDate) {
					createdAt = data.createdAt.toDate();
				}

				let readAt: Date | null = null;
				if (data.readAt instanceof Timestamp) {
					readAt = data.readAt.toDate();
				} else if (data.readAt?.toDate) {
					readAt = data.readAt.toDate();
				}

				return {
					id: docSnap.id,
					type: data.type || "geral",
					title: data.title || "Notificação",
					message: data.message || "",
					read: !!data.read,
					createdAt,
					storeId: data.storeId || undefined,
					storeName: data.storeName || undefined,
					itemId: data.itemId || undefined,
					itemName: data.itemName || undefined,
					readAt,
					metadata: data.metadata || {},
				};
			});

			// Garantir ordenação desc por createdAt
			items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

			callback(items);
		},
		(error) => {
			console.error("Erro ao escutar notificações:", error);
			callback([]);
		}
	);
}

/**
 * Marca uma notificação específica como lida
 */
export async function markNotificationAsRead(id: string): Promise<void> {
	try {
		const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
		await updateDoc(docRef, {
			read: true,
			readAt: serverTimestamp(),
		});
	} catch (error) {
		console.error(`Erro ao marcar notificação ${id} como lida:`, error);
		throw error;
	}
}

/**
 * Marca todas as notificações não lidas como lidas
 */
export async function markAllNotificationsAsRead(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	try {
		const batch = writeBatch(db);
		ids.forEach((id) => {
			const docRef = doc(db, NOTIFICATIONS_COLLECTION, id);
			batch.update(docRef, {
				read: true,
				readAt: serverTimestamp(),
			});
		});
		await batch.commit();
	} catch (error) {
		console.error("Erro ao marcar todas notificações como lidas:", error);
		throw error;
	}
}
