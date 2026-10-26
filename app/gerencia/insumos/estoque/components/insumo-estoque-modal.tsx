"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
	EstoqueFisicoId,
	InsumoEstoqueNivel,
	ESTOQUES_FISICOS,
	ESTOQUE_NIVEL_CONFIG,
	STEP_TO_NIVEL,
} from "@/types/insumos-estoque";
import {
	X,
	Save,
	Loader2,
	Trash2,
	PackagePlus,
	Search,
	Check,
	Home,
	Store,
	Building,
} from "lucide-react";

interface InsumoEstoqueModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialData?: {
		id?: string;
		nome: string;
		local: EstoqueFisicoId;
		nivel: InsumoEstoqueNivel;
		categoria?: string;
	} | null;
	knownInsumos: { name: string; category?: string }[];
	onSave: (
		nome: string,
		local: EstoqueFisicoId,
		nivel: InsumoEstoqueNivel,
		categoria?: string
	) => Promise<void>;
	onRemoveLocal?: (id: string, local: EstoqueFisicoId) => Promise<void>;
	onDelete?: (id: string) => Promise<void>;
}

export function InsumoEstoqueModal({
	isOpen,
	onClose,
	initialData,
	knownInsumos,
	onSave,
	onRemoveLocal,
	onDelete,
}: InsumoEstoqueModalProps) {
	const isEditing = Boolean(initialData?.id || initialData?.nome);

	const [nome, setNome] = useState("");
	const [categoria, setCategoria] = useState("");
	const [local, setLocal] = useState<EstoqueFisicoId>("casa");
	const [sliderStep, setSliderStep] = useState<number>(2); // 0=zerado, 1=pouco, 2=suficiente
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Combobox State
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Reset form when modal opens or initialData changes
	useEffect(() => {
		if (isOpen) {
			if (initialData) {
				setNome(initialData.nome || "");
				setSearchTerm(initialData.nome || "");
				setCategoria(initialData.categoria || "");
				setLocal(initialData.local || "casa");
				const step =
					initialData.nivel === "zerado" ? 0 : initialData.nivel === "pouco" ? 1 : 2;
				setSliderStep(step);
			} else {
				setNome("");
				setSearchTerm("");
				setCategoria("");
				setLocal("casa");
				setSliderStep(2); // default: Suficiente
			}
			setError(null);
			setIsDropdownOpen(false);
		}
	}, [isOpen, initialData]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Filtered insumos based on user typing
	const filteredInsumos = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return knownInsumos.slice(0, 50);

		return knownInsumos
			.filter((i) => i.name.toLowerCase().includes(term) || (i.category && i.category.toLowerCase().includes(term)))
			.slice(0, 40);
	}, [knownInsumos, searchTerm]);

	const currentNivel: InsumoEstoqueNivel = STEP_TO_NIVEL[sliderStep] || "suficiente";
	const currentNivelConfig = ESTOQUE_NIVEL_CONFIG[currentNivel];

	const handleSelectInsumo = (item: { name: string; category?: string }) => {
		setNome(item.name.toUpperCase());
		setSearchTerm(item.name.toUpperCase());
		if (item.category) setCategoria(item.category);
		setIsDropdownOpen(false);
		setError(null);
	};

	const handleCustomInsumo = () => {
		const clean = searchTerm.trim().toUpperCase();
		if (!clean) return;
		setNome(clean);
		setIsDropdownOpen(false);
		setError(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const finalName = (nome || searchTerm).trim().toUpperCase();

		if (!finalName) {
			setError("Selecione ou digite o nome do insumo.");
			return;
		}

		if (!local) {
			setError("Selecione o local físico do estoque.");
			return;
		}

		try {
			setIsSaving(true);
			setError(null);
			await onSave(finalName, local, currentNivel, categoria);
			onClose();
		} catch (err) {
			console.error("Erro ao salvar insumo no estoque:", err);
			setError("Ocorreu um erro ao salvar o insumo.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleRemoveLocal = async () => {
		if (!initialData?.id) return;
		if (!confirm(`Remover o insumo deste estoque (${local.toUpperCase()})?`)) return;

		try {
			setIsDeleting(true);
			if (onRemoveLocal) {
				await onRemoveLocal(initialData.id, local);
			}
			onClose();
		} catch (err) {
			console.error("Erro ao remover do estoque:", err);
			setError("Erro ao remover o insumo do estoque.");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteTotal = async () => {
		if (!initialData?.id) return;
		if (!confirm(`Excluir permanentemente o insumo "${nome}" de todos os estoques?`)) return;

		try {
			setIsDeleting(true);
			if (onDelete) {
				await onDelete(initialData.id);
			}
			onClose();
		} catch (err) {
			console.error("Erro ao excluir insumo:", err);
			setError("Erro ao excluir o insumo.");
		} finally {
			setIsDeleting(false);
		}
	};

	if (!isOpen) return null;

	const getLocalIcon = (id: EstoqueFisicoId) => {
		if (id === "casa") return <Home size={18} />;
		if (id === "lago") return <Store size={18} />;
		return <Building size={18} />;
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
			{/* Backdrop */}
			<div className="absolute inset-0" onClick={onClose} />

			{/* Modal Card */}
			<div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
							<PackagePlus size={22} />
						</div>
						<div>
							<h2 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
								{isEditing ? "Editar Insumo no Estoque" : "Adicionar Insumo ao Estoque"}
							</h2>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								Indique o insumo, o estoque físico e o nível de quantidade
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
						title="Fechar">
						<X size={20} />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
					{error && (
						<div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-600 dark:text-red-400 animate-in fade-in">
							{error}
						</div>
					)}

					{/* 1. Insumo (Select / Combobox ou Digitação Manual) */}
					<div className="space-y-1.5" ref={dropdownRef}>
						<label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
							1. Insumo <span className="text-red-500">*</span>
						</label>
						<div className="relative">
							<div className="relative flex items-center">
								<Search
									size={18}
									className="absolute left-3.5 text-slate-400 pointer-events-none"
								/>
								<input
									type="text"
									placeholder="Escolha ou digite o nome do insumo..."
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value);
										setNome(e.target.value);
										setIsDropdownOpen(true);
									}}
									onFocus={() => setIsDropdownOpen(true)}
									className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase"
								/>
								{searchTerm && (
									<button
										type="button"
										onClick={() => {
											setSearchTerm("");
											setNome("");
										}}
										className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
										<X size={16} />
									</button>
								)}
							</div>

							{/* Dropdown Suggestions */}
							{isDropdownOpen && (
								<div className="absolute z-30 left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 animate-in fade-in zoom-in-95 duration-100">
									{searchTerm.trim() && (
										<button
											type="button"
											onClick={handleCustomInsumo}
											className="w-full text-left px-4 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between transition-colors">
											<span>➕ Usar digitado: &ldquo;{searchTerm.trim().toUpperCase()}&rdquo;</span>
											<span className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">
												Manual
											</span>
										</button>
									)}

									{filteredInsumos.length > 0 ? (
										filteredInsumos.map((item) => {
											const isSelected =
												nome.toUpperCase() === item.name.toUpperCase();
											return (
												<button
													key={item.name}
													type="button"
													onClick={() => handleSelectInsumo(item)}
													className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${
														isSelected
															? "bg-blue-50/70 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
															: "text-slate-700 dark:text-slate-200"
													}`}>
													<span className="truncate pr-2">{item.name}</span>
													<div className="flex items-center gap-2 shrink-0">
														{item.category && (
															<span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
																{item.category}
															</span>
														)}
														{isSelected && <Check size={14} className="text-blue-600" />}
													</div>
												</button>
											);
										})
									) : (
										<div className="px-4 py-3 text-xs text-slate-500 text-center">
											Nenhum insumo sugerido. Clique em &ldquo;Usar digitado&rdquo; acima.
										</div>
									)}
								</div>
							)}
						</div>
					</div>

					{/* 2. Local do Insumo (Casa, Lago, Noroeste) */}
					<div className="space-y-2">
						<label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
							2. Local do Insumo <span className="text-red-500">*</span>
						</label>
						<div className="grid grid-cols-3 gap-2.5">
							{ESTOQUES_FISICOS.map((est) => {
								const isSelected = local === est.id;
								return (
									<button
										key={est.id}
										type="button"
										onClick={() => setLocal(est.id)}
										className={`cursor-pointer p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
											isSelected
												? "border-blue-600 dark:border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm ring-2 ring-blue-500/20 font-black"
												: "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 font-bold"
										}`}>
										<div className="p-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-xs">
											{getLocalIcon(est.id)}
										</div>
										<span className="text-xs uppercase tracking-wider">{est.name}</span>
									</button>
								);
							})}
						</div>
					</div>

					{/* 3. Quantidade do Insumo (Slider com 3 opções horizontais: Zerado, Pouco, Suficiente) */}
					<div className="space-y-3 pt-2">
						<div className="flex items-center justify-between">
							<label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
								3. Quantidade no Estoque <span className="text-red-500">*</span>
							</label>
							<span
								className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${currentNivelConfig.badgeClass}`}>
								{currentNivelConfig.label}
							</span>
						</div>

						{/* Interactive Horizontal Slider */}
						<div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
							<div className="relative pt-1 pb-1">
								{/* Custom Track Background */}
								<div className="relative h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
									<div
										className={`h-full transition-all duration-200 ${
											sliderStep === 0
												? "w-1/3 bg-red-500"
												: sliderStep === 1
												? "w-2/3 bg-amber-500"
												: "w-full bg-emerald-500"
										}`}
									/>
								</div>

								{/* Native Slider Input for Smooth Dragging */}
								<input
									type="range"
									min="0"
									max="2"
									step="1"
									value={sliderStep}
									onChange={(e) => setSliderStep(parseInt(e.target.value, 10))}
									className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
									aria-label="Quantidade no estoque"
								/>
							</div>

							{/* 3 Horizontal Clickable Options */}
							<div className="grid grid-cols-3 gap-2">
								{/* Zerado */}
								<button
									type="button"
									onClick={() => setSliderStep(0)}
									className={`cursor-pointer py-2 px-3 rounded-xl border text-center transition-all ${
										sliderStep === 0
											? "border-red-500 bg-red-500 text-white font-black shadow-md shadow-red-500/20"
											: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-red-600 font-bold"
									}`}>
									<div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider">
										<span
											className={`w-2 h-2 rounded-full ${
												sliderStep === 0 ? "bg-white" : "bg-red-500"
											}`}
										/>
										<span>Zerado</span>
									</div>
								</button>

								{/* Pouco */}
								<button
									type="button"
									onClick={() => setSliderStep(1)}
									className={`cursor-pointer py-2 px-3 rounded-xl border text-center transition-all ${
										sliderStep === 1
											? "border-amber-500 bg-amber-500 text-white font-black shadow-md shadow-amber-500/20"
											: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-600 font-bold"
									}`}>
									<div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider">
										<span
											className={`w-2 h-2 rounded-full ${
												sliderStep === 1 ? "bg-white" : "bg-amber-500"
											}`}
										/>
										<span>Pouco</span>
									</div>
								</button>

								{/* Suficiente */}
								<button
									type="button"
									onClick={() => setSliderStep(2)}
									className={`cursor-pointer py-2 px-3 rounded-xl border text-center transition-all ${
										sliderStep === 2
											? "border-emerald-600 bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20"
											: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-600 font-bold"
									}`}>
									<div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider">
										<span
											className={`w-2 h-2 rounded-full ${
												sliderStep === 2 ? "bg-white" : "bg-emerald-500"
											}`}
										/>
										<span>Suficiente</span>
									</div>
								</button>
							</div>
						</div>
					</div>

					{/* Modal Actions */}
					<div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
						{/* Extra edit options: remove or delete */}
						{isEditing && (
							<div className="flex items-center gap-1.5">
								{onRemoveLocal && (
									<button
										type="button"
										onClick={handleRemoveLocal}
										disabled={isSaving || isDeleting}
										title={`Remover de ${local.toUpperCase()}`}
										className="cursor-pointer text-xs font-bold text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50">
										Remover deste local
									</button>
								)}
								{onDelete && (
									<button
										type="button"
										onClick={handleDeleteTotal}
										disabled={isSaving || isDeleting}
										title="Excluir de todos os estoques"
										className="cursor-pointer text-xs font-bold text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50 flex items-center gap-1">
										<Trash2 size={14} />
									</button>
								)}
							</div>
						)}

						<div className="flex items-center gap-2 ml-auto">
							<button
								type="button"
								onClick={onClose}
								disabled={isSaving || isDeleting}
								className="cursor-pointer px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
								Cancelar
							</button>

							<button
								type="submit"
								disabled={isSaving || isDeleting}
								className="cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all">
								{isSaving ? (
									<>
										<Loader2 size={16} className="animate-spin" />
										<span>Salvando...</span>
									</>
								) : (
									<>
										<Save size={16} />
										<span>{isEditing ? "Atualizar Estoque" : "Salvar no Estoque"}</span>
									</>
								)}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
