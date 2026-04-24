"use client";

import Link from "next/link";
import { STORE_NAMES, StoreId } from "@/types";
import { ChevronLeft, ClipboardList, Package, ZoomIn, ZoomOut } from "lucide-react";
import { notFound, usePathname } from "next/navigation";
import { use, useState, useEffect } from "react";

export default function StoreLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ store: string }>;
}) {
	const { store } = use(params);
	const storeName = STORE_NAMES[store as StoreId];
	const [uiScale, setUiScale] = useState(1);
	const pathname = usePathname();

	if (!storeName) {
		notFound();
	}

	useEffect(() => {
		const savedScale = localStorage.getItem("store-ui-scale");
		if (savedScale) {
			setUiScale(parseFloat(savedScale));
		}
	}, []);

	useEffect(() => {
		// Ajusta o font-size do root para escalar tudo que usa rem
		document.documentElement.style.fontSize = `${uiScale * 85}%`;
		localStorage.setItem("store-ui-scale", uiScale.toString());
		return () => {
			document.documentElement.style.fontSize = "";
		};
	}, [uiScale]);

	return (
		<div className="flex-1 flex flex-col min-h-screen bg-slate-50">
			{/* Header */}
			<header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
				<div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div className="flex items-center justify-between w-full sm:w-auto">
						<div className="flex items-center gap-4 py-4 overflow-hidden">
							<Link
								href="/"
								className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors shrink-0">
								<ChevronLeft size={24} />
							</Link>
							<div className="overflow-hidden">
								<h1 id="h1" className="text-xl font-extrabold text-red-700 truncate">
									{storeName.toUpperCase()}
								</h1>
								<p className="text-[10px] font-bold text-slate-400 -mt-1 tracking-widest">
									SISTEMA BISCOITO AMERICANO
								</p>
							</div>
						</div>

						{/* Zoom Controls for Mobile */}
						<div className="flex sm:hidden items-center bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
							<button
								onClick={() => setUiScale((s) => Math.max(0.7, s - 0.1))}
								className="cursor-pointer p-1.5 hover:bg-white hover:text-red-600 rounded-lg text-slate-400 transition-all">
								<ZoomOut size={16} />
							</button>
							<span className="text-[10px] font-black text-slate-600 w-10 text-center">
								{Math.round(uiScale * 100)}%
							</span>
							<button
								onClick={() => setUiScale((s) => Math.min(1.5, s + 0.1))}
								className="cursor-pointer p-1.5 hover:bg-white hover:text-red-600 rounded-lg text-slate-400 transition-all">
								<ZoomIn size={16} />
							</button>
						</div>
					</div>

					<div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
						{/* Zoom Controls for Desktop */}
						<div className="hidden sm:flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm h-fit my-auto">
							<button
								onClick={() => setUiScale((s) => Math.max(0.7, s - 0.1))}
								className="cursor-pointer p-1.5 hover:bg-white hover:text-red-600 rounded-lg text-slate-400 transition-all">
								<ZoomOut size={16} />
							</button>
							<span className="text-[10px] font-black text-slate-600 w-12 text-center">
								{Math.round(uiScale * 100)}%
							</span>
							<button
								onClick={() => setUiScale((s) => Math.min(1.5, s + 0.1))}
								className="cursor-pointer p-1.5 hover:bg-white hover:text-red-600 rounded-lg text-slate-400 transition-all">
								<ZoomIn size={16} />
							</button>
						</div>

						<nav id="estoqueInsumosBtn" className="flex gap-6 sm:gap-8 border-t sm:border-t-0 border-slate-100 justify-center sm:justify-start flex-1 sm:flex-none">
							<TabLink href={`/${store}/insumos`} icon={<Package size={20} />} label="Insumos" active={pathname.includes("/insumos")} />
							<TabLink href={`/${store}/estoque`} icon={<ClipboardList size={20} />} label="Estoque" active={pathname.includes("/estoque")} />
						</nav>
					</div>
				</div>
			</header>

			<main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 pb-20">{children}</main>
		</div>
	);
}

function TabLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string, active: boolean }) {
	return (
		<Link
			href={href}
			className={`flex items-center gap-2 py-4 border-b-2 transition-all font-semibold ${
				active ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-red-600"
			}`}
		>
			{icon}
			<span className="text-lg">{label}</span>
		</Link>
	);
}
