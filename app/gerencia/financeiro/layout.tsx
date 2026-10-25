"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, User, Calculator, LayoutDashboard } from "lucide-react";

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	useEffect(() => {
		if (typeof window !== "undefined") {
			if ("scrollRestoration" in window.history) {
				window.history.scrollRestoration = "manual";
			}
			window.scrollTo(0, 0);
			document.documentElement.scrollTop = 0;
			document.body.scrollTop = 0;

			const timer1 = setTimeout(() => {
				window.scrollTo(0, 0);
				document.documentElement.scrollTop = 0;
				document.body.scrollTop = 0;
			}, 50);

			const timer2 = setTimeout(() => {
				window.scrollTo(0, 0);
				document.documentElement.scrollTop = 0;
				document.body.scrollTop = 0;
			}, 250);

			return () => {
				clearTimeout(timer1);
				clearTimeout(timer2);
			};
		}
	}, [pathname]);

	const tabs = [
		{ id: "controle", label: "Controle", href: "/gerencia/financeiro/Controle", icon: LayoutDashboard },
		{ id: "folha", label: "Folha", href: "/gerencia/financeiro/folha", icon: FileSpreadsheet },
		{ id: "pessoal", label: "Pessoal", href: "/gerencia/financeiro/Pessoal", icon: User },
		{ id: "calculadora", label: "Calculadora", href: "/gerencia/financeiro/calculadora", icon: Calculator },
	];

	return (
		<div className="space-y-6">
			{/* Sub-abas de Financeiro */}
			<div className="bg-white dark:bg-slate-900 p-1.5 md:p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-1.5 md:gap-2 w-full max-w-xl mx-auto print:hidden transition-colors">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const isActive =
						tab.id === "controle"
							? pathname.toLowerCase().startsWith("/gerencia/financeiro/controle")
							: tab.id === "folha"
							? pathname === "/gerencia/financeiro" || pathname.startsWith("/gerencia/financeiro/folha")
							: pathname.toLowerCase().startsWith(tab.href.toLowerCase());

					return (
						<Link
							key={tab.id}
							href={tab.href}
							className={`cursor-pointer flex-1 text-center px-2.5 py-2 md:px-4 md:py-2.5 rounded-xl text-xs md:text-sm font-black tracking-wide whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
								isActive
									? "bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none"
									: "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
							}`}>
							<Icon size={16} />
							<span>{tab.label}</span>
						</Link>
					);
				})}
			</div>

			{children}
		</div>
	);
}
