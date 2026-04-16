"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
	collection,
	addDoc,
	updateDoc,
	doc,
	query,
	where,
	orderBy,
	onSnapshot,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import { SupplyOrder, UrgencyLevel } from "@/types";
import {
	Plus,
	CheckCircle2,
	Clock,
	AlertTriangle,
	Info,
	Calendar,
	Package,
	Trash2,
	RefreshCw,
} from "lucide-react";

import { use } from "react";

export default function SuppliesPage({ params }: { params: Promise<{ store: string }> }) {
	const { store } = use(params);
	const [loading, setLoading] = useState(true);
	const [pendingOrders, setPendingOrders] = useState<SupplyOrder[]>([]);
	const [deliveredOrders, setDeliveredOrders] = useState<SupplyOrder[]>([]);

	// Form State
	const [newName, setNewName] = useState("");
	const [newUrgency, setNewUrgency] = useState<UrgencyLevel>("Normal");
	const [newQuantity, setNewQuantity] = useState("");
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		const ordersRef = collection(db, "stores", store, "supplyOrders");

		// Query for Pending
		const qPending = query(
			ordersRef,
			where("status", "==", "pending"),
			orderBy("createdAt", "desc"),
		);

		// Query for Delivered (last 14 days)
		const fourteenDaysAgo = new Date();
		fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

		const qDelivered = query(
			ordersRef,
			where("status", "==", "delivered"),
			where("deliveredAt", ">=", Timestamp.fromDate(fourteenDaysAgo)),
			orderBy("deliveredAt", "desc"),
		);

		const unsubscribePending = onSnapshot(qPending, (snapshot) => {
			const orders = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as SupplyOrder[];
			setPendingOrders(orders);
			setLoading(false);
		});

		const unsubscribeDelivered = onSnapshot(qDelivered, (snapshot) => {
			const orders = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as SupplyOrder[];
			setDeliveredOrders(orders);
		});

		return () => {
			unsubscribePending();
			unsubscribeDelivered();
		};
	}, [store]);

	const handleAddOrder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newName.trim()) return;

		setAdding(true);
		try {
			const ordersRef = collection(db, "stores", store, "supplyOrders");
			await addDoc(ordersRef, {
				name: newName,
				urgency: newUrgency,
				quantity: newQuantity,
				status: "pending",
				createdAt: serverTimestamp(),
			});

			setNewName("");
			setNewQuantity("");
			setNewUrgency("Normal");
		} catch (error) {
			console.error("Erro ao adicionar insumo:", error);
		} finally {
			setAdding(false);
		}
	};

	const handleMarkAsDelivered = async (orderId: string) => {
		try {
			const orderRef = doc(db, "stores", store, "supplyOrders", orderId);
			const deliveredAt = new Date();
			const expireAt = new Date();
			expireAt.setDate(deliveredAt.getDate() + 14);

			await updateDoc(orderRef, {
				status: "delivered",
				deliveredAt: Timestamp.fromDate(deliveredAt),
				expireAt: Timestamp.fromDate(expireAt),
			});
		} catch (error) {
			console.error("Erro ao marcar como entregue:", error);
		}
	};

	const getUrgencyBadge = (urgency: UrgencyLevel) => {
		switch (urgency) {
			case "Urgente (sem estoque)":
				return (
					<span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
						<AlertTriangle size={12} /> Urgente (sem estoque)
					</span>
				);
			case "Normal":
				return (
					<span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
						<Info size={12} /> Acabando em breve
					</span>
				);
			default:
				return (
					<span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
						<Clock size={12} /> Sem urgência (adiantando)
					</span>
				);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-slate-400">
				<RefreshCw className="animate-spin mb-4" size={32} />
				<p>Carregando insumos...</p>
			</div>
		);
	}

	return (
		<div className="space-y-10">
			{/* Add New Section */}
			<section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
				<h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
					<Plus className="text-red-600" size={24} />
					Solicitar Novo Insumo
				</h2>
				<form onSubmit={handleAddOrder} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
					<div className="space-y-1 md:col-span-1">
						<label className="text-xs font-bold text-slate-400 uppercase ml-1">Insumo</label>
						<input
							type="text"
							required
							placeholder="Ex: Copo 300ml"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 font-medium"
						/>
					</div>
					<div className="space-y-1">
						<label className="text-xs font-bold text-slate-400 uppercase ml-1">
							Qtd (opcional)
						</label>
						<input
							type="text"
							placeholder="Ex: 5 caixas"
							value={newQuantity}
							onChange={(e) => setNewQuantity(e.target.value)}
							className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 font-medium"
						/>
					</div>
					<div className="space-y-1">
						<label className=" cursor-pointer text-xs font-bold text-slate-400 uppercase ml-1">Urgência</label>
						<select
							value={newUrgency}
							onChange={(e) => setNewUrgency(e.target.value as UrgencyLevel)}
							className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-800 font-medium appearance-none cursor-pointer">
							<option value="Urgente (sem estoque)">🔥 Urgente (sem estoque)</option>
							<option value="Acabando em breve">📅 Acabando em breve</option>
							<option value="Sem urgência (adiantando)">⏳ Sem urgência (adiantando)</option>
						</select>
					</div>
					<button
						type="submit"
						disabled={adding}
						className="cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold h-[50px] rounded-xl shadow-md shadow-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
						{adding ? <RefreshCw className="animate-spin" size={20} /> : <Plus size={20} />}
						Adicionar
					</button>
				</form>
			</section>

			{/* Pending List */}
			<section className="space-y-4">
				<h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 ml-1">
					<Package className="text-slate-400" size={20} />
					Insumos Pendentes ({pendingOrders.length})
				</h3>
				{pendingOrders.length === 0 ? (
					<div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
						<p className="text-slate-400 font-medium">Nenhum insumo pendente no momento.</p>
					</div>
				) : (
					<div className="grid gap-3">
						{pendingOrders.map((order) => (
							<div
								key={order.id}
								className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-red-200 transition-all">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-3">
										<span className="text-lg font-bold text-slate-800">{order.name}</span>
										{getUrgencyBadge(order.urgency)}
									</div>
									<div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
										{order.quantity && (
											<span className="flex items-center gap-1">Qtd: {order.quantity}</span>
										)}
										<span className="flex items-center gap-1">
											<Calendar size={12} /> {order.createdAt?.toDate().toLocaleDateString("pt-BR")}
										</span>
									</div>
								</div>
								<button
									onClick={() => handleMarkAsDelivered(order.id)}
									className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-all border border-emerald-100 cursor-pointer">
									<CheckCircle2 size={18} />
									Marcar Entregue
								</button>
							</div>
						))}
					</div>
				)}
			</section>

			{/* Delivered List (Last 14 days) */}
			<section className="space-y-4 pt-6 border-t border-slate-200">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-bold text-slate-500 flex items-center gap-2 ml-1">
						<CheckCircle2 className="text-slate-300" size={20} />
						Insumos Entregues (Últimas 2 semanas)
					</h3>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60 grayscale-[0.5]">
					{deliveredOrders.map((order) => (
						<div
							key={order.id}
							className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
							<div>
								<p className="text-md font-bold text-slate-700 line-through decoration-slate-400">
									{order.name}
								</p>
								<p className="text-[12px] text-slate-400 font-bold uppercase">
									Marcado como entregue em:{" "}
									{order.deliveredAt?.toDate().toLocaleDateString("pt-BR")}
								</p>
							</div>
							<div className="text-emerald-600">
								<CheckCircle2 size={16} />
							</div>
						</div>
					))}
					{deliveredOrders.length === 0 && (
						<p className="text-sm text-slate-400 italic ml-1">
							Nenhuma entrega recente para exibir.
						</p>
					)}
				</div>
			</section>
		</div>
	);
}
