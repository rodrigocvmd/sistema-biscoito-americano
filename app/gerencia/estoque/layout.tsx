"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDocs, query, orderBy, where, Timestamp, runTransaction, doc, serverTimestamp } from "firebase/firestore";
import { STOCK_LABELS, StockData, STORE_NAMES, StoreId, formatDate, StockSnapshot, RepositionHistory } from "@/types";
import { RefreshCw, ArrowLeftRight, Calendar, ArrowRight, TrendingUp, TrendingDown, ArrowRightLeft, ChevronDown, ChevronUp, Save } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface FullStoreData {
	id: StoreId;
	name: string;
	lastStockUpdate: Date | null;
	stock: Partial<StockData>;
	isUnits: Partial<Record<keyof StockData, boolean>>;
}

export default function EstoqueLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	const tabs = [
		{ id: "atual", label: "ESTOQUE ATUAL", href: "/gerencia/estoque/atual" },
		{ id: "historico", label: "HISTÓRICO", href: "/gerencia/estoque/historico" },
		{ id: "reposicionar", label: "REPOSICIONAR", href: "/gerencia/estoque/reposicionar" },
	];

	return (
		<div className="space-y-6">
			{/* Tab Selector */}
			<div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 w-fit mx-auto print:hidden">
				{tabs.map((tab) => (
					<Link
						key={tab.id}
						href={tab.href}
						className={`cursor-pointer px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
							pathname === tab.href 
								? "bg-blue-600 text-white shadow-md shadow-blue-100" 
								: "text-slate-500 hover:bg-slate-50"
						}`}>
						{tab.label}
					</Link>
				))}
			</div>

			{children}
		</div>
	);
}
