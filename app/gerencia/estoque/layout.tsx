"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	onSnapshot,
	getDocs,
	query,
	orderBy,
	where,
	Timestamp,
	runTransaction,
	doc,
	serverTimestamp,
} from "firebase/firestore";
import {
	STOCK_LABELS,
	StockData,
	STORE_NAMES,
	StoreId,
	formatDate,
	StockSnapshot,
	RepositionHistory,
} from "@/types";
import {
	RefreshCw,
	ArrowLeftRight,
	Calendar,
	ArrowRight,
	TrendingUp,
	TrendingDown,
	ArrowRightLeft,
	ChevronDown,
	ChevronUp,
	Save,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, number>>;
}

export default function EstoqueLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	const tabs = [
		{ id: "atual", label: "ESTOQUE ATUAL", href: "/gerencia/estoque/atual" },
		{ id: "reposicionar", label: "REPOSICIONAR", href: "/gerencia/estoque/reposicionar" },
		{ id: "comparativo", label: "HISTÓRICO", href: "/gerencia/estoque/comparativo" },
		{ id: "historico", label: "MOVIMENTAÇÕES", href: "/gerencia/estoque/historico" },
	];

	return (
		<div className="space-y-6">
			{/* Tab Selector */}
			<div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 w-fit mx-auto print:hidden transition-colors">
				{tabs.map((tab) => (
					<Link
						key={tab.id}
						href={tab.href}
						className={`cursor-pointer px-4 py-2 rounded-xl text-sm font-black transition-all ${
							pathname === tab.href
								? "bg-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none"
								: "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
						}`}>
						{tab.label}
					</Link>
				))}
			</div>

			{children}
		</div>
	);
}
