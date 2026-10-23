"use client";

import { User, Construction } from "lucide-react";

export default function PessoalPage() {
	return (
		<div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto space-y-4">
			<div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
				<User size={32} />
			</div>
			<div className="space-y-2">
				<h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center justify-center gap-2">
					<span>Financeiro Pessoal</span>
					<Construction size={18} className="text-amber-500" />
				</h2>
				<p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto">
					Esta seção está em desenvolvimento e em breve contará com o gerenciamento financeiro pessoal.
				</p>
			</div>
		</div>
	);
}
