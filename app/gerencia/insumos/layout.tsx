"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function InsumosLayout({ children }: { children: React.ReactNode }) {
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
		{ id: "lojas", label: "LOJAS", href: "/gerencia/insumos/lojas" },
		{ id: "pedidos", label: "PEDIDOS", href: "/gerencia/insumos/pedidos" },
		{ id: "lista", label: "LISTA", href: "/gerencia/insumos/lista" },
	];

	return (
		<div className="space-y-6">
			{/* Tab Selector */}
			<div className="bg-white dark:bg-slate-900 p-1.5 md:p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-1.5 md:gap-2 max-w-full overflow-x-auto w-full md:w-fit mx-auto print:hidden transition-colors justify-start md:justify-center">
				{tabs.map((tab) => {
					const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
					return (
						<Link
							key={tab.id}
							href={tab.href}
							className={`cursor-pointer px-4 py-2 md:px-6 md:py-2.5 rounded-xl text-xs md:text-sm font-black tracking-wide whitespace-nowrap shrink-0 transition-all ${
								isActive
									? "bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none"
									: "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
							}`}>
							{tab.label}
						</Link>
					);
				})}
			</div>

			{children}
		</div>
	);
}
