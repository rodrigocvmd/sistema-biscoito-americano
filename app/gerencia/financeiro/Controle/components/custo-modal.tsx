"use client";

import { useState, useEffect, useRef } from "react";
import {
	X,
	DollarSign,
	CheckCircle2,
	Clock,
	Plus,
	Trash2,
	Upload,
	FileText,
	Image as ImageIcon,
	ExternalLink,
	Link2,
	Edit2,
	Check,
	Loader2,
} from "lucide-react";
import {
	CustoAnexo,
	CustoFinanceiro,
	CategoriaCusto,
	CATEGORIAS_CUSTO_CONFIG,
	STORE_NAMES_EXTENDED,
	StoreIdWithGeral,
	MetodoPagamento,
	SPECIFIC_STORE_IDS,
	isGeneralOnlyCostCategory,
	isSpecificStoreId,
} from "@/types/financeiro-controle";
import {
	uploadCustoAnexo,
	resolveCustoAnexoUrl,
	openCustoAnexo,
	deleteCustoAnexoStorage,
	updateCusto,
} from "@/lib/financeiro-controle-service";
import { CurrencyInput } from "@/components/currency-input";
import { DateInputBR } from "@/components/date-input-br";

export type ExtraFieldMode = "forbidden" | "required" | "optional";

interface CustoModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: Omit<CustoFinanceiro, "id" | "createdAt" | "updatedAt">) => Promise<void>;
	onDelete?: (id: string) => Promise<void> | void;
	editingCusto?: CustoFinanceiro | null;
	defaultCategoria?: CategoriaCusto;
	defaultLoja?: StoreIdWithGeral;
	defaultData?: string;
	defaultIsExtra?: boolean;
	extraMode?: ExtraFieldMode;
}

const MESES = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

const formatFileSize = (bytes: number) => {
	if (!bytes || bytes <= 0) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
};

const normalizeExternalUrl = (raw: string): string => {
	const trimmed = raw.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
};

