"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { AppNotification } from "@/types/notifications";
import {
	subscribeNotifications,
	markNotificationAsRead,
	markAllNotificationsAsRead,
} from "@/lib/notifications-service";
import { NotificationModal } from "./notification-modal";

interface NotificationContextValue {
	notifications: AppNotification[];
	unreadCount: number;
	hasUnread: boolean;
	isModalOpen: boolean;
	openModal: () => void;
	closeModal: () => void;
	markAsRead: (id: string) => Promise<void>;
	markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
	const [notifications, setNotifications] = useState<AppNotification[]>([]);
	const [isModalOpen, setIsModalOpen] = useState(false);

	useEffect(() => {
		const unsubscribe = subscribeNotifications((items) => {
			setNotifications(items);
		});

		return () => unsubscribe();
	}, []);

	const unreadCount = useMemo(
		() => notifications.filter((n) => !n.read).length,
		[notifications]
	);

	const hasUnread = unreadCount > 0;

	const openModal = () => setIsModalOpen(true);
	const closeModal = () => setIsModalOpen(false);

	const handleMarkAsRead = async (id: string) => {
		// Otimista na UI
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date() } : n))
		);
		await markNotificationAsRead(id);
	};

	const handleMarkAllAsRead = async () => {
		const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
		if (unreadIds.length === 0) return;

		setNotifications((prev) =>
			prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
		);
		await markAllNotificationsAsRead(unreadIds);
	};

	return (
		<NotificationContext.Provider
			value={{
				notifications,
				unreadCount,
				hasUnread,
				isModalOpen,
				openModal,
				closeModal,
				markAsRead: handleMarkAsRead,
				markAllAsRead: handleMarkAllAsRead,
			}}>
			{children}
			<NotificationModal
				isOpen={isModalOpen}
				onClose={closeModal}
				notifications={notifications}
				onMarkAsRead={handleMarkAsRead}
				onMarkAllAsRead={handleMarkAllAsRead}
			/>
		</NotificationContext.Provider>
	);
}

export function useNotifications() {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error("useNotifications must be used within a NotificationProvider");
	}
	return context;
}
