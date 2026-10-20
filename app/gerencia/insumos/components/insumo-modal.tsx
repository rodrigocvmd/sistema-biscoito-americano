import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
	InsumoCatalogItem,
	InsumoResponsavel,
	InsumoLocalCompraItem,
	RESPONSAVEIS_COMPRA,
	parseLocaisCompra,
	formatLocalCompraString,
	sanitizeExternalUrl,
} from "@/lib/insumos-data";
import { ResponsavelTag, ResponsavelTagsList } from "./responsavel-tag";
import {
	X,
	Edit3,
	Check,
	ExternalLink,
	Store,
	DollarSign,
	Tag,
	FileText,
	Plus,
	Trash2,
	RefreshCw,
	UserCheck,
	Info,
	CheckCircle2,
} from "lucide-react";

interface InsumoModalProps {
	isOpen: boolean;
	onClose: () => void;
	item: InsumoCatalogItem | null;
	initialEditing?: boolean;
	onSaved?: (updatedItem: InsumoCatalogItem) => void;
}

export function InsumoModal({
	isOpen,
	onClose,
	item,
	initialEditing = false,
	onSaved,
}: InsumoModalProps) {
	const [isEditing, setIsEditing] = useState(initialEditing);
	const [isSaving, setIsSaving] = useState(false);

	// Editable form state
	const [valorBom, setValorBom] = useState("");
	const [valorMaximo, setValorMaximo] = useState("");
	const [marca, setMarca] = useState("");
	const [observacoes, setObservacoes] = useState("");
	const [responsaveis, setResponsaveis] = useState<InsumoResponsavel[]>([]);
	const [locaisCompra, setLocaisCompra] = useState<InsumoLocalCompraItem[]>([]);

	// Initialize form when item changes or modal opens
	useEffect(() => {
		if (item) {
			setValorBom(item.valorBom || "");
			setValorMaximo(item.valorMaximo || "");
			setMarca(item.marca || "");
			setObservacoes(item.observacoes || "");
			setResponsaveis(item.responsaveis ? [...item.responsaveis] : []);
			const parsedLocais = parseLocaisCompra(item);
			setLocaisCompra(parsedLocais.length > 0 ? parsedLocais : [{ nome: "", url: "" }]);
			setIsEditing(initialEditing);
		}
	}, [item, isOpen, initialEditing]);

	if (!isOpen || !item) return null;

	// Toggle responsible person
	const handleToggleResponsavel = (nome: InsumoResponsavel) => {
		setResponsaveis((prev) =>
			prev.includes(nome) ? prev.filter((r) => r !== nome) : [...prev, nome]
		);
	};

	// Local de compra helpers
	const handleAddLocal = () => {
		setLocaisCompra((prev) => [...prev, { nome: "", url: "" }]);
	};

	const handleUpdateLocal = (index: number, field: "nome" | "url", value: string) => {
		setLocaisCompra((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	};

	const handleRemoveLocal = (index: number) => {
		setLocaisCompra((prev) => {
			const next = prev.filter((_, i) => i !== index);
			return next.length > 0 ? next : [{ nome: "", url: "" }];
		});
	};

	// Save to Firestore
	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!item) return;

		setIsSaving(true);
		try {
			const cleanLocais = locaisCompra
				.map((l) => ({ nome: l.nome.trim(), url: l.url ? l.url.trim() : "" }))
				.filter((l) => l.nome || l.url);

			const formattedLocalString = formatLocalCompraString(cleanLocais);

			const updatedData: InsumoCatalogItem = {
				...item,
				valorBom: valorBom.trim(),
				valorMaximo: valorMaximo.trim(),
				marca: marca.trim(),
				observacoes: observacoes.trim(),
				responsaveis,
				locaisCompra: cleanLocais,
				localCompra: formattedLocalString,
				updatedAt: serverTimestamp(),
			};

			const itemRef = doc(db, "insumosCatalog", item.id);
			await setDoc(itemRef, updatedData, { merge: true });

			if (onSaved) {
				onSaved(updatedData);
			}

			setIsEditing(false);
		} catch (error) {
			console.error("Erro ao salvar parâmetros do insumo:", error);
			alert("Ocorreu um erro ao salvar as alterações do insumo.");
		} finally {
			setIsSaving(false);
		}
	};

	const currentLocais = parseLocaisCompra(item);

	return (
		<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 my-auto transition-all">
				{/* Top Bar / Header */}
				<div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<span className="px-2.5 py-0.5 rounded-md text-2xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
								{item.category}
							</span>
							{isEditing && (
								<span className="px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
									Editando
								</span>
							)}
						</div>
						<h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
							{item.name}
						</h2>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						{!isEditing ? (
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-800/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
								title="Editar parâmetros deste insumo">
								<Edit3 size={14} />
								<span>Editar</span>
							</button>
						) : (
							<button
								type="button"
								onClick={() => {
									// Reset back to original item data
									setValorBom(item.valorBom || "");
									setValorMaximo(item.valorMaximo || "");
									setMarca(item.marca || "");
									setObservacoes(item.observacoes || "");
									setResponsaveis(item.responsaveis ? [...item.responsaveis] : []);
									const parsed = parseLocaisCompra(item);
									setLocaisCompra(parsed.length > 0 ? parsed : [{ nome: "", url: "" }]);
									setIsEditing(false);
								}}
								className="cursor-pointer px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors">
								Cancelar
							</button>
						)}

						<button
							type="button"
							onClick={onClose}
							className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
							<X size={20} />
						</button>
					</div>
				</div>

				{/* Content: View Mode vs Edit Mode */}
				{!isEditing ? (
					/* ==================== VIEW MODE ==================== */
					<div className="space-y-5 text-sm">
						{/* Responsável pela compra */}
						<div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
							<span className="text-2xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
								<UserCheck size={14} className="text-slate-400" />
								Responsável(is) pela Compra
							</span>
							<div>
								<ResponsavelTagsList
									responsaveis={item.responsaveis}
									emptyText="Nenhum responsável configurado para este insumo."
								/>
							</div>
						</div>

						{/* Preços: Valor Bom e Valor Máximo */}
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 p-4 rounded-2xl space-y-1">
								<span className="text-2xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
									<DollarSign size={13} />
									Valor Bom
								</span>
								<div className="text-base font-black text-emerald-700 dark:text-emerald-300">
									{item.valorBom || (
										<span className="text-xs font-medium text-slate-400 italic">
											Não informado
										</span>
									)}
								</div>
							</div>

							<div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 p-4 rounded-2xl space-y-1">
								<span className="text-2xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1">
									<DollarSign size={13} />
									Valor Máximo
								</span>
								<div className="text-base font-black text-amber-700 dark:text-amber-300">
									{item.valorMaximo || (
										<span className="text-xs font-medium text-slate-400 italic">
											Não informado
										</span>
									)}
								</div>
							</div>
						</div>

						{/* Local de Compra */}
						<div className="space-y-2">
							<span className="text-2xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
								<Store size={14} />
								Local de Compra
							</span>
							{currentLocais.length > 0 ? (
								<div className="flex flex-col gap-2">
									{currentLocais.map((loc, idx) => {
										const hasUrl = !!loc.url?.trim();
										if (hasUrl) {
											return (
												<a
													key={idx}
													href={sanitizeExternalUrl(loc.url)}
													target="_blank"
													rel="noopener noreferrer"
													className="group flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-blue-700 dark:text-blue-300">
													<div className="flex items-center gap-2">
														<Store size={15} className="shrink-0 text-blue-500" />
														<span className="font-bold text-xs md:text-sm">
															{loc.nome || "Link de compra"}
														</span>
													</div>
													<div className="flex items-center gap-1 text-2xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
														<span>Acessar</span>
														<ExternalLink size={13} />
													</div>
												</a>
											);
										}

										return (
											<div
												key={idx}
												className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300">
												<Store size={15} className="text-slate-400 shrink-0" />
												<span className="font-bold text-xs md:text-sm">{loc.nome}</span>
											</div>
										);
									})}
								</div>
							) : (
								<div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-400 italic">
									Local de compra não informado
								</div>
							)}
						</div>

						{/* Marca Recomendada */}
						<div className="space-y-1.5">
							<span className="text-2xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
								<Tag size={14} />
								Marca Recomendada
							</span>
							<div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs md:text-sm">
								{item.marca || (
									<span className="text-slate-400 font-normal italic">Não informada</span>
								)}
							</div>
						</div>

						{/* Observações */}
						<div className="space-y-1.5">
							<span className="text-2xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
								<FileText size={14} />
								Observações
							</span>
							<div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs md:text-sm leading-relaxed whitespace-pre-wrap">
								{item.observacoes || (
									<span className="text-slate-400 italic">Sem observações registradas.</span>
								)}
							</div>
						</div>

						{/* Footer Close Button */}
						<div className="pt-2 flex justify-end">
							<button
								type="button"
								onClick={onClose}
								className="cursor-pointer px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors">
								Fechar
							</button>
						</div>
					</div>
				) : (
					/* ==================== EDIT MODE ==================== */
					<form onSubmit={handleSave} className="space-y-5">
						{/* Seletor de Responsáveis */}
						<div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
							<label className="block text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
								Responsável(is) pela Compra
							</label>
							<p className="text-2xs text-slate-400">
								Clique para selecionar quem é responsável por comprar este insumo:
							</p>
							<div className="flex flex-wrap gap-2 pt-1">
								{RESPONSAVEIS_COMPRA.map((nome) => {
									const isSelected = responsaveis.includes(nome);
									return (
										<ResponsavelTag
											key={nome}
											nome={nome}
											size="md"
											selected={isSelected}
											onClick={() => handleToggleResponsavel(nome)}
										/>
									);
								})}
							</div>
						</div>

						{/* Valores de Referência */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label className="block text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
									Valor Bom (R$)
								</label>
								<input
									type="text"
									placeholder="Ex: R$ 45,00"
									value={valorBom}
									onChange={(e) => setValorBom(e.target.value)}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
									Valor Máximo (R$)
								</label>
								<input
									type="text"
									placeholder="Ex: R$ 55,00"
									value={valorMaximo}
									onChange={(e) => setValorMaximo(e.target.value)}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						</div>

						{/* Local de Compra Dinâmico com URLs */}
						<div className="space-y-2.5">
							<div className="flex items-center justify-between">
								<div>
									<label className="block text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
										Local(is) de Compra
									</label>
									<span className="text-2xs text-slate-400">
										Insira o nome e, se houver, o link direto do produto/loja:
									</span>
								</div>
								<button
									type="button"
									onClick={handleAddLocal}
									className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
									<Plus size={13} />
									<span>Adicionar local</span>
								</button>
							</div>

							<div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
								{locaisCompra.map((loc, idx) => (
									<div
										key={idx}
										className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 relative group">
										<div className="flex items-center gap-2">
											<input
												type="text"
												placeholder="Nome do local (ex: Sam's Club, Mercado Livre...)"
												value={loc.nome}
												onChange={(e) => handleUpdateLocal(idx, "nome", e.target.value)}
												className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
											/>
											{locaisCompra.length > 1 && (
												<button
													type="button"
													onClick={() => handleRemoveLocal(idx)}
													className="cursor-pointer p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
													title="Remover este local">
													<Trash2 size={15} />
												</button>
											)}
										</div>

										<div className="flex items-center gap-2">
											<input
												type="text"
												placeholder="Link / URL da compra (ex: https://...)"
												value={loc.url || ""}
												onChange={(e) => handleUpdateLocal(idx, "url", e.target.value)}
												className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:font-sans"
											/>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Marca Recomendada */}
						<div>
							<label className="block text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
								Marca Recomendada
							</label>
							<input
								type="text"
								placeholder="Ex: Ferrero, Nestlé, Coca-Cola..."
								value={marca}
								onChange={(e) => setMarca(e.target.value)}
								className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						{/* Observações */}
						<div>
							<label className="block text-2xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
								Observações
							</label>
							<textarea
								rows={3}
								placeholder="Ex: Fardo lacrado c/ 12 un, comprar tamanho P..."
								value={observacoes}
								onChange={(e) => setObservacoes(e.target.value)}
								className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs md:text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
							/>
						</div>

						{/* Form Actions */}
						<div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
								Cancelar
							</button>
							<button
								type="submit"
								disabled={isSaving}
								className="cursor-pointer px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-200 dark:shadow-none transition-all active:scale-95">
								{isSaving ? (
									<RefreshCw className="animate-spin" size={14} />
								) : (
									<Check size={14} />
								)}
								<span>Salvar Alterações</span>
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
