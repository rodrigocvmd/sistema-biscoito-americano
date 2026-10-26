"use client";

import { useEffect, useState, useMemo } from "react";
import {
	EstoqueFisicoId,
	InsumoEstoqueItem,
	InsumoEstoqueNivel,
	ESTOQUES_FISICOS,
	ESTOQUE_NIVEL_CONFIG,
} from "@/types/insumos-estoque";
import {
	subscribeInsumosEstoque,
	saveInsumoEstoque,
	removeLocalFromInsumo,
	deleteInsumoEstoque,
} from "@/lib/insumos-estoque-service";
import { getAllInventoryItems, DEFAULT_INSUMOS_CATALOG } from "@/lib/insumos-data";
import { InsumoEstoqueModal } from "./components/insumo-estoque-modal";
import {
	Plus,
	Search,
	Loader2,
	Pencil,
	Trash2,
	Package,
	Home,
	Store,
	Building,
	CheckCircle2,
	AlertTriangle,
	XCircle,
	Boxes,
} from "lucide-react";

export default function InsumosEstoquePage() {
	const [items, setItems] = useState<InsumoEstoqueItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Modal State
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [modalInitialData, setModalInitialData] = useState<{
		id?: string;
		nome: string;
		local: EstoqueFisicoId;
		nivel: InsumoEstoqueNivel;
		categoria?: string;
	} | null>(null);

	// Filters
	const [searchTerm, setSearchTerm] = useState("");
	const [filterLocal, setFilterLocal] = useState<"all" | EstoqueFisicoId>("all");
	const [filterNivel, setFilterNivel] = useState<"all" | InsumoEstoqueNivel>("all");

	// Real-time listener
	useEffect(() => {
		const unsubscribe = subscribeInsumosEstoque((fetchedItems) => {
			setItems(fetchedItems);
			setIsLoading(false);
		});

		return () => unsubscribe();
	}, []);

	// Known insumos list for autocomplete suggestions
	const knownInsumos = useMemo(() => {
		const map = new Map<string, string>();
		// From INVENTORY_DATA
		getAllInventoryItems().forEach((i) => {
			map.set(i.name.toUpperCase(), i.category);
		});
		// From DEFAULT_INSUMOS_CATALOG
		DEFAULT_INSUMOS_CATALOG.forEach((i) => {
			if (!map.has(i.name.toUpperCase())) {
				map.set(i.name.toUpperCase(), i.category);
			}
		});

		return Array.from(map.entries())
			.map(([name, category]) => ({ name, category }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, []);

	// Metric summaries / Somatória base
	const metrics = useMemo(() => {
		let totalCasa = 0;
		let totalLago = 0;
		let totalNoroeste = 0;

		let totalZerados = 0;
		let totalPouco = 0;
		let totalSuficiente = 0;

		items.forEach((item) => {
			if (item.locais.casa) {
				totalCasa++;
				if (item.locais.casa === "zerado") totalZerados++;
				else if (item.locais.casa === "pouco") totalPouco++;
				else if (item.locais.casa === "suficiente") totalSuficiente++;
			}
			if (item.locais.lago) {
				totalLago++;
				if (item.locais.lago === "zerado") totalZerados++;
				else if (item.locais.lago === "pouco") totalPouco++;
				else if (item.locais.lago === "suficiente") totalSuficiente++;
			}
			if (item.locais.noroeste) {
				totalNoroeste++;
				if (item.locais.noroeste === "zerado") totalZerados++;
				else if (item.locais.noroeste === "pouco") totalPouco++;
				else if (item.locais.noroeste === "suficiente") totalSuficiente++;
			}
		});

		return {
			totalInsumos: items.length,
			totalCasa,
			totalLago,
			totalNoroeste,
			totalZerados,
			totalPouco,
			totalSuficiente,
		};
	}, [items]);

	// Filtered unified list
	const filteredItems = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();

		return items.filter((item) => {
			// Search filter
			const matchesSearch =
				!term ||
				item.nome.toLowerCase().includes(term) ||
				(item.categoria && item.categoria.toLowerCase().includes(term));

			// Local filter
			let matchesLocal = true;
			if (filterLocal !== "all") {
				matchesLocal = Boolean(item.locais[filterLocal]);
			}

			// Nivel filter
			let matchesNivel = true;
			if (filterNivel !== "all") {
				if (filterLocal !== "all") {
					matchesNivel = item.locais[filterLocal] === filterNivel;
				} else {
					matchesNivel = Object.values(item.locais).includes(filterNivel);
				}
			}

			return matchesSearch && matchesLocal && matchesNivel;
		});
	}, [items, searchTerm, filterLocal, filterNivel]);

	// Actions
	const handleOpenAddModal = (defaultLocal: EstoqueFisicoId = "casa") => {
		setModalInitialData({
			nome: "",
			local: defaultLocal,
			nivel: "suficiente",
			categoria: "",
		});
		setIsModalOpen(true);
	};

	const handleOpenEditModal = (
		item: InsumoEstoqueItem,
		localTarget?: EstoqueFisicoId
	) => {
		// Se foi clicado em um local específico ou pega o primeiro disponível
		const localToEdit: EstoqueFisicoId =
			localTarget ||
			(Object.keys(item.locais)[0] as EstoqueFisicoId) ||
			"casa";

		setModalInitialData({
			id: item.id,
			nome: item.nome,
			local: localToEdit,
			nivel: item.locais[localToEdit] || "suficiente",
			categoria: item.categoria || "",
		});
		setIsModalOpen(true);
	};

	const handleSave = async (
		nome: string,
		local: EstoqueFisicoId,
		nivel: InsumoEstoqueNivel,
		categoria?: string
	) => {
		await saveInsumoEstoque(nome, local, nivel, categoria);
	};

	const handleRemoveLocal = async (id: string, local: EstoqueFisicoId) => {
		await removeLocalFromInsumo(id, local);
	};

	const handleDelete = async (id: string) => {
		await deleteInsumoEstoque(id);
	};

	const getLocalIcon = (id: EstoqueFisicoId) => {
		if (id === "casa") return <Home size={14} />;
		if (id === "lago") return <Store size={14} />;
		return <Building size={14} />;
	};

	return (
		<div className="max-w-6xl mx-auto space-y-6">
			{/* Top Header Card */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
				<div className="flex items-center gap-4">
					<div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
						<Boxes size={28} />
					</div>
					<div>
						<h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
							Estoque Físico de Insumos
						</h1>
						<p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
							Controle unificado dos estoques físicos: Casa, Lago e Noroeste
						</p>
					</div>
				</div>

				<button
					type="button"
					onClick={() => handleOpenAddModal("casa")}
					className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto">
					<Plus size={18} />
					<span>Adicionar Insumo</span>
				</button>
			</div>

			{/* Metric Cards / Somatória Base */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{/* Total Insumos */}
				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
					<span className="text-2xs font-black uppercase tracking-wider text-slate-400 block mb-1">
						Insumos Monitorados
					</span>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-slate-800 dark:text-slate-100">
							{metrics.totalInsumos}
						</span>
						<span className="text-xs font-semibold text-slate-400">cadastrados</span>
					</div>
				</div>

				{/* Estoque Casa */}
				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
					<div className="flex items-center justify-between mb-1">
						<span className="text-2xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
							<Home size={12} /> Casa
						</span>
					</div>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-blue-600 dark:text-blue-400">
							{metrics.totalCasa}
						</span>
						<span className="text-xs font-semibold text-slate-400">itens</span>
					</div>
				</div>

				{/* Estoque Lago */}
				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
					<div className="flex items-center justify-between mb-1">
						<span className="text-2xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
							<Store size={12} /> Lago
						</span>
					</div>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-blue-600 dark:text-blue-400">
							{metrics.totalLago}
						</span>
						<span className="text-xs font-semibold text-slate-400">itens</span>
					</div>
				</div>

				{/* Estoque Noroeste */}
				<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
					<div className="flex items-center justify-between mb-1">
						<span className="text-2xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
							<Building size={12} /> Noroeste
						</span>
					</div>
					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-black text-blue-600 dark:text-blue-400">
							{metrics.totalNoroeste}
						</span>
						<span className="text-xs font-semibold text-slate-400">itens</span>
					</div>
				</div>
			</div>

			{/* Status Breakdown Bar */}
			<div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
				<span className="font-bold text-slate-500 dark:text-slate-400">
					Status Geral dos Estoques:
				</span>
				<div className="flex items-center gap-4 flex-wrap">
					<div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
						<CheckCircle2 size={16} />
						<span>{metrics.totalSuficiente} Suficientes</span>
					</div>
					<div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
						<AlertTriangle size={16} />
						<span>{metrics.totalPouco} Pouco</span>
					</div>
					<div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
						<XCircle size={16} />
						<span>{metrics.totalZerados} Zerados</span>
					</div>
				</div>
			</div>

			{/* Filters Bar */}
			<div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
				{/* Search */}
				<div className="relative flex-1">
					<Search
						size={18}
						className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
					/>
					<input
						type="text"
						placeholder="Buscar insumo por nome ou categoria..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
					/>
				</div>

				<div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
					{/* Filter Local */}
					<div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
						<button
							type="button"
							onClick={() => setFilterLocal("all")}
							className={`cursor-pointer px-3 py-1.5 rounded-lg transition-all ${
								filterLocal === "all"
									? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
									: "text-slate-500 dark:text-slate-400"
							}`}>
							Todos
						</button>
						{ESTOQUES_FISICOS.map((est) => (
							<button
								key={est.id}
								type="button"
								onClick={() => setFilterLocal(est.id)}
								className={`cursor-pointer px-3 py-1.5 rounded-lg transition-all ${
									filterLocal === est.id
										? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
										: "text-slate-500 dark:text-slate-400"
								}`}>
								{est.name}
							</button>
						))}
					</div>

					{/* Filter Nivel */}
					<div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
						<button
							type="button"
							onClick={() => setFilterNivel("all")}
							className={`cursor-pointer px-2.5 py-1.5 rounded-lg transition-all ${
								filterNivel === "all"
									? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs"
									: "text-slate-500 dark:text-slate-400"
							}`}>
							Níveis
						</button>
						<button
							type="button"
							onClick={() => setFilterNivel("suficiente")}
							className={`cursor-pointer px-2.5 py-1.5 rounded-lg transition-all ${
								filterNivel === "suficiente"
									? "bg-emerald-600 text-white shadow-xs"
									: "text-slate-500 dark:text-slate-400 hover:text-emerald-600"
							}`}>
							Suficiente
						</button>
						<button
							type="button"
							onClick={() => setFilterNivel("pouco")}
							className={`cursor-pointer px-2.5 py-1.5 rounded-lg transition-all ${
								filterNivel === "pouco"
									? "bg-amber-500 text-white shadow-xs"
									: "text-slate-500 dark:text-slate-400 hover:text-amber-600"
							}`}>
							Pouco
						</button>
						<button
							type="button"
							onClick={() => setFilterNivel("zerado")}
							className={`cursor-pointer px-2.5 py-1.5 rounded-lg transition-all ${
								filterNivel === "zerado"
									? "bg-red-600 text-white shadow-xs"
									: "text-slate-500 dark:text-slate-400 hover:text-red-600"
							}`}>
							Zerado
						</button>
					</div>
				</div>
			</div>

			{/* Unified Insumos List */}
			{isLoading ? (
				<div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
					<Loader2 size={36} className="animate-spin text-blue-600" />
					<p className="text-sm font-semibold">Carregando estoque físico de insumos...</p>
				</div>
			) : filteredItems.length === 0 ? (
				<div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
					<div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
						<Package size={32} />
					</div>
					<div>
						<h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
							{items.length === 0
								? "Nenhum insumo cadastrado no estoque físico"
								: "Nenhum insumo encontrado com os filtros selecionados"}
						</h3>
						<p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
							{items.length === 0
								? "Adicione o primeiro insumo clicando no botão abaixo e indique o estoque (Casa, Lago ou Noroeste) e a quantidade."
								: "Tente alterar o termo de busca ou limpar os filtros para visualizar outros insumos."}
						</p>
					</div>
					{items.length === 0 && (
						<button
							type="button"
							onClick={() => handleOpenAddModal("casa")}
							className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all">
							<Plus size={16} />
							<span>Adicionar Primeiro Insumo</span>
						</button>
					)}
				</div>
			) : (
				<div className="space-y-3">
					<div className="px-2 flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
						<span>
							Insumos Unificados ({filteredItems.length} de {items.length})
						</span>
						<span>Clique nas tags para editar diretamente</span>
					</div>

					<div className="grid grid-cols-1 gap-2.5">
						{filteredItems.map((item) => {
							const configuredLocaisCount = Object.keys(item.locais).length;

							return (
								<div
									key={item.id}
									className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
									{/* Insumo Name & Category */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2.5 flex-wrap">
											<span className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight">
												{item.nome}
											</span>
											{item.categoria && (
												<span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-2xs font-bold uppercase tracking-wider">
													{item.categoria}
												</span>
											)}
										</div>
										<span className="text-2xs text-slate-400 mt-0.5 block">
											Cadastrado em {configuredLocaisCount} de 3 estoques
										</span>
									</div>

									{/* Unified Tags dos Estoques Físicos */}
									<div className="flex items-center gap-2 flex-wrap">
										{ESTOQUES_FISICOS.map((est) => {
											const nivel = item.locais[est.id];

											if (!nivel) {
												return (
													<button
														key={est.id}
														type="button"
														onClick={() => handleOpenEditModal(item, est.id)}
														title={`Adicionar ${item.nome} ao estoque de ${est.name}`}
														className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-2xs font-bold border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all">
														{getLocalIcon(est.id)}
														<span>+ {est.name}</span>
													</button>
												);
											}

											const cfg = ESTOQUE_NIVEL_CONFIG[nivel];

											return (
												<button
													key={est.id}
													type="button"
													onClick={() => handleOpenEditModal(item, est.id)}
													title={`Clique para editar ${item.nome} em ${est.name} (Atual: ${cfg.label})`}
													className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 shadow-xs hover:ring-2 hover:ring-blue-500/20 ${cfg.badgeClass}`}>
													{getLocalIcon(est.id)}
													<span className="uppercase tracking-wider font-extrabold text-2xs">
														{est.name}:
													</span>
													<span>{cfg.label}</span>
												</button>
											);
										})}

										{/* Card Edit and Delete buttons */}
										<div className="flex items-center gap-1 ml-2 border-l border-slate-100 dark:border-slate-800 pl-2">
											<button
												type="button"
												onClick={() => handleOpenEditModal(item)}
												title="Editar insumo"
												className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
												<Pencil size={15} />
											</button>
											<button
												type="button"
												onClick={() => handleDelete(item.id)}
												title="Excluir de todos os estoques"
												className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
												<Trash2 size={15} />
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Modal para Adicionar / Editar */}
			<InsumoEstoqueModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				initialData={modalInitialData}
				knownInsumos={knownInsumos}
				onSave={handleSave}
				onRemoveLocal={handleRemoveLocal}
				onDelete={handleDelete}
			/>
		</div>
	);
}
