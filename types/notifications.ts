export type NotificationType = "ultimo_pacote_aberto" | string;

export interface AppNotification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	read: boolean;
	createdAt: Date;
	storeId?: string;
	storeName?: string;
	itemId?: string;
	itemName?: string;
	readAt?: Date | null;
	metadata?: Record<string, any>;
}
