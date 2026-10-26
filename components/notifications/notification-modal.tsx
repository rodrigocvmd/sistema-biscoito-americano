"use client";

import { useEffect, useState } from "react";
import { AppNotification } from "@/types/notifications";
import {
	Bell,
	Check,
	CheckCheck,
	X,
	PackageOpen,
	AlertCircle,
	Clock,
	Inbox,
} from "lucide-react";

interface NotificationModalProps {
	isOpen: boolean;
	onClose: () => void;
	notifications: AppNotification[];
	onMarkAsRead: (id: string) => Promise<void>;
	onMarkAllAsRead: () => Promise<void>;
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 1) return "Agora mesmo";
	if (diffMinutes < 60) return `Há ${diffMinutes} min`;
	if (diffHours < 24) {
		const hoursStr = String(date.getHours()).padStart(2, "0");
		const minutesStr = String(date.getMinutes()).padStart(2, "0");
		return `Hoje às ${hoursStr}:${minutesStr}`;
	}
	if (diffDays === 1) {
		const hoursStr = String(date.getHours()).padStart(2, "0");
		const minutesStr = String(date.getMinutes()).padStart(2, "0");
		return `Ontem às ${hoursStr}:${minutesStr}`;
	}

	const d = String(date.getDate()).padStart(2, "0");
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const y = date.getFullYear();
	const hoursStr = String(date.getHours()).padStart(2, "0");
	const minutesStr = String(date.getMinutes()).padStart(2, "0");
	return `${d}/${m}/${y} às ${hoursStr}:${minutesStr}`;
}

export function NotificationModal({
	isOpen,
	onClose,
	notifications,
	onMarkAsRead,
	onMarkAllAsRead,
}: NotificationModalProps) {
	const [filter, setFilter] = useState<"all" | "unread">("all");
	const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
	const [markingAll, setMarkingAll] = useState(false);

	// Fechar modal com tecla ESC
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isOpen) {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	const unreadNotifications = notifications.filter((n) => !n.read);
	const unreadCount = unreadNotifications.length;

	const filteredNotifications =
		filter === "unread" ? unreadNotifications : notifications;

	const handleSingleMark = async (id: string) => {
		try {
			setLoadingActionId(id);
			await onMarkAsRead(id);
		} finally {
			setLoadingActionId(null);
		}
	};

	const handleMarkAll = async () => {
		try {
			setMarkingAll(true);
			await onMarkAllAsRead();
		} finally {
			setMarkingAll(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
			{/* Backdrop click to dismiss */}
			<div className="absolute inset-0" onClick={onClose} />

			{/* Modal Card */}
			<div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
							<Bell size={20} />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
									Notificações
								</h2>
								{unreadCount > 0 && (
									<span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
										{unreadCount} nova{unreadCount > 1 ? "s" : ""}
									</span>
								)}
							</div>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Avisos e alertas em tempo real do sistema
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						title="Fechar">
						<X size={20} />
					</button>
				</div>

				{/* Sub-header / Filters & Mark all */}
				<div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
					{/* Tabs */}
					<div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
						<button
							onClick={() => setFilter("all")}
							className={`cursor-pointer px-3 py-1 rounded-lg transition-all ${
								filter === "all"
									? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							Todas ({notifications.length})
						</button>
						<button
							onClick={() => setFilter("unread")}
							className={`cursor-pointer px-3 py-1 rounded-lg transition-all ${
								filter === "unread"
									? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
							}`}>
							Não lidas ({unreadCount})
						</button>
					</div>

					{/* Mark all as read */}
					{unreadCount > 0 && (
						<button
							onClick={handleMarkAll}
							disabled={markingAll}
							title="Marcar todas as notificações como lidas"
							className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-2.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50">
							<CheckCheck size={16} />
							<span>Marcar todas como lidas</span>
						</button>
					)}
				</div>

				{/* Notification List */}
				<div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y-0">
					{filteredNotifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
							<div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
								<Inbox size={36} className="text-slate-400" />
							</div>
							<div>
								<p className="font-semibold text-slate-700 dark:text-slate-300">
									{filter === "unread"
										? "Nenhuma notificação não lida"
										: "Nenhuma notificação no momento"}
								</p>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
									{filter === "unread"
										? "Todas as notificações já foram marcadas como lidas."
										: "Quando novas notificações forem emitidas, elas aparecerão aqui."}
								</p>
							</div>
						</div>
					) : (
						filteredNotifications.map((n) => {
							const isUnread = !n.read;
							const isLoadingThis = loadingActionId === n.id;

							return (
								<div
									key={n.id}
									className={`relative p-4 rounded-xl border transition-all flex items-start gap-3 group ${
										isUnread
											? "bg-blue-50/70 dark:bg-blue-950/25 border-blue-200 dark:border-blue-900/50 shadow-sm border-l-4 border-l-blue-600 dark:border-l-blue-500"
											: "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800/60 opacity-80 hover:opacity-100"
									}`}>
									{/* Notification Icon */}
									<div
										className={`p-2 rounded-xl shrink-0 mt-0.5 ${
											isUnread
												? "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
												: "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
										}`}>
										{n.type === "ultimo_pacote_aberto" ? (
											<PackageOpen size={18} />
										) : (
											<AlertCircle size={18} />
										)}
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0 pr-1">
										<div className="flex items-center gap-2 flex-wrap mb-1">
											<span
												className={`text-sm ${
													isUnread
														? "font-bold text-slate-900 dark:text-slate-100"
														: "font-semibold text-slate-600 dark:text-slate-300"
												}`}>
												{n.title}
											</span>

											{isUnread && (
												<span className="inline-block w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
											)}

											{n.storeName && (
												<span className="px-2 py-0.5 text-2xs font-bold uppercase rounded-md bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 tracking-wider">
													{n.storeName}
												</span>
											)}
										</div>

										<p
											className={`text-xs leading-relaxed ${
												isUnread
													? "text-slate-800 dark:text-slate-200"
													: "text-slate-500 dark:text-slate-400"
											}`}>
											{n.message}
										</p>

										{/* Timestamp */}
										<div className="flex items-center gap-1.5 mt-2 text-2xs text-slate-400 dark:text-slate-500">
											<Clock size={12} />
											<span>{formatRelativeTime(n.createdAt)}</span>
										</div>
									</div>

									{/* Action: Mark as read icon */}
									<div className="shrink-0 flex items-center">
										{isUnread ? (
											<button
												onClick={() => handleSingleMark(n.id)}
												disabled={isLoadingThis}
												title="Marcar como lida"
												className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs transition-all active:scale-95 disabled:opacity-50"
												aria-label="Marcar como lida">
												<Check size={16} />
											</button>
										) : (
											<div
												title="Notificação lida"
												className="p-1.5 text-slate-300 dark:text-slate-600">
												<Check size={16} />
											</div>
										)}
									</div>
								</div>
							);
						})
					)}
				</div>

				{/* Footer */}
				<div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
					<span>
						{notifications.length} notificaç{notifications.length === 1 ? "ão" : "ões"} no total
					</span>
					<button
						onClick={onClose}
						className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors">
						Fechar
					</button>
				</div>
			</div>
		</div>
	);
}
