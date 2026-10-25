"use client";

import { useEffect, useState } from "react";
import { StoreId, STORE_NAMES } from "@/types";
import { LojaInfo, DEFAULT_LOJA_INFO, LojasInfoMap } from "@/types/lojas-info";
import { subscribeLojasInfo, updateLojaInfo, getInitialLojasInfo } from "@/lib/lojas-info-service";
import {
	Building2,
	Pencil,
	X,
	Save,
	Phone,
	Mail,
	MapPin,
	FileText,
	Smartphone,
	Wifi,
	Globe,
	Loader2,
	CheckCircle2,
	Copy,
	Check,
} from "lucide-react";

const STORES: { id: StoreId; name: string }[] = [
	{ id: "lago", name: "Lago" },
	{ id: "terraco", name: "Terraço" },
	{ id: "conjunto", name: "Conjunto" },
	{ id: "noroeste", name: "Noroeste" },
];

interface InfoFieldConfig {
	key: keyof LojaInfo;
	label: string;
	icon: any;
	placeholder: string;
	type?: string;
}

const INFO_FIELDS: InfoFieldConfig[] = [
	{ key: "razaoSocial", label: "Razão Social", icon: Building2, placeholder: "Ex: Biscoito Americano Eireli" },
	{ key: "cnpj", label: "CNPJ", icon: FileText, placeholder: "00.000.000/0000-00" },
	{ key: "telefone", label: "Telefone", icon: Phone, placeholder: "(61) 90000-0000" },
	{ key: "endereco", label: "Endereço", icon: MapPin, placeholder: "Logradouro, número, complemento" },
	{ key: "cep", label: "CEP", icon: MapPin, placeholder: "00000-000" },
	{ key: "email", label: "Email", icon: Mail, placeholder: "contato@loja.com.br", type: "email" },
	{ key: "gmail", label: "Gmail", icon: Globe, placeholder: "loja@gmail.com", type: "email" },
	{ key: "operadoraCelular", label: "Operadora Celular", icon: Smartphone, placeholder: "Ex: Vivo, Claro" },
	{ key: "provedorInternet", label: "Provedor Internet", icon: Wifi, placeholder: "Ex: Claro Fibra, Oi" },
];

export default function InformacoesPage() {
	const [activeStore, setActiveStore] = useState<StoreId>("lago");
	const [storesData, setStoresData] = useState<LojasInfoMap>(getInitialLojasInfo());
	const [isLoading, setIsLoading] = useState(true);

	// Modal State
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editingStore, setEditingStore] = useState<StoreId>("lago");
	const [formData, setFormData] = useState<LojaInfo>({ ...DEFAULT_LOJA_INFO });
	const [isSaving, setIsSaving] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);

	// Copy feedback state
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

	useEffect(() => {
		const unsubscribe = subscribeLojasInfo((data) => {
			setStoresData(data);
			setIsLoading(false);
		});

		return () => unsubscribe();
	}, []);

	const currentInfo = storesData[activeStore] || DEFAULT_LOJA_INFO;

	const handleOpenEdit = (storeId: StoreId) => {
		setEditingStore(storeId);
		setFormData({ ...(storesData[storeId] || DEFAULT_LOJA_INFO) });
		setIsEditModalOpen(true);
		setSaveSuccess(false);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			setIsSaving(true);
			await updateLojaInfo(editingStore, formData);
			setSaveSuccess(true);
			setTimeout(() => {
				setIsEditModalOpen(false);
				setSaveSuccess(false);
			}, 700);
		} catch (error) {
			console.error("Erro ao salvar informações da loja:", error);
			alert("Ocorreu um erro ao salvar as informações.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="max-w-5xl mx-auto space-y-6">
			{/* Cabeçalho da Seção */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
				<div>
					<div className="flex items-center gap-3">
						<div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
							<Building2 size={24} />
						</div>
						<div>
							<h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
								Informações das Lojas
							</h1>
							<p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
								Dados cadastrais, contato e infraestrutura de cada unidade
							</p>
						</div>
					</div>
				</div>

				<button
					onClick={() => handleOpenEdit(activeStore)}
					className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all">
					<Pencil size={16} />
					<span>Editar Loja {STORE_NAMES[activeStore]}</span>
				</button>
			</div>

			{/* Abas das Lojas */}
			<div className="flex bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 gap-1.5 w-full">
				{STORES.map((store) => {
					const isActive = activeStore === store.id;
					return (
						<button
							key={store.id}
							onClick={() => setActiveStore(store.id)}
							className={`cursor-pointer flex-1 py-3 px-3 rounded-xl font-black text-sm tracking-wide transition-all text-center flex items-center justify-center gap-2 ${
								isActive
									? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
							}`}>
							<span>{store.name}</span>
						</button>
					);
				})}
			</div>

			{/* Conteúdo Principal / Tabela de Informações */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
				<div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
					<span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
						Informações Gerais • {STORE_NAMES[activeStore]}
					</span>
					<button
						onClick={() => handleOpenEdit(activeStore)}
						title="Editar informações"
						className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all">
						<Pencil size={18} />
					</button>
				</div>

				{isLoading ? (
					<div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
						<Loader2 size={32} className="animate-spin text-blue-600" />
						<p className="text-sm font-medium">Carregando informações...</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30">
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
															<span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-opacity">
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

			{/* Modal de Edição */}
			{isEditModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
						{/* Cabeçalho Modal */}
						<div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
							<div className="flex items-center gap-3">
								<div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
									<Pencil size={20} />
								</div>
								<div>
									<h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
										Editar Informações • {STORE_NAMES[editingStore]}
									</h2>
									<p className="text-xs text-slate-500 dark:text-slate-400">
										Altere os campos cadastrais desta unidade
									</p>
								</div>
							</div>
							<button
								onClick={() => setIsEditModalOpen(false)}
								className="cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
								<X size={20} />
							</button>
						</div>

						{/* Form Body */}
						<form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{INFO_FIELDS.map((field) => {
									const Icon = field.icon;
									return (
										<div
											key={field.key}
											className={
												field.key === "endereco" || field.key === "razaoSocial"
													? "md:col-span-2"
													: ""
											}>
											<label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
												<Icon size={14} className="text-slate-400" />
												<span>{field.label}</span>
											</label>
											<input
												type={field.type || "text"}
												value={formData[field.key] || ""}
												placeholder={field.placeholder}
												onChange={(e) =>
													setFormData({ ...formData, [field.key]: e.target.value })
												}
												className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
											/>
										</div>
									);
								})}
							</div>

							{/* Rodapé / Ações */}
							<div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
								<button
									type="button"
									disabled={isSaving}
									onClick={() => setIsEditModalOpen(false)}
									className="cursor-pointer px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
									Cancelar
								</button>
								<button
									type="submit"
									disabled={isSaving}
									className="cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all">
									{isSaving ? (
										<>
											<Loader2 size={16} className="animate-spin" />
											<span>Salvando...</span>
										</>
									) : saveSuccess ? (
										<>
											<CheckCircle2 size={16} className="text-emerald-300" />
											<span>Salvo!</span>
										</>
									) : (
										<>
											<Save size={16} />
											<span>Salvar Informações</span>
										</>
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
