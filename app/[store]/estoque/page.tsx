"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { STOCK_LABELS, StockData, StoreId, formatDate } from "@/types";
import { Save, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { use } from "react";

export default function StockPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
	const [stock, setStock] = useState<Partial<StockData>>({});
	const [isUnits, setIsUnits] = useState<Partial<Record<keyof StockData, boolean>>>({});
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [sortBy, setSortBy] = useState<"default" | "name" | "quantity">("default");
	const [isDirty, setIsDirty] = useState(false);

	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (isDirty) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [isDirty]);

	useEffect(() => {
		const fetchStock = async () => {
			try {
				const docRef = doc(db, "stores", store);
				const docSnap = await getDoc(docRef);

				if (docSnap.exists()) {
					const data = docSnap.data();
					setStock(data.stock || {});
					setIsUnits(data.isUnits || {});
					if (data.lastStockUpdate) {
						setLastUpdate(data.lastStockUpdate.toDate());
					}
				}
			} catch (error) {
				console.error("Erro ao buscar estoque:", error);
			} finally {
				setLoading(false);
				setIsDirty(false);
			}
		};

		fetchStock();
	}, [store]);

	const handleInputChange = (key: keyof StockData, value: string) => {
		const numValue = value === "" ? 0 : parseInt(value, 10);
		setStock((prev) => ({
			...prev,
			[key]: numValue,
		}));
		setIsDirty(true);
	};

	const handleUnitToggle = (key: keyof StockData, checked: boolean) => {
		setIsUnits((prev) => ({
			...prev,
			[key]: checked,
		}));
		setIsDirty(true);
	};

	const sortedItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][]).sort((a, b) => {
		if (sortBy === "name") {
			return a[1].localeCompare(b[1]);
		}
		if (sortBy === "quantity") {
			const qtyA = stock[a[0]] || 0;
			const qtyB = stock[b[0]] || 0;
			return qtyB - qtyA; // Maior para menor
		}
		return 0; // Ordem padrão (conforme definido no objeto original)
	});

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setMessage(null);

		try {
			const docRef = doc(db, "stores", store);
			await setDoc(
				docRef,
				{
					stock,
					isUnits,
					lastStockUpdate: serverTimestamp(),
				},
				{ merge: true },
			);

			// Save snapshot in stockHistory subcollection
			const historyRef = collection(db, "stores", store, "stockHistory");
			await addDoc(historyRef, {
				stock,
				isUnits,
				timestamp: serverTimestamp(),
			});

			setLastUpdate(new Date());
			setIsDirty(false);
			setMessage({ type: "success", text: "Estoque atualizado com sucesso!" });

			// Limpar mensagem após 3 segundos
			setTimeout(() => setMessage(null), 3000);
		} catch (error) {
			console.error("Erro ao salvar estoque:", error);
			setMessage({ type: "error", text: "Erro ao salvar. Verifique sua conexão." });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando contagem...</p>
			</div>
		);
	}

	return (
		<div className="space-y-6 w-full overflow-hidden">
			{/* Sorting Navbar */}
			<div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-colors">
				<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2 sm:ml-3">
					Ordenar por:
				</span>
				<div
					id="orderContainer"
					className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-1 overflow-x-auto no-scrollbar">
					<button
						onClick={() => setSortBy("default")}
						className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "default" ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
						Padrão
					</button>
					<button
						onClick={() => setSortBy("name")}
						className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "name" ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
						Alfabética
					</button>
					<button
						onClick={() => setSortBy("quantity")}
						className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortBy === "quantity" ? "bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"}`}>
						Quantidade
					</button>
				</div>
			</div>

			<div className="bg-white dark:bg-slate-900 p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
					<div>
						<h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
							Contagem de Estoque
						</h2>
						<p className="text-sm text-slate-400 dark:text-slate-500 font-medium">
							Insira a quantidade de pacotes/unidades em estoque
						</p>
					</div>
					<div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
						<span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 block mb-1">
							ÚLTIMA ATUALIZAÇÃO
						</span>
						<span className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatDate(lastUpdate)}</span>
					</div>
				</div>

				<form onSubmit={handleSave} className="space-y-10">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{sortedItems.map(([key, label]) => (
							<div
								key={key}
								className="flex items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent hover:border-red-200 dark:hover:border-red-900/50 hover:bg-white dark:hover:bg-slate-700 hover:shadow-md transition-all group">
								<div className="flex flex-col gap-1.5 flex-1 min-w-0">
									<label className="text-[14px] font-black text-slate-500 dark:text-slate-400 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors uppercase leading-tight truncate pr-2">
										{label}
									</label>
									<label className="flex items-center gap-2 cursor-pointer w-fit">
										<input
											type="checkbox"
											checked={isUnits[key] || false}
											onChange={(e) => {
												handleUnitToggle(key, e.target.checked);
												if (e.target.checked) {
													handleInputChange(key, "0");
												}
											}}
											className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-red-600 dark:text-red-500 focus:ring-red-500 cursor-pointer"
										/>
										<span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
											Menos de 1 (Aberto)
										</span>
									</label>
								</div>
								<div className="relative">
									<input
										type={isUnits[key] ? "text" : "number"}
										min="1"
										value={isUnits[key] ? "< 1" : (stock[key] || "")}
										readOnly={isUnits[key]}
										onChange={(e) => !isUnits[key] && handleInputChange(key, e.target.value)}
										onFocus={(e) => !isUnits[key] && e.target.select()}
										className={`w-20 px-3 py-2.5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-center font-black focus:outline-none focus:ring-4 focus:ring-red-50/50 focus:border-red-500 dark:focus:border-red-400 transition-all text-lg cursor-pointer ${
											isUnits[key] 
												? "text-orange-500 dark:text-orange-400" 
												: (stock[key] ?? 0) === 0
													? "text-slate-400 dark:text-slate-600"
													: "text-slate-900 dark:text-slate-100"
										}`}
										placeholder="0"
										/>
										{isUnits[key] && (
										<span className="absolute -top-2 -right-1 bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">
											Parcial
										</span>
										)}

								</div>
							</div>
						))}
					</div>

					<div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
						{message && message.type === "error" && (
							<div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
								<AlertCircle size={18} />
								{message.text}
							</div>
						)}

						<button
							type="submit"
							disabled={saving}
							className="cursor-pointer ml-auto flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-red-100 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed">
							{saving ? (
								<RefreshCw className="animate-spin" size={20} />
							) : message?.type === "success" ? (
								<CheckCircle2 size={20} />
							) : (
								<Save size={20} />
							)}
							{saving
								? "Salvando..."
								: message?.type === "success"
									? message.text
									: "Salvar Contagem"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