export default function CustoModal({
	isOpen,
	onClose,
	onSave,
	onDelete,
	editingCusto,
	defaultCategoria = "cookies",
	defaultLoja = "geral",
	defaultData,
	defaultIsExtra = false,
	extraMode,
}: CustoModalProps) {
	const resolvedExtraMode: ExtraFieldMode = editingCusto
		? editingCusto.isExtra
			? "required"
			: "forbidden"
		: extraMode ?? (defaultIsExtra ? "required" : "optional");

	const [categoria, setCategoria] = useState<CategoriaCusto>(defaultCategoria);
	const [lojaId, setLojaId] = useState<StoreIdWithGeral | "">(
		isGeneralOnlyCostCategory(defaultCategoria)
			? "geral"
			: isSpecificStoreId(defaultLoja)
			? defaultLoja
			: ""
	);
	const [isExtra, setIsExtra] = useState(
		resolvedExtraMode === "required" ? true : resolvedExtraMode === "forbidden" ? false : defaultIsExtra
	);
	const [dataCusto, setDataCusto] = useState("");
	const [extraMes, setExtraMes] = useState<number>(() => new Date().getMonth() + 1);
	const [extraAno, setExtraAno] = useState<number>(() => new Date().getFullYear());
	const [multiDatasEnabled, setMultiDatasEnabled] = useState(false);
	const [multiDatas, setMultiDatas] = useState<string[]>([]);
	const [descricao, setDescricao] = useState("");
	const [valor, setValor] = useState("");
	const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>("pix");
	const [status, setStatus] = useState<"pago" | "pendente">("pendente");
	const [observacoes, setObservacoes] = useState("");

	// Anexos e Link
	const [anexos, setAnexos] = useState<CustoAnexo[]>([]);
	const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
	const [isUploadingAnexo, setIsUploadingAnexo] = useState(false);
	const [isDraggingFile, setIsDraggingFile] = useState(false);

	const [savedLink, setSavedLink] = useState("");
	const [linkInput, setLinkInput] = useState("");
	const [isEditingLink, setIsEditingLink] = useState(true);
	const [isSavingLink, setIsSavingLink] = useState(false);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const valorInputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const sessionUploadedAnexosRef = useRef<CustoAnexo[]>([]);
	const lastSpecificLojaRef = useRef<StoreIdWithGeral | "">(
		isSpecificStoreId(defaultLoja) ? defaultLoja : ""
	);

	useEffect(() => {
		if (isOpen) {
			sessionUploadedAnexosRef.current = [];
			setResolvedUrls({});
			setIsDraggingFile(false);
			setIsUploadingAnexo(false);

			const now = new Date();
			const currentYear = now.getFullYear();
			const currentMonth = now.getMonth() + 1;

			if (editingCusto) {
				const initCat = editingCusto.categoria;
				const specLoja = isSpecificStoreId(editingCusto.lojaId)
					? editingCusto.lojaId
					: isSpecificStoreId(defaultLoja)
					? defaultLoja
					: "";
				lastSpecificLojaRef.current = specLoja;

				const mesRefStr =
					editingCusto.mesReferencia ||
					(editingCusto.data ? editingCusto.data.slice(0, 7) : "") ||
					`${currentYear}-${String(currentMonth).padStart(2, "0")}`;
				const [refAno, refMes] = mesRefStr.split("-").map((p) => parseInt(p, 10));

				setCategoria(initCat);
				setLojaId(isGeneralOnlyCostCategory(initCat) ? "geral" : specLoja);
				setIsExtra(!!editingCusto.isExtra);
				setDataCusto(editingCusto.data || `${mesRefStr}-01`);
				setExtraAno(!isNaN(refAno) ? refAno : currentYear);
				setExtraMes(!isNaN(refMes) && refMes >= 1 && refMes <= 12 ? refMes : currentMonth);
				setMultiDatasEnabled(false);
				setMultiDatas([]);
				setDescricao(editingCusto.descricao);
				setValor(editingCusto.valor ? String(Math.round(editingCusto.valor)) : "");
				setMetodoPagamento(editingCusto.metodoPagamento || "pix");
				setStatus(editingCusto.status === "pendente" ? "pendente" : "pago");
				setObservacoes(editingCusto.observacoes || "");

				const initialAnexos: CustoAnexo[] =
					Array.isArray(editingCusto.anexos) && editingCusto.anexos.length > 0
						? editingCusto.anexos
						: editingCusto.comprovanteUrl
						? [
								{
									id: "legacy-comprovante",
									nome: "Comprovante anexo",
									tipo: "application/octet-stream",
									tamanho: 0,
									url: editingCusto.comprovanteUrl,
									uploadedAt: "",
								},
						  ]
						: [];
				setAnexos(initialAnexos);

				// Pré-carregar URLs dos anexos salvos no Firestore para abertura instantânea com 1 clique
				initialAnexos.forEach(async (ax) => {
					if (!ax.url && ax.anexoDocId) {
						try {
							const blobUrl = await resolveCustoAnexoUrl(ax);
							setResolvedUrls((prev) => ({ ...prev, [ax.id]: blobUrl }));
						} catch (err) {
							console.warn("Não foi possível pré-carregar anexo:", err);
						}
					}
				});

				const initLink = editingCusto.link ? normalizeExternalUrl(editingCusto.link) : "";
				setSavedLink(initLink);
				setLinkInput(initLink);
				setIsEditingLink(!initLink);
			} else {
				const year = now.getFullYear();
				const month = String(now.getMonth() + 1).padStart(2, "0");
				const day = String(now.getDate()).padStart(2, "0");
				const todayStr = `${year}-${month}-${day}`;
				const initialDate = defaultData || todayStr;
				const specLoja = isSpecificStoreId(defaultLoja) ? defaultLoja : "";
				lastSpecificLojaRef.current = specLoja;

				const mesRefStr = initialDate.slice(0, 7);
				const [refAno, refMes] = mesRefStr.split("-").map((p) => parseInt(p, 10));

				const initialExtra =
					resolvedExtraMode === "required"
						? true
						: resolvedExtraMode === "forbidden"
						? false
						: !!defaultIsExtra;

				setCategoria(defaultCategoria);
				setLojaId(isGeneralOnlyCostCategory(defaultCategoria) ? "geral" : specLoja);
				setIsExtra(initialExtra);
				setDataCusto(initialDate);
				setExtraAno(!isNaN(refAno) ? refAno : year);
				setExtraMes(!isNaN(refMes) && refMes >= 1 && refMes <= 12 ? refMes : now.getMonth() + 1);
				setMultiDatasEnabled(false);
				setMultiDatas([initialDate, initialDate]);
				setDescricao("");
				setValor("");
				setMetodoPagamento("pix");
				setStatus("pendente");
				setObservacoes("");
				setAnexos([]);
				setSavedLink("");
				setLinkInput("");
				setIsEditingLink(true);
			}

			// Focar e selecionar automaticamente o campo de valor financeiro
			setTimeout(() => {
				if (valorInputRef.current) {
					valorInputRef.current.focus();
					valorInputRef.current.select();
				}
			}, 100);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, editingCusto, defaultCategoria, defaultLoja, defaultData, defaultIsExtra, extraMode]);

	if (!isOpen) return null;

	const catConfig = CATEGORIAS_CUSTO_CONFIG[categoria];
	const isGeneralOnly = isGeneralOnlyCostCategory(categoria);

	const handleSelectCategoria = (nextCat: CategoriaCusto) => {
		setCategoria(nextCat);
		if (isGeneralOnlyCostCategory(nextCat)) {
			setLojaId("geral");
		} else {
			setLojaId((prev) => (prev && isSpecificStoreId(prev) ? prev : lastSpecificLojaRef.current || ""));
		}
	};

	const handleSelectLoja = (nextLoja: string) => {
		setLojaId(nextLoja as StoreIdWithGeral | "");
		if (isSpecificStoreId(nextLoja)) {
			lastSpecificLojaRef.current = nextLoja;
		}
	};

	const handleCancelModal = async () => {
		// Se cancelar um novo lançamento que já subiu arquivos nesta sessão, remove arquivos órfãos da database
		if (!editingCusto && sessionUploadedAnexosRef.current.length > 0) {
			await Promise.allSettled(
				sessionUploadedAnexosRef.current.map((ax) => deleteCustoAnexoStorage(ax))
			);
			sessionUploadedAnexosRef.current = [];
		}
		onClose();
	};

	const handleFilesUpload = async (fileList: FileList | File[]) => {
		const files = Array.from(fileList);
		if (files.length === 0) return;

		setIsUploadingAnexo(true);
		try {
			const uploadedList: CustoAnexo[] = [];
			for (const file of files) {
				const anexo = await uploadCustoAnexo(file);
				uploadedList.push(anexo);

				// Se salvou no Firestore, gera URL de objeto local imediatamente para abertura com 1 clique
				if (!anexo.url) {
					const localBlobUrl = URL.createObjectURL(file);
					setResolvedUrls((prev) => ({ ...prev, [anexo.id]: localBlobUrl }));
				}
			}

			const nextAnexos = [...anexos, ...uploadedList];
			setAnexos(nextAnexos);

			if (editingCusto) {
				await updateCusto(editingCusto.id, { anexos: nextAnexos });
			} else {
				sessionUploadedAnexosRef.current = [
					...sessionUploadedAnexosRef.current,
					...uploadedList,
				];
			}
		} catch (err: unknown) {
			console.error("Erro ao anexar arquivo:", err);
			const message = err instanceof Error ? err.message : undefined;
			alert(message || "Não foi possível anexar o arquivo selecionado.");
		} finally {
			setIsUploadingAnexo(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleRemoveAnexo = async (target: CustoAnexo) => {
		try {
			await deleteCustoAnexoStorage(target);
			const nextAnexos = anexos.filter((ax) => ax.id !== target.id);
			setAnexos(nextAnexos);
			sessionUploadedAnexosRef.current = sessionUploadedAnexosRef.current.filter(
				(ax) => ax.id !== target.id
			);

			if (editingCusto) {
				await updateCusto(editingCusto.id, { anexos: nextAnexos });
			}
		} catch (err) {
			console.error("Erro ao deletar anexo:", err);
			alert("Não foi possível excluir o arquivo anexo.");
		}
	};

	const handleSaveLinkInline = async () => {
		const normalized = normalizeExternalUrl(linkInput);
		if (!normalized) {
			setSavedLink("");
			setLinkInput("");
			setIsEditingLink(true);
			if (editingCusto) {
				setIsSavingLink(true);
				try {
					await updateCusto(editingCusto.id, { link: "" });
				} finally {
					setIsSavingLink(false);
				}
			}
			return;
		}

		setSavedLink(normalized);
		setLinkInput(normalized);
		setIsEditingLink(false);

		if (editingCusto) {
			setIsSavingLink(true);
			try {
				await updateCusto(editingCusto.id, { link: normalized });
			} catch (err) {
				console.error("Erro ao salvar link:", err);
				alert("Não foi possível salvar o link na database.");
			} finally {
				setIsSavingLink(false);
			}
		}
	};

	const handleRemoveLink = async () => {
		setSavedLink("");
		setLinkInput("");
		setIsEditingLink(true);
		if (editingCusto) {
			setIsSavingLink(true);
			try {
				await updateCusto(editingCusto.id, { link: "" });
			} catch (err) {
				console.error("Erro ao remover link:", err);
			} finally {
				setIsSavingLink(false);
			}
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const finalLojaId: StoreIdWithGeral | "" = isGeneralOnly ? "geral" : lojaId;
		if (!isGeneralOnly && !isSpecificStoreId(finalLojaId)) {
			alert("Para este tipo de custo, selecione uma loja específica (Lago, Terraço, Conjunto ou Noroeste).");
			return;
		}

		const defaultDesc = catConfig?.label || "Custo";
		const finalDescricao = descricao.trim() || defaultDesc;

		const cleanedVal = valor.replace(/\D/g, "").trim();
		const valNum = cleanedVal ? parseInt(cleanedVal, 10) : 0;
		if (isNaN(valNum) || valNum <= 0) {
			alert("Por favor, insira um valor monetário válido maior que zero.");
			return;
		}

		const finalLink = isEditingLink
			? normalizeExternalUrl(linkInput)
			: savedLink;
		const linkPayload = finalLink || (editingCusto ? "" : undefined);

		const extraMesRef = `${extraAno}-${String(extraMes).padStart(2, "0")}`;

		if (multiDatasEnabled && !editingCusto && !isExtra) {
			const filledDates = multiDatas.map((d) => d.trim()).filter(Boolean);
			if (filledDates.length < 2) {
				alert("Por favor, selecione 2 ou mais datas para realizar o lançamento múltiplo.");
				return;
			}
			if (multiDatas.some((d) => !d.trim())) {
				alert("Por favor, preencha todas as datas adicionadas ou remova as linhas vazias.");
				return;
			}

			setIsSubmitting(true);
			try {
				for (const d of filledDates) {
					await onSave({
						categoria,
						lojaId: finalLojaId as StoreIdWithGeral,
						descricao: finalDescricao,
						valor: Math.round(valNum),
						data: d,
						mesReferencia: d.slice(0, 7),
						metodoPagamento,
						status,
						observacoes: observacoes.trim() || undefined,
						anexos: anexos.length > 0 ? anexos : undefined,
						link: linkPayload,
					});
				}
				sessionUploadedAnexosRef.current = [];
				onClose();
			} catch (error) {
				console.error("Erro ao salvar custos:", error);
				alert("Erro ao salvar lançamentos de custo.");
			} finally {
				setIsSubmitting(false);
			}
			return;
		}

		if (!isExtra && !dataCusto) {
			alert("O dia do custo é obrigatório.");
			return;
		}

		const finalData = isExtra ? "" : dataCusto;
		const mesReferencia = isExtra ? extraMesRef : dataCusto.slice(0, 7);

		setIsSubmitting(true);
		try {
			await onSave({
				categoria,
				lojaId: finalLojaId as StoreIdWithGeral,
				descricao: finalDescricao,
				valor: Math.round(valNum),
				data: finalData,
				mesReferencia,
				metodoPagamento,
				status,
				observacoes: editingCusto ? observacoes.trim() : observacoes.trim() || undefined,
				anexos: editingCusto ? anexos : anexos.length > 0 ? anexos : undefined,
				link: linkPayload,
				isExtra: isExtra ? true : undefined,
			});
			sessionUploadedAnexosRef.current = [];
			onClose();
		} catch (error) {
			console.error("Erro ao salvar custo:", error);
			alert("Erro ao salvar lançamento de custo.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const isImageAnexo = (ax: CustoAnexo) =>
		ax.tipo?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(ax.nome);

	return (
		<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200">
			<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
				{/* Header */}
				<div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
					<div className="flex items-center gap-2.5">
						<span className="p-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs">
							<DollarSign size={20} />
						</span>
						<div>
							<h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
								{editingCusto ? "Editar Custo / Despesa" : "Lançar Novo Custo"}
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400">
								{isExtra
									? "Custo extra do mês (sem dia específico)"
									: "Controle de custos operacionais com data obrigatória"}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={handleCancelModal}
						className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
						<X size={20} />
					</button>
				</div>

				{/* Formulário */}
				<form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
					{/* Categoria do Custo (Select sem círculos coloridos) + Situação do Pagamento */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
						<div>
							<label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
								Tipo de Custo <span className="text-rose-500">*</span>
							</label>
							<select
								required
								value={categoria}
								onChange={(e) => handleSelectCategoria(e.target.value as CategoriaCusto)}
								className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
								{Object.entries(CATEGORIAS_CUSTO_CONFIG).map(([key, cfg]) => (
									<option key={key} value={key}>
										{cfg.label}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
								Situação do Pagamento
							</label>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setStatus("pendente")}
									className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
										status === "pendente"
											? "border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-2 ring-red-500/20"
											: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
									}`}>
									<Clock size={14} />
									<span>A Pagar</span>
								</button>

								<button
									type="button"
									onClick={() => setStatus("pago")}
									className={`py-2 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
										status === "pago"
											? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20"
											: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
									}`}>
									<CheckCircle2 size={14} />
									<span>Pago</span>
								</button>
							</div>
						</div>
					</div>

					{/* Custo Extra do Mês: apenas faixa informativa quando obrigatório; checkbox apenas se opcional; oculto em células normais */}
					{resolvedExtraMode === "required" && (
						<div className="flex items-center justify-between gap-2 p-2.5 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/80 dark:border-purple-900/50">
							<span className="text-xs font-bold text-purple-900 dark:text-purple-200">
								Lançamento de Custo Extra do Mês (alocado na coluna Extras)
							</span>
							<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 shrink-0">
								Coluna Extra
							</span>
						</div>
					)}

					{resolvedExtraMode === "optional" && (
						<div className="flex items-center justify-between p-2.5 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200/80 dark:border-purple-900/50">
							<label className="flex items-center gap-2.5 cursor-pointer select-none">
								<input
									type="checkbox"
									checked={isExtra}
									onChange={(e) => {
										setIsExtra(e.target.checked);
										if (e.target.checked) {
											setMultiDatasEnabled(false);
										}
									}}
									className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 cursor-pointer"
								/>
								<span className="text-xs font-bold text-purple-900 dark:text-purple-200">
									Custo Extra do Mês (alocado na coluna Extras)
								</span>
							</label>
							{isExtra && (
								<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
									Coluna Extra
								</span>
							)}
						</div>
					)}

					{/* Checkbox para múltiplas datas */}
					{!editingCusto && !isExtra && (
						<div className="flex items-center justify-between p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-900/50">
							<label className="flex items-center gap-2.5 cursor-pointer select-none">
								<input
									type="checkbox"
									checked={multiDatasEnabled}
									onChange={(e) => {
										const checked = e.target.checked;
										setMultiDatasEnabled(checked);
										if (checked && multiDatas.length < 2) {
											const baseDate = dataCusto || new Date().toISOString().split("T")[0];
											setMultiDatas([baseDate, baseDate]);
										}
									}}
									className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer"
								/>
								<span className="text-xs font-bold text-blue-900 dark:text-blue-200">
									Lançar em datas diversas (mesmo custo em múltiplas datas)
								</span>
							</label>
							{multiDatasEnabled && (
								<span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
									Mínimo 2 datas
								</span>
							)}
						</div>
					)}

					{multiDatasEnabled && !editingCusto && !isExtra ? (
						<>
							{/* Linha: Unidade / Loja */}
							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Unidade / Loja {!isGeneralOnly && <span className="text-rose-500">*</span>}
								</label>
								{isGeneralOnly ? (
									<>
										<select
											value="geral"
											disabled
											className="w-full bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3 py-2.5 text-xs font-bold text-amber-900 dark:text-amber-200 cursor-not-allowed">
											<option value="geral">Geral / Matriz (Todas as Lojas)</option>
										</select>
										<p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
											Custos de Cookies e Insumos são lançados apenas em Geral/Matriz e rateados proporcionalmente pelo faturamento mensal das 4 lojas.
										</p>
									</>
								) : (
									<select
										required
										value={lojaId === "geral" ? "" : lojaId}
										onChange={(e) => handleSelectLoja(e.target.value)}
										className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
										<option value="" disabled>
											Selecione uma loja...
										</option>
										{SPECIFIC_STORE_IDS.map((sId) => (
											<option key={sId} value={sId}>
												{STORE_NAMES_EXTENDED[sId]}
											</option>
										))}
									</select>
								)}
							</div>

							{/* Bloco de Múltiplas Datas */}
							<div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
								<div className="flex items-center justify-between">
									<label className="block text-xs font-black text-slate-700 dark:text-slate-300">
										Datas de Lançamento <span className="text-rose-500">*</span>
										<span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
											({multiDatas.filter(Boolean).length} data(s) preenchida(s))
										</span>
									</label>
									<button
										type="button"
										onClick={() => {
											setMultiDatas((prev) => {
												const lastDate = prev[prev.length - 1] || dataCusto || "";
												return [...prev, lastDate];
											});
										}}
										className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
										<Plus size={14} /> Adicionar data
									</button>
								</div>

								<div className="space-y-2">
									{multiDatas.map((dt, idx) => (
										<div key={idx} className="flex items-center gap-2">
											<span className="text-xs font-bold text-slate-400 w-5 text-right">{idx + 1}.</span>
											<div className="flex-1">
												<DateInputBR
													required
													value={dt}
													onChangeDate={(iso) => {
														setMultiDatas((prev) => {
															const updated = [...prev];
															updated[idx] = iso;
															return updated;
														});
													}}
													onClick={(e) => e.currentTarget.select()}
													className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
												/>
											</div>
											{multiDatas.length > 2 && (
												<button
													type="button"
													onClick={() => setMultiDatas((prev) => prev.filter((_, i) => i !== idx))}
													className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
													title="Remover data">
													<Trash2 size={16} />
												</button>
											)}
										</div>
									))}
								</div>
							</div>
						</>
					) : (
						/* Linha: Data (ou Mês de Referência quando Extra) e Loja */
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
							{isExtra ? (
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
										<span>
											Mês de Referência <span className="text-rose-500">*</span>
										</span>
										<span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
											Sem dia específico
										</span>
									</label>
									<div className="grid grid-cols-3 gap-2">
										<select
											value={extraMes}
											aria-label="Mês de referência do custo extra"
											onChange={(e) => setExtraMes(parseInt(e.target.value, 10))}
											className="col-span-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500">
											{MESES.map((nome, idx) => (
												<option key={idx + 1} value={idx + 1}>
													{nome}
												</option>
											))}
										</select>
										<select
											value={extraAno}
											aria-label="Ano de referência do custo extra"
											onChange={(e) => setExtraAno(parseInt(e.target.value, 10))}
											className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500">
											{[2024, 2025, 2026, 2027, 2028].map((y) => (
												<option key={y} value={y}>
													{y}
												</option>
											))}
										</select>
									</div>
								</div>
							) : (
								<div>
									<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
										<span>
											Data do Custo <span className="text-rose-500">*</span>
										</span>
										<span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
											Obrigatório
										</span>
									</label>
									<div className="relative">
										<DateInputBR
											required
											value={dataCusto}
											onChangeDate={(iso) => setDataCusto(iso)}
											onClick={(e) => e.currentTarget.select()}
											className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
										/>
									</div>
								</div>
							)}

							<div>
								<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
									Unidade / Loja {!isGeneralOnly && <span className="text-rose-500">*</span>}
								</label>
								{isGeneralOnly ? (
									<>
										<select
											value="geral"
											disabled
											className="w-full bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3 py-2.5 text-xs font-bold text-amber-900 dark:text-amber-200 cursor-not-allowed">
											<option value="geral">Geral / Matriz (Todas as Lojas)</option>
										</select>
										<p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 leading-snug">
											Rateado automaticamente entre as 4 lojas pelo faturamento do mês.
										</p>
									</>
								) : (
									<select
										required
										value={lojaId === "geral" ? "" : lojaId}
										onChange={(e) => handleSelectLoja(e.target.value)}
										className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
										<option value="" disabled>
											Selecione uma loja...
										</option>
										{SPECIFIC_STORE_IDS.map((sId) => (
											<option key={sId} value={sId}>
												{STORE_NAMES_EXTENDED[sId]}
											</option>
										))}
									</select>
								)}
							</div>
						</div>
					)}

					{/* Descrição do Custo */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
							<span>Descrição do Custo</span>
							<span className="text-[10px] text-slate-400 font-normal">
								Opcional (padrão: {catConfig?.label || "Tipo de custo"})
							</span>
						</label>
						<input
							type="text"
							placeholder={`Padrão: ${catConfig?.label || "Tipo de custo"}`}
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>

					{/* Valor Monetário */}
					<div>
						<label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
							Valor do Custo (R$) <span className="text-rose-500">*</span>
						</label>
						<div className="relative">
							<span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
								R$
							</span>
							<CurrencyInput
								ref={valorInputRef}
								required
								integerOnly
								selectAllOnClick
								placeholder="0"
								value={valor}
								onChangeValue={(num, str) => setValor(str)}
								className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-black text-rose-600 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
							/>
						</div>
					</div>

					{/* Anexos (Documentos / Imagens) e Link — logo antes de Observações */}
					<div className="space-y-3 pt-1">
						{/* Upload / Drag-and-drop de arquivos */}
						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
								<span>Anexar Arquivo (Documento ou Imagem)</span>
								<span className="text-[10px] text-slate-400 font-normal">Opcional</span>
							</label>

							<input
								ref={fileInputRef}
								type="file"
								multiple
								accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.xml,.ppt,.pptx,.zip,.rar"
								onChange={(e) => {
									if (e.target.files) {
										handleFilesUpload(e.target.files);
									}
								}}
								className="hidden"
							/>

							<div
								role="button"
								tabIndex={0}
								onClick={() => !isUploadingAnexo && fileInputRef.current?.click()}
								onKeyDown={(e) => {
									if ((e.key === "Enter" || e.key === " ") && !isUploadingAnexo) {
										e.preventDefault();
										fileInputRef.current?.click();
									}
								}}
								onDragEnter={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setIsDraggingFile(true);
								}}
								onDragOver={(e) => {
									e.preventDefault();
									e.stopPropagation();
									if (!isDraggingFile) setIsDraggingFile(true);
								}}
								onDragLeave={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setIsDraggingFile(false);
								}}
								onDrop={(e) => {
									e.preventDefault();
									e.stopPropagation();
									setIsDraggingFile(false);
									if (e.dataTransfer?.files && e.dataTransfer.files.length > 0 && !isUploadingAnexo) {
										handleFilesUpload(e.dataTransfer.files);
									}
								}}
								className={`border-2 border-dashed rounded-2xl p-3.5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
									isDraggingFile
										? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
										: "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-blue-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-600 dark:text-slate-300"
								}`}>
								{isUploadingAnexo ? (
									<div className="flex items-center gap-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
										<Loader2 size={16} className="animate-spin" />
										<span>Enviando arquivo para a database...</span>
									</div>
								) : (
									<>
										<div className="flex items-center gap-2 text-xs font-bold">
											<Upload size={15} className="text-blue-600 dark:text-blue-400" />
											<span>Clique para buscar no computador ou arraste o arquivo aqui</span>
										</div>
										<span className="text-[10px] text-slate-400">
											Imagens, PDF, planilhas ou documentos
										</span>
									</>
								)}
							</div>

							{/* Lista de arquivos anexados */}
							{anexos.length > 0 && (
								<div className="mt-2 space-y-1.5">
									{anexos.map((ax) => (
										<div
											key={ax.id}
											onClick={() => openCustoAnexo(ax, resolvedUrls[ax.id])}
											title="Clique para abrir o arquivo"
											className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:border-blue-300 dark:hover:border-blue-800 transition-colors cursor-pointer group">
											<div className="flex items-center gap-2.5 min-w-0">
												<span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
													{isImageAnexo(ax) ? <ImageIcon size={15} /> : <FileText size={15} />}
												</span>
												<div className="min-w-0">
													<p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
														{ax.nome}
													</p>
													<div className="flex items-center gap-1.5 text-[10px] text-slate-400">
														{ax.tamanho > 0 && <span>{formatFileSize(ax.tamanho)}</span>}
														{ax.tamanho > 0 && <span>•</span>}
														<span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
															Clique para abrir <ExternalLink size={10} />
														</span>
													</div>
												</div>
											</div>

											<button
												type="button"
												title="Deletar arquivo"
												onClick={(e) => {
													e.stopPropagation();
													handleRemoveAnexo(ax);
												}}
												className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0">
												<Trash2 size={15} />
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Link Externo */}
						<div>
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
								<span>Link (Opcional)</span>
								{savedLink && !isEditingLink && (
									<span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
										Clique no link para abrir
									</span>
								)}
							</label>

							{savedLink && !isEditingLink ? (
								<div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60">
									<a
										href={savedLink}
										target="_blank"
										rel="noopener noreferrer"
										title={savedLink}
										className="flex items-center gap-2 min-w-0 flex-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
										<Link2 size={14} className="shrink-0" />
										<span className="truncate">{savedLink}</span>
										<ExternalLink size={12} className="shrink-0" />
									</a>
									<div className="flex items-center gap-1 shrink-0">
										<button
											type="button"
											title="Editar link"
											onClick={() => {
												setLinkInput(savedLink);
												setIsEditingLink(true);
											}}
											className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors">
											<Edit2 size={14} />
										</button>
										<button
											type="button"
											title="Remover link"
											onClick={handleRemoveLink}
											disabled={isSavingLink}
											className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors disabled:opacity-50">
											<Trash2 size={14} />
										</button>
									</div>
								</div>
							) : (
								<div className="flex items-center gap-2">
									<div className="relative flex-1">
										<Link2
											size={14}
											className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
										/>
										<input
											type="text"
											placeholder="https://..."
											value={linkInput}
											onChange={(e) => setLinkInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleSaveLinkInline();
												}
											}}
											className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
										/>
									</div>
									<button
										type="button"
										disabled={isSavingLink || !linkInput.trim()}
										onClick={handleSaveLinkInline}
										className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-40 shrink-0">
										<Check size={14} />
										<span>{isSavingLink ? "Salvando..." : "Salvar"}</span>
									</button>
									{savedLink && (
										<button
											type="button"
											onClick={() => {
												setLinkInput(savedLink);
												setIsEditingLink(false);
											}}
											className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0">
											Cancelar
										</button>
									)}
								</div>
							)}
						</div>
					</div>

					{/* Observações */}
					<div>
						<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
							Observações (Opcional)
						</label>
						<textarea
							rows={2}
							placeholder="Código de barras, chave Pix, número da nota fiscal ou detalhes adicionais..."
							value={observacoes}
							onChange={(e) => setObservacoes(e.target.value)}
							className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
						/>
					</div>

					{/* Botões de Ação */}
					<div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
						{editingCusto && onDelete ? (
							<button
								type="button"
								onClick={async () => {
									onClose();
									await onDelete(editingCusto.id);
								}}
								disabled={isSubmitting}
								className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50">
								<Trash2 size={14} />
								<span>Excluir</span>
							</button>
						) : (
							<div />
						)}
						<div className="flex items-center gap-2.5">
							<button
								type="button"
								onClick={handleCancelModal}
								disabled={isSubmitting}
								className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
								Cancelar
							</button>
							<button
								type="submit"
								disabled={isSubmitting || isUploadingAnexo}
								className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-black tracking-wide shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50">
								<CheckCircle2 size={16} />
								{isSubmitting
									? "Gravando..."
									: editingCusto
									? "Salvar Alterações"
									: multiDatasEnabled
									? `Gravar Custos (${multiDatas.filter(Boolean).length} datas)`
									: "Gravar Custo"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
