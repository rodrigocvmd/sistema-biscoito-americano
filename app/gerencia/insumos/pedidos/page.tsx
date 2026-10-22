"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	addDoc,
	updateDoc,
	deleteDoc,
	doc,
	query,
	orderBy,
	onSnapshot,
	serverTimestamp,
} from "firebase/firestore";
import {
	INVENTORY_DATA,
	DEFAULT_INSUMOS_CATALOG,
	InsumoCatalogItem,
	InsumoResponsavel,
	RESPONSAVEIS_COMPRA,
	slugifyInsumoName,
} from "@/lib/insumos-data";
import { formatDate } from "@/types";
import { ResponsavelTag, ResponsavelTagsList } from "../components/responsavel-tag";
import { InsumoModal } from "../components/insumo-modal";
import {
	Plus,
	Search,
	Trash2,
	RefreshCw,
	Check,
	CheckCircle2,
	Clock,
	Copy,
	ChevronDown,
	ShoppingCart,
	ClipboardList,
	X,
	Info,
	AlertTriangle,
} from "lucide-react";

export interface SupplierOrder {
	id: string;
	name: string;
	category?: string;
	status: "pending" | "completed";
	createdAt: any;
	completedAt?: any;
}

export default function InsumosPedidosPage() {
	const [orders, setOrders] = useState<SupplierOrder[]>([]);
	const [loading, setLoading] = useState(true);

	// Catálogo de Insumos (para buscar responsáveis, valores, locais de compra, etc.)
	const [catalogOverrides, setCatalogOverrides] = useState<Record<string, InsumoCatalogItem>>({});
	const [customCatalogItems, setCustomCatalogItems] = useState<InsumoCatalogItem[]>([]);

	// Modal de detalhes do insumo
	const [selectedInsumo, setSelectedInsumo] = useState<InsumoCatalogItem | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);

	// Form State
	const [inputName, setInputName] = useState("");
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [adding, setAdding] = useState(false);

	// Filter / Search State
	const [searchFilter, setSearchFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("pending");
	const [selectedResponsavel, setSelectedResponsavel] = useState<InsumoResponsavel | "all">("all");
	const [copied, setCopied] = useState(false);

	// Modal de Confirmação de Exclusão
	const [orderToDelete, setOrderToDelete] = useState<SupplierOrder | null>(null);
	const [deleting, setDeleting] = useState(false);

	const dropdownRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Normalizador para busca sem acentos
	const normalizeString = (str: string) =>
		str
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.trim();

	// Real-time Firestore sync para os pedidos a fornecedores
	useEffect(() => {
		const q = query(collection(db, "fornecedorPedidos"), orderBy("createdAt", "desc"));
		const unsubscribe = onSnapshot(
			q,
			(snapshot) => {
				const list: SupplierOrder[] = [];
				snapshot.forEach((docSnap) => {
					const data = docSnap.data();
					list.push({
						id: docSnap.id,
						name: data.name || "",
						category: data.category || "Outros",
						status: data.status || "pending",
						createdAt: data.createdAt,
						completedAt: data.completedAt,
					});
				});
				setOrders(list);
				setLoading(false);
			},
			(err) => {
				console.error("Erro ao carregar pedidos para fornecedores:", err);
				setLoading(false);
			}
		);

		return () => unsubscribe();
	}, []);

	// Real-time Firestore sync para o catálogo geral de insumos
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

					const isDefault = DEFAULT_INSUMOS_CATALOG.some((d) => d.id === id);
					if (isDefault) {
						overrides[id] = item;
					} else {
						customs.push(item);
					}
				});

				setCatalogOverrides(overrides);
				setCustomCatalogItems(customs);
			},
			(err) => {
				console.error("Erro ao sincronizar catálogo de insumos:", err);
			}
		);

		return () => unsubscribe();
	}, []);

	// Catálogo combinado: Padrões + Sobrescritas + Itens Personalizados
	const fullCatalog = useMemo(() => {
		const mergedDefaults = DEFAULT_INSUMOS_CATALOG.map((item) => {
			if (catalogOverrides[item.id]) {
				return { ...item, ...catalogOverrides[item.id] };
			}
			return item;
		});

		return [...mergedDefaults, ...customCatalogItems];
	}, [catalogOverrides, customCatalogItems]);

	// Dicionário rápido do catálogo por ID e nome normalizado
	const catalogMap = useMemo(() => {
		const map = new Map<string, InsumoCatalogItem>();
		fullCatalog.forEach((item) => {
			map.set(item.id, item);
			map.set(normalizeString(item.name), item);
		});
		return map;
	}, [fullCatalog]);

	// Atualiza o item do modal aberto quando o catálogo é modificado
	useEffect(() => {
		if (selectedInsumo) {
			const updated = fullCatalog.find((i) => i.id === selectedInsumo.id);
			if (updated) {
				setSelectedInsumo(updated);
			}
		}
	}, [fullCatalog]);

	// Sugestões filtradas no combobox
	const filteredInventory = useMemo(() => {
		if (!inputName.trim()) return INVENTORY_DATA;

		const norm = normalizeString(inputName);
		return INVENTORY_DATA.map((cat) => ({
			category: cat.category,
			items: cat.items.filter((item) => normalizeString(item).includes(norm)),
		})).filter((cat) => cat.items.length > 0);
	}, [inputName]);

	// Detecta a categoria de um insumo pelo nome
	const findCategoryForItem = (itemName: string): string => {
		const norm = normalizeString(itemName);
		for (const cat of INVENTORY_DATA) {
			for (const item of cat.items) {
				if (normalizeString(item) === norm) {
					return cat.category;
				}
			}
		}
		return "OUTROS";
	};

	// Localiza ou gera o objeto InsumoCatalogItem correspondente ao pedido
	const getInsumoForOrder = (order: SupplierOrder): InsumoCatalogItem => {
		const slug = slugifyInsumoName(order.name);
		const norm = normalizeString(order.name);
		const found = catalogMap.get(slug) || catalogMap.get(norm);
		if (found) return found;

		return {
			id: slug,
			name: order.name,
			category: order.category || findCategoryForItem(order.name),
			valorBom: "",
			valorMaximo: "",
			localCompra: "",
			locaisCompra: [],
			responsaveis: [],
			marca: "",
			observacoes: "",
		};
	};

	// Abertura do modal ao clicar na linha
	const handleRowClick = (order: SupplierOrder) => {
		const insumo = getInsumoForOrder(order);
		setSelectedInsumo(insumo);
		setIsModalOpen(true);
	};

	// Adicionar novo pedido
	const handleAddOrder = async (nameToAdd?: string) => {
		const finalName = (nameToAdd || inputName).trim().toUpperCase();
		if (!finalName) return;

		setAdding(true);
		try {
			const category = findCategoryForItem(finalName);
			await addDoc(collection(db, "fornecedorPedidos"), {
				name: finalName,
				category,
				status: "pending",
				createdAt: serverTimestamp(),
			});

			setInputName("");
			setIsDropdownOpen(false);
		} catch (error) {
			console.error("Erro ao adicionar pedido a fornecedor:", error);
			alert("Erro ao adicionar pedido. Tente novamente.");
		} finally {
			setAdding(false);
		}
	};

	// Alternar status (Pendente / Concluído)
	const handleToggleStatus = async (order: SupplierOrder) => {
		try {
			const newStatus = order.status === "pending" ? "completed" : "pending";
			await updateDoc(doc(db, "fornecedorPedidos", order.id), {
				status: newStatus,
				completedAt: newStatus === "completed" ? serverTimestamp() : null,
			});
		} catch (error) {
			console.error("Erro ao atualizar status:", error);
		}
	};

	// Deletar pedido com modal de confirmação
	const handleRequestDelete = (order: SupplierOrder) => {
		setOrderToDelete(order);
	};

	const handleConfirmDelete = async () => {
		if (!orderToDelete) return;
		setDeleting(true);
		try {
			await deleteDoc(doc(db, "fornecedorPedidos", orderToDelete.id));
			setOrderToDelete(null);
		} catch (error) {
			console.error("Erro ao deletar pedido:", error);
		} finally {
			setDeleting(false);
		}
	};

	// Copiar lista formatada para WhatsApp / Fornecedor
	const handleCopyList = () => {
		const pendingItems = orders.filter((o) => o.status === "pending");
		if (pendingItems.length === 0) {
			alert("Não há pedidos pendentes para copiar.");
			return;
		}

		// Agrupar por categoria
		const groups: Record<string, string[]> = {};
		pendingItems.forEach((item) => {
			const cat = item.category || "DIVERSOS";
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(item.name);
		});

		let text = `📋 *PEDIDO DE INSUMOS - BISCOITO AMERICANO*\n`;
		text += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;
		text += `Total de itens: ${pendingItems.length}\n\n`;

		Object.entries(groups).forEach(([category, items]) => {
			text += `*${category}*\n`;
			items.forEach((item) => {
				text += `• ${item}\n`;
			});
			text += `\n`;
		});

		navigator.clipboard.writeText(text.trim());
		setCopied(true);
		setTimeout(() => setCopied(false), 3000);
	};

	// Itens filtrados para exibição
	const displayedOrders = useMemo(() => {
		return orders.filter((o) => {
			if (statusFilter !== "all" && o.status !== statusFilter) return false;

			const insumo =
				catalogMap.get(slugifyInsumoName(o.name)) ||
				catalogMap.get(normalizeString(o.name));

			// Filtro por tag de responsável
			if (selectedResponsavel !== "all") {
				if (!insumo?.responsaveis || !insumo.responsaveis.includes(selectedResponsavel)) {
					return false;
				}
			}

			if (searchFilter.trim()) {
				const q = normalizeString(searchFilter);
				const matchesName = normalizeString(o.name).includes(q);
				const matchesCategory = normalizeString(o.category || "").includes(q);
				const matchesResponsavel = insumo?.responsaveis?.some((r) =>
					normalizeString(r).includes(q)
				);
				return matchesName || matchesCategory || matchesResponsavel;
			}
			return true;
		});
	}, [orders, statusFilter, selectedResponsavel, searchFilter, catalogMap]);

	const pendingCount = orders.filter((o) => o.status === "pending").length;
	const completedCount = orders.filter((o) => o.status === "completed").length;

	return (
		<div className="space-y-6 max-w-7xl mx-auto px-4 pb-16">
			{/* Header Card */}
			<section className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
								<ShoppingCart size={24} />
							</div>
							<div>
								<h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
									Pedidos a Fornecedores
								</h1>
								<p className="text-sm font-medium text-slate-500 dark:text-slate-400">
									Lista de consulta e compra de insumos a serem encomendados para as lojas
								</p>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
							<Clock size={16} className="text-amber-600 dark:text-amber-400" />
							<span className="text-xs font-bold text-amber-900 dark:text-amber-200">
								<strong>{pendingCount}</strong> a comprar
							</span>
						</div>
						<div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
							<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
							<span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
								<strong>{completedCount}</strong> comprados
							</span>
						</div>
						<button
							onClick={handleCopyList}
							disabled={pendingCount === 0}
							className="cursor-pointer bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold px-4 py-2.5 rounded-2xl transition-all flex items-center gap-2 text-xs md:text-sm shadow-sm disabled:opacity-40 active:scale-95">
							{copied ? (
								<>
									<Check size={16} className="text-emerald-400" />
									<span>Copiado!</span>
								</>
							) : (
								<>
									<Copy size={16} />
									<span>Copiar Lista</span>
								</>
							)}
						</button>
					</div>
				</div>
			</section>

			{/* Inserção de Pedidos via Caixa de Texto com Opções */}
			<section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors relative z-30">
				<div className="mb-4">
					<h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
						<Plus className="text-blue-600 dark:text-blue-400" size={22} />
						Inserir Insumo para Pedido
					</h2>
					<p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
						Selecione nas opções padrão da loja ou digite manualmente qualquer insumo desejado.
					</p>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleAddOrder();
					}}
					className="flex flex-col sm:flex-row gap-3 items-stretch relative">
					<div className="relative flex-1" ref={dropdownRef}>
						<input
							ref={inputRef}
							type="text"
							required
							placeholder="DIGITE OU BUSQUE O INSUMO..."
							value={inputName}
							onFocus={() => setIsDropdownOpen(true)}
							onBlur={() => setTimeout(() => setIsDropdownOpen(false), 250)}
							onChange={(e) => {
								setInputName(e.target.value.toUpperCase());
								setIsDropdownOpen(true);
							}}
							autoComplete="off"
							className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-100 font-bold placeholder:font-medium uppercase text-sm md:text-base pr-10"
						/>
						<div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
							<ChevronDown size={18} />
						</div>

						{/* Dropdown Combobox com Categorias */}
						{isDropdownOpen && (
							<div className="absolute left-0 right-0 top-full mt-2 max-h-[340px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
								{filteredInventory.length > 0 ? (
									filteredInventory.map((category) => (
										<div key={category.category}>
											<div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[0.65rem] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider border-y border-slate-200/60 dark:border-slate-700/60 first:border-t-0 sticky top-0 backdrop-blur-sm">
												{category.category}
											</div>
											{category.items.map((item) => (
												<div
													key={item}
													onMouseDown={(e) => {
														e.preventDefault();
														handleAddOrder(item);
													}}
													className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between group">
													<span>{item}</span>
													<span className="text-[11px] font-medium text-slate-400 group-hover:text-blue-500 flex items-center gap-1">
														<Plus size={14} /> Adicionar
													</span>
												</div>
											))}
										</div>
									))
								) : inputName.trim() !== "" ? (
									<div
										onMouseDown={(e) => {
											e.preventDefault();
											handleAddOrder();
										}}
										className="p-4 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
										<p className="text-xs font-bold text-slate-400 uppercase">
											Insumo personalizado não listado:
										</p>
										<p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-1">
											Adicionar "{inputName}"
										</p>
										<span className="inline-block mt-2 text-2xs px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg font-bold">
											Clique ou pressione Enter para inserir
										</span>
									</div>
								) : null}
							</div>
						)}
					</div>

					<button
						type="submit"
						disabled={adding || !inputName.trim()}
						className="cursor-pointer bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3.5 rounded-2xl shadow-md shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2 text-sm md:text-base shrink-0 active:scale-95">
						{adding ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
						<span>Inserir Pedido</span>
					</button>
				</form>
			</section>

			{/* Consulta de Pedidos */}
			<section className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 transition-colors space-y-6">
				{/* Controles de Filtro e Busca */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full md:w-auto">
						<button
							onClick={() => setStatusFilter("pending")}
							className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all ${
								statusFilter === "pending"
									? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900"
							}`}>
							Pendentes ({pendingCount})
						</button>
						<button
							onClick={() => setStatusFilter("completed")}
							className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all ${
								statusFilter === "completed"
									? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900"
							}`}>
							Comprados ({completedCount})
						</button>
						<button
							onClick={() => setStatusFilter("all")}
							className={`cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all ${
								statusFilter === "all"
									? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:text-slate-900"
							}`}>
							Todos ({orders.length})
						</button>
					</div>

					<div className="relative w-full md:w-72">
						<Search
							size={16}
							className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
						/>
						<input
							type="text"
							placeholder="Buscar por insumo ou responsável..."
							value={searchFilter}
							onChange={(e) => setSearchFilter(e.target.value)}
							className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs md:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						{searchFilter && (
							<button
								onClick={() => setSearchFilter("")}
								className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
								<X size={14} />
							</button>
						)}
					</div>
				</div>

				{/* Filtro por Tags de Responsáveis */}
				<div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
					<span className="text-2xs font-black uppercase tracking-wider text-slate-400 mr-1">
						Filtrar por Responsável:
					</span>
					<button
						type="button"
						onClick={() => setSelectedResponsavel("all")}
						className={`cursor-pointer px-3 py-1 rounded-lg text-2xs font-black uppercase tracking-wider border transition-all ${
							selectedResponsavel === "all"
								? "bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700 shadow-sm"
								: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
						}`}>
						Todos
					</button>
					{RESPONSAVEIS_COMPRA.map((nome) => (
						<ResponsavelTag
							key={nome}
							nome={nome}
							selected={selectedResponsavel === nome}
							onClick={() =>
								setSelectedResponsavel(selectedResponsavel === nome ? "all" : nome)
							}
						/>
					))}
				</div>

				<div className="flex items-center gap-1.5 text-2xs text-slate-400 font-medium">
					<Info size={14} className="text-blue-500 shrink-0" />
					<span>
						Clique em qualquer linha para visualizar e editar os parâmetros de compra do insumo.
					</span>
				</div>

				{/* Tabela / Lista de Consulta */}
				{loading ? (
					<div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
						<RefreshCw className="animate-spin text-blue-600" size={32} />
						<span className="text-sm font-bold">Carregando pedidos a fornecedores...</span>
					</div>
				) : displayedOrders.length === 0 ? (
					<div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8">
						<ClipboardList className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={48} />
						<h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
							Nenhum pedido encontrado
						</h3>
						<p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
							{searchFilter || selectedResponsavel !== "all"
								? "Nenhum insumo coincide com os filtros pesquisados."
								: statusFilter === "pending"
								? "Não há pedidos pendentes no momento. Digite na caixa acima para inserir."
								: "Nenhum insumo neste filtro."}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
						<table className="w-full text-left text-sm">
							<thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-800">
								<tr>
									<th className="py-3.5 px-4 w-12 text-center">Status</th>
									<th className="py-3.5 px-4 min-w-[200px]">Insumo</th>
									<th className="py-3.5 px-4 min-w-[150px]">Responsável</th>
									<th className="py-3.5 px-4">Categoria</th>
									<th className="py-3.5 px-4 hidden sm:table-cell">Data de Inserção</th>
									<th className="py-3.5 px-4 text-right">Ações</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
								{displayedOrders.map((order) => {
									const isCompleted = order.status === "completed";
									const dateStr = order.createdAt?.toDate
										? formatDate(order.createdAt.toDate())
										: "Recente";
									const insumo = getInsumoForOrder(order);

									return (
										<tr
											key={order.id}
											onClick={() => handleRowClick(order)}
											className={`cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors group ${
												isCompleted ? "opacity-60 bg-slate-50/40 dark:bg-slate-900/30" : ""
											}`}>
											{/* Status Checkbox */}
											<td
												className="py-3 px-4 text-center"
												onClick={(e) => e.stopPropagation()}>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleToggleStatus(order);
													}}
													title={isCompleted ? "Marcar como pendente" : "Marcar como comprado"}
													className={`cursor-pointer w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
														isCompleted
															? "bg-emerald-500 text-white shadow-sm"
															: "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-transparent"
													}`}>
													<Check size={14} />
												</button>
											</td>

											{/* Nome do Insumo com Data visível no mobile */}
											<td className="py-3 px-4">
												<div className="flex flex-col">
													<span
														className={`font-black text-slate-800 dark:text-slate-100 uppercase text-xs md:text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
															isCompleted ? "line-through text-slate-400 dark:text-slate-500" : ""
														}`}>
														{order.name}
													</span>
													<span className="sm:hidden text-2xs text-slate-400 font-medium mt-0.5">
														{dateStr}
													</span>
												</div>
											</td>

											{/* Coluna Responsável (Tags Rodrigo, Ana, Edson) */}
											<td className="py-3 px-4">
												<ResponsavelTagsList responsaveis={insumo.responsaveis} />
											</td>

											{/* Categoria */}
											<td className="py-3 px-4">
												<span className="inline-block px-2.5 py-1 rounded-lg text-2xs font-black tracking-wide uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
													{order.category || "Outros"}
												</span>
											</td>

											{/* Data (Desktop / Tablet) */}
											<td className="py-3 px-4 hidden sm:table-cell text-xs text-slate-400">
												{dateStr}
											</td>

											{/* Botão Remover */}
											<td
												className="py-3 px-4 text-right"
												onClick={(e) => e.stopPropagation()}>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleRequestDelete(order);
													}}
													title="Remover insumo"
													className="cursor-pointer p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
													<Trash2 size={16} />
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

			{/* Modal de Confirmação de Exclusão */}
			{orderToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
						<div className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 mx-auto">
							<AlertTriangle size={32} />
						</div>
						<h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">
							Remover Pedido?
						</h3>
						<p className="text-slate-500 dark:text-slate-400 text-center font-medium text-xs sm:text-sm mb-6">
							Deseja remover <strong>{orderToDelete.name}</strong> da lista de pedidos a fornecedores?
						</p>
						<div className="flex flex-col gap-2.5">
							<button
								onClick={handleConfirmDelete}
								disabled={deleting}
								className="cursor-pointer w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl transition-all shadow-md shadow-red-200 dark:shadow-none flex items-center justify-center gap-2 text-sm">
								{deleting ? (
									<>
										<RefreshCw size={16} className="animate-spin" />
										<span>Removendo...</span>
									</>
								) : (
									<span>Sim, remover insumo</span>
								)}
							</button>
							<button
								onClick={() => setOrderToDelete(null)}
								disabled={deleting}
								className="cursor-pointer w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-2xl transition-all text-sm">
								Cancelar
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Modal de Detalhes e Edição de Parâmetros do Insumo */}
			<InsumoModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				item={selectedInsumo}
				onSaved={(updated) => {
					setSelectedInsumo(updated);
				}}
			/>
		</div>
	);
}
