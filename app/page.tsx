"use client";

import Link from "next/link";
import { STORE_NAMES, StoreId } from "@/types";
import { Store, Settings } from "lucide-react";
import { seedDatabase } from "@/lib/seed";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
	const stores = Object.entries(STORE_NAMES) as [StoreId, string][];

	const [showPassModal, setShowPassModal] = useState(false);
	const [passInput, setPassInput] = useState("");
	const [passError, setPassError] = useState(false);

	const handleGerenciaAccess = (e: React.FormEvent) => {
		e.preventDefault();
		if (passInput === "4572") {
			window.location.href = "/gerencia";
		} else {
			setPassError(true);
			setPassInput("");
		}
	};

	return (
		<main className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors relative">
			<div className="absolute top-6 right-6">
				<ThemeToggle />
			</div>
			
			<div className="w-full max-w-4xl space-y-8">
				<div className="text-center space-y-2">
					<h1 className="text-4xl font-black text-red-700 dark:text-red-500 tracking-tight">BISCOITO AMERICANO</h1>
					<p className="text-slate-500 dark:text-slate-400 font-medium">Selecione sua unidade para iniciar</p>
				</div>

				{/* Gerência Card - Password Protected */}
				<button
					onClick={() => setShowPassModal(true)}
					className="cursor-pointer group bg-white dark:bg-slate-900 p-7 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all flex items-center gap-6 md:col-span-2 md:mx-auto md:w-[calc(50%-12px)] w-full">
					<div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-4 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
						<Settings size={32} />
					</div>
					<div className="text-left">
						<h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Gerência</h2>
						<p className="text-slate-400 dark:text-slate-500 text-sm">Acesso administrativo</p>
					</div>
				</button>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{stores.map(([id, name]) => (
						<Link
							key={id}
							href={`/${id}/insumos`}
							className="group bg-white dark:bg-slate-900 p-7 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all flex items-center gap-6">
							<div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
								<Store size={32} />
							</div>
							<div className="text-left">
								<h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{name}</h2>
								<p className="text-slate-400 dark:text-slate-500 text-sm">Entrar na unidade</p>
							</div>
						</Link>
					))}
				</div>
			</div>

			{/* Password Modal */}
			{showPassModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<Settings size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-200 text-center mb-2">Acesso Restrito</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium mb-6">
							Digite a senha de gerência para prosseguir
						</p>
						<form onSubmit={handleGerenciaAccess} className="space-y-4">
							<input
								type="password"
								inputMode="numeric"
								pattern="[0-9]*"
								autoFocus
								value={passInput}
								onChange={(e) => {
									setPassInput(e.target.value.replace(/\D/g, ""));
									setPassError(false);
								}}
								placeholder="Insira a senha"
								className={`w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl text-center text-2xl font-black tracking-widest focus:outline-none transition-all cursor-pointer caret-transparent ${
									passError
										? "border-red-500 animate-shake"
										: "border-slate-100 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 text-slate-800 dark:text-slate-200"
								}`}
							/>
							{passError && (
								<p className="text-red-500 dark:text-red-400 text-center text-xs font-bold uppercase">
									Senha Incorreta
								</p>
							)}
							<div className="flex flex-col gap-3 pt-2">
								<button
									type="submit"
									className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-100 dark:shadow-none">
									Entrar
								</button>
								<button
									type="button"
									onClick={() => {
										setShowPassModal(false);
										setPassError(false);
										setPassInput("");
									}}
									className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-black py-4 rounded-2xl transition-all">
									Cancelar
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</main>
	);
}
