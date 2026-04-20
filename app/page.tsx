"use client";

import Link from "next/link";
import { STORE_NAMES, StoreId } from "@/types";
import { Store, Settings } from "lucide-react";
import { seedDatabase } from "@/lib/seed";
import { useState } from "react";

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
		<main className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50">
			<div className="w-full max-w-4xl space-y-8">
				<div className="text-center space-y-2">
					<h1 className="text-4xl font-black text-red-700 tracking-tight">BISCOITO AMERICANO</h1>
					<p className="text-slate-500 font-medium">Selecione sua unidade para iniciar</p>
				</div>

				{/* Gerência Card - Password Protected */}
				<button
					onClick={() => setShowPassModal(true)}
					className="cursor-pointer group bg-white p-7 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-6 md:col-span-2 md:mx-auto md:w-[calc(50%-12px)] w-full">
					<div className="bg-blue-50 text-blue-600 p-4 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
						<Settings size={32} />
					</div>
					<div className="text-left">
						<h2 className="text-xl font-bold text-slate-800">Gerência</h2>
						<p className="text-slate-400 text-sm">Acesso administrativo</p>
					</div>
				</button>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{stores.map(([id, name]) => (
						<Link
							key={id}
							href={`/${id}/insumos`}
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

			{/* Password Modal */}
			{showPassModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
						<div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto">
							<Settings size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 text-center mb-2">Acesso Restrito</h3>
						<p className="text-slate-500 text-center font-medium mb-6">
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
								className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-2xl text-center text-2xl font-black tracking-widest focus:outline-none transition-all cursor-pointer caret-transparent ${
									passError
										? "border-red-500 animate-shake"
										: "border-slate-100 focus:border-blue-500"
								}`}
							/>
							{passError && (
								<p className="text-red-500 text-center text-xs font-bold uppercase">
									Senha Incorreta
								</p>
							)}
							<div className="flex flex-col gap-3 pt-2">
								<button
									type="submit"
									className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-100">
									Entrar
								</button>
								<button
									type="button"
									onClick={() => {
										setShowPassModal(false);
										setPassError(false);
										setPassInput("");
									}}
									className="cursor-pointer w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all">
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
