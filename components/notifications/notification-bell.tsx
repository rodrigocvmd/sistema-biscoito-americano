"use client";

import { Bell } from "lucide-react";
import { useNotifications } from "./notification-provider";

interface NotificationBellProps {
	iconSize?: number;
	className?: string;
	variant?: "red" | "blue";
}

export function NotificationBell({
	iconSize = 18,
	className = "",
	variant = "red",
}: NotificationBellProps) {
	const { openModal, hasUnread, unreadCount } = useNotifications();

	const hoverColorClass =
		variant === "blue"
			? "hover:text-blue-600 dark:hover:text-blue-400"
			: "hover:text-red-600 dark:hover:text-red-400";

	return (
		<button
			type="button"
			onClick={openModal}
			title={
				hasUnread
					? `${unreadCount} notificaç${unreadCount === 1 ? "ão não lida" : "ões não lidas"}`
					: "Notificações do Sistema"
			}
			aria-label="Abrir notificações"
			className={`relative cursor-pointer p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-all flex items-center justify-center shrink-0 ${hoverColorClass} ${className}`}>
			<div className="relative inline-flex items-center justify-center">
				<Bell size={iconSize} />
				{hasUnread && (
					<span
						className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
						title={`${unreadCount} não lida(s)`}>
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white dark:ring-slate-800" />
					</span>
				)}
			</div>
		</button>
	);
}
