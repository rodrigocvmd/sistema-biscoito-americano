"use client";

import Link from "next/link";
import { STORE_NAMES, StoreId } from "@/types";
import { Store, Settings } from "lucide-react";
import { seedDatabase } from "@/lib/seed";

export default function Home() {
	const stores = Object.entries(STORE_NAMES) as [StoreId, string][];

	return (
		<main className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
			<div className="w-full max-w-4xl space-y-8">
				<div className="text-center space-y-2">
					<h1 className="text-4xl font-bold text-red-700 tracking-tight">BISCOITO AMERICANO</h1>
					<p className="text-slate-500 font-medium">Selecione sua unidade para iniciar</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{stores.map(([id, name]) => (
						<Link
							key={id}
							href={`/${id}/estoque`}
							className="group bg-white p-7 rounded-2xl shadow-sm border border-slate-200 hover:border-red-300 hover:shadow-md transition-all flex items-center gap-6">
							<div className="bg-red-50 text-red-600 p-4 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
								<Store size={32} />
							</div>
							<div className="text-left">
								<h2 className="text-xl font-bold text-slate-800">{name}</h2>
								<p className="text-slate-400 text-sm">Entrar na unidade</p>
							</div>
						</Link>
					))}
				</div>
			</div>
		</main>
	);
}
