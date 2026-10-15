"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	doc,
	setDoc,
	deleteDoc,
	serverTimestamp,
} from "firebase/firestore";
import {
	DEFAULT_INSUMOS_CATALOG,
	INVENTORY_DATA,
	InsumoCatalogItem,
	slugifyInsumoName,
} from "@/lib/insumos-data";
import {
	Search,
	Edit3,
	Plus,
	Check,
	X,
	FileText,
	DollarSign,
	Store,
	Tag,
	Filter,
	Sparkles,
	RefreshCw,
	Layers,
	Info,
	Trash2,
	ChevronDown,
} from "lucide-react";

export default function InsumosListaPage() {
	const [catalogOverrides, setCatalogOverrides] = useState<Record<string, InsumoCatalogItem>>({});
	const [customItems, setCustomItems] = useState<InsumoCatalogItem[]>([]);
	const [loading, setLoading] = useState(true);

	// Filters
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>("TODAS");

	// Edit Modal
	const [editingItem, setEditingItem] = useState<InsumoCatalogItem | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	// New Insumo Modal
	const [isAddingNew, setIsAddingNew] = useState(false);
	const [newItemForm, setNewItemForm] = useState<Omit<InsumoCatalogItem, "id">>({
		name: "",
		category: "BEBIDAS E SODAS",
		valorBom: "",
		valorMaximo: "",
		localCompra: "",
		marca: "",
		observacoes: "",
	});

	// Subscribe to Firestore overrides & custom additions
	useEffect(() => {
		const unsubscribe = onSnapshot(
			collection(db, "insumosCatalog"),
			(snapshot) => {
				const overrides: Record<string, InsumoCatalogItem> = {};
				const customs: InsumoCatalogItem[] = [];

				snapshot.forEach((docSnap) => {
					const data = docSnap.data() as InsumoCatalogItem;
					const id = docSnap.id;
					const item = { ...data, id };

					// Check if this is a default item or a custom user-added item
					const isDefault = DEFAULT_INSUMOS_CATALOG.some((d) => d.id === id);
					if (isDefault) {
						overrides[id] = item;
					} else {
						customs.push(item);
					}
				});

				setCatalogOverrides(overrides);
				setCustomItems(customs);
				setLoading(false);
			},
			(err) => {
				console.error("Erro ao carregar catálogo de insumos:", err);
				setLoading(false);
			}
		);

		return () => unsubscribe();
	}, []);

	// Merge defaults with firestore overrides and custom items
	const fullCatalog = useMemo(() => {
		const mergedDefaults = DEFAULT_INSUMOS_CATALOG.map((item) => {
			if (catalogOverrides[item.id]) {
				return { ...item, ...catalogOverrides[item.id] };
			}
			return item;
		});

		return [...mergedDefaults, ...customItems];
	}, [catalogOverrides, customItems]);

	// Filter and sort items
	const filteredCatalog = useMemo(() => {
		return fullCatalog.filter((item) => {
			// Category filter
			if (selectedCategory !== "TODAS" && item.category !== selectedCategory) {
				return false;
			}

			// Search term filter
			if (searchTerm.trim()) {
				const term = searchTerm
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.toLowerCase();

				const targetStr = `${item.name} ${item.category} ${item.marca} ${item.localCompra} ${item.observacoes} ${item.valorBom} ${item.valorMaximo}`
					.normalize("NFD")
					.replace(/[\u0300-\u036f]/g, "")
					.toLowerCase();

				return targetStr.includes(term);
			}

			return true;
		});
	}, [fullCatalog, selectedCategory, searchTerm]);

	// Save edited item to Firestore
	const handleSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingItem) return;

		setIsSaving(true);
		try {
			const itemRef = doc(db, "insumosCatalog", editingItem.id);
			await setDoc(
				itemRef,
				{
					id: editingItem.id,
					name: editingItem.name,
					category: editingItem.category,
					valorBom: editingItem.valorBom || "",
					valorMaximo: editingItem.valorMaximo || "",
					localCompra: editingItem.localCompra || "",
					marca: editingItem.marca || "",
					observacoes: editingItem.observacoes || "",
					updatedAt: serverTimestamp(),
				},
				{ merge: true }
			);

			setEditingItem(null);
		} catch (error) {
			console.error("Erro ao salvar insumo:", error);
			alert("Erro ao salvar as informações do insumo.");
		} finally {
			setIsSaving(false);
		}
	};

	// Save newly added custom item to Firestore
	const handleSaveNew = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = newItemForm.name.trim().toUpperCase();
		if (!name) return;

		setIsSaving(true);
		try {
			const id = slugifyInsumoName(name);
			const itemRef = doc(db, "insumosCatalog", id);
			await setDoc(itemRef, {
				id,
				name,
				category: newItemForm.category,
				valorBom: newItemForm.valorBom || "",
				valorMaximo: newItemForm.valorMaximo || "",
				localCompra: newItemForm.localCompra || "",
				marca: newItemForm.marca || "",
				observacoes: newItemForm.observacoes || "",
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});

			setIsAddingNew(false);
			setNewItemForm({
				name: "",
				category: "BEBIDAS E SODAS",
				valorBom: "",
				valorMaximo: "",
				localCompra: "",
				marca: "",
				observacoes: "",
			});
		} catch (error) {
			console.error("Erro ao cadastrar novo insumo:", error);
			alert("Erro ao cadastrar novo insumo.");
		} finally {
			setIsSaving(false);
		}
	};

	// Categories list for tabs
	const categoriesList = useMemo(() => {
		const cats = INVENTORY_DATA.map((c) => c.category);
		return ["TODAS", ...cats];
	}, []);

	return (
		<div className="space-y-6 max-w-7xl mx-auto px-4 pb-16">
			{/* Header Banner */}
			<section className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
							<FileText size={24} />
						</div>
						<div>
							<h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
								Tabela Geral de Insumos
							</h1>
							<p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
								Consulta completa de insumos, parâmetros de valores ideais/máximos, fornecedores e marcas
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl">
							<Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
							<span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
								<strong>{fullCatalog.length}</strong> insumos cadastrados
							</span>
						</div>

						<button
							onClick={() => setIsAddingNew(true)}
							className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 text-xs md:text-sm shadow-sm active:scale-95">
							<Plus size={16} />
							<span>Novo Insumo</span>
						</button>
					</div>
				</div>
			</section>

			{/* Filters & Search */}
			<section className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors space-y-4">
				<div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
					{/* Search input */}
					<div className="relative flex-1">
						<Search
							size={18}
							className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
						/>
						<input
							type="text"
							placeholder="Buscar por insumo, marca, local de compra ou observações..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs md:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
						/>
						{searchTerm && (
							<button
								onClick={() => setSearchTerm("")}
								className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
								<X size={16} />
							</button>
						)}
					</div>

					<div className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 self-center">
						Exibindo <strong>{filteredCatalog.length}</strong> de {fullCatalog.length}
					</div>
				</div>

				{/* Category Pills Selector */}
				<div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
					{categoriesList.map((cat) => {
						const isSelected = selectedCategory === cat;
						return (
							<button
								key={cat}
								onClick={() => setSelectedCategory(cat)}
								className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-black tracking-wide whitespace-nowrap transition-all ${
									isSelected
										? "bg-slate-800 dark:bg-blue-600 text-white shadow-sm"
										: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
								}`}>
								{cat}
							</button>
						);
					})}
				</div>
			</section>

			{/* Table of Insumos */}
			<section className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
				{loading ? (
					<div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
						<RefreshCw className="animate-spin text-blue-600" size={32} />
						<span className="text-sm font-bold">Carregando lista geral de insumos...</span>
					</div>
				) : filteredCatalog.length === 0 ? (
					<div className="py-20 text-center p-8">
						<FileText className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={48} />
						<h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
							Nenhum insumo encontrado
						</h3>
						<p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
							Verifique os filtros selecionados ou digite um termo diferente na busca.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm border-collapse">
							<thead>
								<tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800">
									<th className="py-4 px-4 w-12 text-center">#</th>
									<th className="py-4 px-4 min-w-[200px]">Insumo</th>
									<th className="py-4 px-3 min-w-[120px]">Valor Bom</th>
									<th className="py-4 px-3 min-w-[120px]">Valor Máximo</th>
									<th className="py-4 px-4 min-w-[160px]">Local de Compra</th>
									<th className="py-4 px-4 min-w-[140px]">Marca</th>
									<th className="py-4 px-4 min-w-[220px]">Observações</th>
									<th className="py-4 px-3 w-16 text-center">Editar</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
								{filteredCatalog.map((item, idx) => {
									return (
										<tr
											key={item.id}
											className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
											{/* Index */}
											<td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
												{idx + 1}
											</td>

											{/* Insumo Name & Category */}
											<td className="py-3.5 px-4">
												<div className="font-black text-slate-800 dark:text-slate-100 uppercase text-xs md:text-sm">
													{item.name}
												</div>
												<span className="inline-block mt-1 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
													{item.category}
												</span>
											</td>

											{/* Valor Bom */}
											<td className="py-3.5 px-3">
												{item.valorBom ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/50">
														{item.valorBom}
													</span>
												) : (
													<span className="text-xs text-slate-300 dark:text-slate-600 italic">
														Não inf.
													</span>
												)}
											</td>

											{/* Valor Máximo */}
											<td className="py-3.5 px-3">
												{item.valorMaximo ? (
													<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/50">
														{item.valorMaximo}
													</span>
												) : (
													<span className="text-xs text-slate-300 dark:text-slate-600 italic">
														Não inf.
													</span>
												)}
											</td>

											{/* Local de Compra */}
											<td className="py-3.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-300">
												{item.localCompra || (
													<span className="text-slate-300 dark:text-slate-600 italic font-normal">
														Não informado
													</span>
												)}
											</td>

											{/* Marca */}
											<td className="py-3.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-300">
												{item.marca || (
													<span className="text-slate-300 dark:text-slate-600 italic font-normal">
														Não informada
													</span>
												)}
											</td>

											{/* Observações */}
											<td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
												{item.observacoes || (
													<span className="text-slate-300 dark:text-slate-600 italic">
														Sem observações
													</span>
												)}
											</td>

											{/* Ação Editar */}
											<td className="py-3.5 px-3 text-center">
												<button
													onClick={() => setEditingItem(item)}
													title="Editar parâmetros deste insumo"
													className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-95">
													<Edit3 size={16} />
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Modal de Edição de Insumo */}
			{editingItem && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
						<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
							<div>
								<span className="text-2xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
									Editar Parâmetros de Compra
								</span>
								<h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 uppercase">
									{editingItem.name}
								</h3>
							</div>
							<button
								onClick={() => setEditingItem(null)}
								className="cursor-pointer p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
								<X size={20} />
							</button>
						</div>

						<form onSubmit={handleSaveEdit} className="space-y-4">
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
										Valor Bom (R$)
									</label>
									<input
										type="text"
										placeholder="Ex: R$ 45,00"
										value={editingItem.valorBom}
										onChange={(e) =>
											setEditingItem({ ...editingItem, valorBom: e.target.value })
										}
										className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
										Valor Máximo (R$)
									</label>
									<input
										type="text"
										placeholder="Ex: R$ 55,00"
										value={editingItem.valorMaximo}
										onChange={(e) =>
											setEditingItem({ ...editingItem, valorMaximo: e.target.value })
										}
										className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Local de Compra
								</label>
								<input
									type="text"
									placeholder="Ex: Atacadão, Sam's Club, Distribuidora..."
									value={editingItem.localCompra}
									onChange={(e) =>
										setEditingItem({ ...editingItem, localCompra: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Marca Recomendada
								</label>
								<input
									type="text"
									placeholder="Ex: Ferrero, Nestlé, Coca-Cola..."
									value={editingItem.marca}
									onChange={(e) =>
										setEditingItem({ ...editingItem, marca: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Observações
								</label>
								<textarea
									rows={3}
									placeholder="Ex: Balde de 3kg, comprar somente fardo lacrado, tamanho P..."
									value={editingItem.observacoes}
									onChange={(e) =>
										setEditingItem({ ...editingItem, observacoes: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
								/>
							</div>

							<div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setEditingItem(null)}
									className="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
									Cancelar
								</button>
								<button
									type="submit"
									disabled={isSaving}
									className="cursor-pointer px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-200 dark:shadow-none transition-all active:scale-95">
									{isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
									Salvar Alterações
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Modal para Adicionar Novo Insumo Personalizado */}
			{isAddingNew && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
						<div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
							<div>
								<span className="text-2xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
									Novo Cadastro
								</span>
								<h3 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">
									Cadastrar Novo Insumo na Tabela
								</h3>
							</div>
							<button
								onClick={() => setIsAddingNew(false)}
								className="cursor-pointer p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
								<X size={20} />
							</button>
						</div>

						<form onSubmit={handleSaveNew} className="space-y-4">
							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Nome do Insumo *
								</label>
								<input
									type="text"
									required
									placeholder="Ex: COCO RALADO FINO"
									value={newItemForm.name}
									onChange={(e) =>
										setNewItemForm({ ...newItemForm, name: e.target.value.toUpperCase() })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Categoria *
								</label>
								<select
									value={newItemForm.category}
									onChange={(e) =>
										setNewItemForm({ ...newItemForm, category: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
									{INVENTORY_DATA.map((c) => (
										<option key={c.category} value={c.category}>
											{c.category}
										</option>
									))}
								</select>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
										Valor Bom (R$)
									</label>
									<input
										type="text"
										placeholder="Ex: R$ 25,00"
										value={newItemForm.valorBom}
										onChange={(e) =>
											setNewItemForm({ ...newItemForm, valorBom: e.target.value })
										}
										className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>

								<div>
									<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
										Valor Máximo (R$)
									</label>
									<input
										type="text"
										placeholder="Ex: R$ 35,00"
										value={newItemForm.valorMaximo}
										onChange={(e) =>
											setNewItemForm({ ...newItemForm, valorMaximo: e.target.value })
										}
										className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Local de Compra
								</label>
								<input
									type="text"
									placeholder="Ex: Atacadão, Confeitaria..."
									value={newItemForm.localCompra}
									onChange={(e) =>
										setNewItemForm({ ...newItemForm, localCompra: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Marca
								</label>
								<input
									type="text"
									placeholder="Ex: Sococo"
									value={newItemForm.marca}
									onChange={(e) =>
										setNewItemForm({ ...newItemForm, marca: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<label className="block text-xs font-bold text-slate-500 uppercase mb-1">
									Observações
								</label>
								<textarea
									rows={3}
									placeholder="Ex: Pacote de 1kg..."
									value={newItemForm.observacoes}
									onChange={(e) =>
										setNewItemForm({ ...newItemForm, observacoes: e.target.value })
									}
									className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
								/>
							</div>

							<div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
								<button
									type="button"
									onClick={() => setIsAddingNew(false)}
									className="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
									Cancelar
								</button>
								<button
									type="submit"
									disabled={isSaving || !newItemForm.name.trim()}
									className="cursor-pointer px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-200 dark:shadow-none transition-all active:scale-95">
									{isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
									Cadastrar Insumo
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
