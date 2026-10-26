"use client";

import { use, useEffect, useState } from "react";
import { StoreId, STORE_NAMES } from "@/types";
import { LojaInfo, DEFAULT_LOJA_INFO, LojasInfoMap } from "@/types/lojas-info";
import { subscribeLojasInfo, getInitialLojasInfo } from "@/lib/lojas-info-service";
import {
	Building2,
	Phone,
	Mail,
	MapPin,
	FileText,
	Smartphone,
	Wifi,
	Globe,
	Loader2,
	Copy,
	Check,
	ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface InfoFieldConfig {
	key: keyof LojaInfo;
	label: string;
	icon: any;
	placeholder: string;
}

const INFO_FIELDS: InfoFieldConfig[] = [
	{ key: "razaoSocial", label: "Razão Social", icon: Building2, placeholder: "Não informado" },
	{ key: "cnpj", label: "CNPJ", icon: FileText, placeholder: "00.000.000/0000-00" },
	{ key: "telefone", label: "Telefone", icon: Phone, placeholder: "(61) 90000-0000" },
	{ key: "endereco", label: "Endereço", icon: MapPin, placeholder: "Logradouro, número, complemento" },
	{ key: "cep", label: "CEP", icon: MapPin, placeholder: "00000-000" },
	{ key: "email", label: "Email", icon: Mail, placeholder: "contato@loja.com.br" },
	{ key: "gmail", label: "Gmail", icon: Globe, placeholder: "loja@gmail.com" },
	{ key: "operadoraCelular", label: "Operadora Celular", icon: Smartphone, placeholder: "Ex: Vivo, Claro" },
	{ key: "provedorInternet", label: "Provedor Internet", icon: Wifi, placeholder: "Ex: Claro Fibra, Oi" },
];

export default function StoreInformacoesPage({
	params,
}: {
	params: Promise<{ store: string }>;
}) {
	const { store } = use(params);
	const storeId = store as StoreId;
	const storeName = STORE_NAMES[storeId];

	const [storesData, setStoresData] = useState<LojasInfoMap>(getInitialLojasInfo());
	const [isLoading, setIsLoading] = useState(true);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	if (!storeName) {
		notFound();
	}

	useEffect(() => {
		const unsubscribe = subscribeLojasInfo((data) => {
			setStoresData(data);
			setIsLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const currentInfo = storesData[storeId] || DEFAULT_LOJA_INFO;

	const handleCopy = async (key: string, text: string) => {
		if (!text || !text.trim()) return;
		try {
			await navigator.clipboard.writeText(text.trim());
			setCopiedKey(key);
			setTimeout(() => {
				setCopiedKey((curr) => (curr === key ? null : curr));
			}, 2000);
		} catch (err) {
			console.error("Erro ao copiar texto:", err);
		}
	};

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			{/* Cabeçalho */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
				<div className="flex items-center gap-4">
					<Link
						href={`/${store}/insumos`}
						title="Voltar"
						className="cursor-pointer p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
						<ArrowLeft size={20} />
					</Link>
					<div className="flex items-center gap-3">
						<div className="p-2.5 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl">
							<Building2 size={24} />
						</div>
						<div>
							<h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
								Informações • {storeName}
							</h1>
							<p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
								Dados cadastrais, contato e infraestrutura desta unidade
							</p>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<span className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold text-xs border border-red-200/60 dark:border-red-900/50">
						Unidade {storeName}
					</span>
				</div>
			</div>

			{/* Conteúdo Principal / Tabela de Informações */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
				<div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
					<span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
						Informações Gerais Cadastradas
					</span>
					<span className="text-xs text-slate-400 dark:text-slate-500">
						Clique sobre qualquer informação para copiar
					</span>
				</div>

				{isLoading ? (
					<div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
						<Loader2 size={32} className="animate-spin text-red-600" />
						<p className="text-sm font-medium">Carregando informações da unidade...</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50/30 dark:bg-slate-800/20">
									<th className="py-3 px-6 w-1/3">Campo</th>
									<th className="py-3 px-6">Informação</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
								{INFO_FIELDS.map((field) => {
									const Icon = field.icon;
									const val = currentInfo[field.key];
									const hasValue = Boolean(val && val.trim() !== "");

									return (
										<tr
											key={field.key}
											className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
											<td className="py-4 px-6 text-sm font-bold text-slate-700 dark:text-slate-300">
												<div className="flex items-center gap-3">
													<div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
														<Icon size={16} />
													</div>
													<span>{field.label}</span>
												</div>
											</td>
											<td className="py-4 px-6 text-sm">
												{hasValue ? (
													<button
														type="button"
														onClick={() => handleCopy(field.key, val)}
														title="Clique para copiar"
														className="cursor-pointer group inline-flex items-center gap-2.5 py-1 px-2.5 -ml-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-left">
														<span className="font-semibold text-slate-800 dark:text-slate-200">
															{val}
														</span>
														{copiedKey === field.key ? (
															<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in fade-in zoom-in-95 duration-150">
																<Check size={13} />
																<span>Copiado!</span>
															</span>
														) : (
															<span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity">
																<Copy size={14} />
															</span>
														)}
													</button>
												) : (
													<span className="text-slate-400 dark:text-slate-600 italic font-normal text-xs">
														(Não informado)
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
