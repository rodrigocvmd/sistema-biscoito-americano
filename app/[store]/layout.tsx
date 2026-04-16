import Link from "next/link";
import { STORE_NAMES, StoreId } from "@/types";
import { ChevronLeft, ClipboardList, Package } from "lucide-react";
import { notFound } from "next/navigation";

export default async function StoreLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ store: string }>;
}) {
	const { store } = await params;
	const storeName = STORE_NAMES[store as StoreId];

	if (!storeName) {
		notFound();
	}

	return (
		<div className="flex-1 flex flex-col min-h-screen bg-slate-50">
			{/* Header */}
			<header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
				<div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
					<div className="flex items-center gap-4 overflow-hidden">
						<Link
							href="/"
							className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
							<ChevronLeft size={24} />
						</Link>
						<div className="overflow-hidden">
							<h1 className="text-xl font-extrabold text-red-700 truncate">
								{storeName.toUpperCase()}
							</h1>
							<p className="text-[10px] font-bold text-slate-400 -mt-1 tracking-widest">
								SISTEMA BISCOITO AMERICANO
							</p>
						</div>
					</div>
          <nav className="max-w-5xl px-4 flex gap-8">
					<TabLink href={`/${store}/estoque`} icon={<ClipboardList size={20} />} label="Estoque" />
					<TabLink href={`/${store}/insumos`} icon={<Package size={20} />} label="Insumos" />
				</nav>
				</div>

				{/* Navigation Tabs */}
				
			</header>

			<main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 pb-20">{children}</main>
		</div>
	);
}

function TabLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
	return (
		<Link
			href={href}
			className="flex items-center gap-2 py-4 border-b-2 border-transparent hover:text-blue-600 transition-all font-semibold text-slate-500"
			// Note: In a real app, you'd use usePathname to highlight the active tab
		>
			{icon}
			<span className="text-lg">{label}</span>
		</Link>
	);
}
