"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ZoomIn, ZoomOut, LayoutDashboard, Package, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function GerenciaLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [uiScale, setUiScale] = useState(1);
	const pathname = usePathname();

	const tabs = [
		{ id: "insumos", label: "Insumos", href: "/gerencia/insumos", icon: LayoutDashboard },
		{ id: "estoque", label: "Estoque", href: "/gerencia/estoque", icon: Package },
	];

	useEffect(() => {
		const savedScale = localStorage.getItem("gerencia-ui-scale");
		if (savedScale) {
			setUiScale(parseFloat(savedScale));
		}
	}, []);

	useEffect(() => {
		// Ajusta o font-size do root para escalar tudo que usa rem (Tailwind padrão)
		// Multiplicamos por 0.85 para manter a proporção original desejada
		document.documentElement.style.fontSize = `${uiScale * 85}%`;
		localStorage.setItem("gerencia-ui-scale", uiScale.toString());
		return () => {
			document.documentElement.style.fontSize = "";
		};
	}, [uiScale]);

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col w-full transition-colors">
			{/* Header */}
			<header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm w-full print:hidden transition-colors">
				<div className="w-full mx-auto px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
					<div className="flex items-center justify-between w-full lg:w-auto">
						<div className="flex items-center gap-4">
							<Link
								href="/"
								className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
								<ChevronLeft size={24} />
							</Link>
							<div>
								<h1 className="text-2xl font-black text-blue-700 dark:text-blue-500 uppercase tracking-tight leading-none">
									GERÊNCIA
								</h1>
							</div>
						</div>

						{/* Zoom & Theme Controls for Mobile */}
						<div className="flex lg:hidden items-center gap-2">
							<ThemeToggle />
							<div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
								<button
									onClick={() => setUiScale((s) => Math.max(0.7, s - 0.1))}
									className="cursor-pointer p-2 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 rounded-lg text-slate-400 transition-all">
									<ZoomOut size={18} />
								</button>
								<span className="text-[0.8rem] font-black text-slate-600 dark:text-slate-400 w-12 text-center">
									{Math.round(uiScale * 100)}%
								</span>
								<button
									onClick={() => setUiScale((s) => Math.min(1.5, s + 0.1))}
									className="cursor-pointer p-2 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 rounded-lg text-slate-400 transition-all">
									<ZoomIn size={18} />
								</button>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-between lg:justify-end gap-4 w-full lg:w-auto">
						<div className="hidden lg:flex items-center gap-4">
							<ThemeToggle />
							{/* Zoom Controls for Desktop */}
							<div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
								<button
									onClick={() => setUiScale((s) => Math.max(0.7, s - 0.1))}
									className="cursor-pointer p-2 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 rounded-lg text-slate-400 transition-all">
									<ZoomOut size={18} />
								</button>
								<span className="text-2xs font-black text-slate-600 dark:text-slate-400 w-16 text-center">
									{Math.round(uiScale * 100)}%
								</span>
								<button
									onClick={() => setUiScale((s) => Math.min(1.5, s + 0.1))}
									className="cursor-pointer p-2 hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 rounded-lg text-slate-400 transition-all">
									<ZoomIn size={18} />
								</button>
							</div>
						</div>

						<div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
							{tabs.map((tab) => {
								const Icon = tab.icon;
								const isActive = pathname.startsWith(tab.href);
								return (
									<Link
										key={tab.id}
										href={tab.href}
										className={`flex-1 sm:flex-none cursor-pointer px-2 sm:px-4 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 sm:gap-3 ${
											isActive ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
										}`}>
										<Icon size={32} className="hidden md:inline"/> 
										<span className="sm:inline text-lg">{tab.label}</span>
									</Link>
								);
							})}
						</div>
					</div>
				</div>
			</header>

			<div className="flex-1 w-full">
				<main className="w-full mx-auto p-4 md:p-8 space-y-8">
					{children}
				</main>
			</div>
		</div>
	);
}
