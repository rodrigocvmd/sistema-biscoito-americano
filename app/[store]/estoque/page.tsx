'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { STOCK_LABELS, StockData, StoreId } from '@/types';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';

import { use } from 'react';

export default function StockPage({ params }: { params: Promise<{ store: string }> }) {
  const { store } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stock, setStock] = useState<Partial<StockData>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const docRef = doc(db, 'stores', store);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStock(data.stock || {});
          if (data.lastStockUpdate) {
            setLastUpdate(data.lastStockUpdate.toDate());
          }
        }
      } catch (error) {
        console.error("Erro ao buscar estoque:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [store]);

  const [sortBy, setSortBy] = useState<'default' | 'name' | 'quantity'>('default');

  const handleInputChange = (key: keyof StockData, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    setStock(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  const sortedItems = (Object.entries(STOCK_LABELS) as [keyof StockData, string][]).sort((a, b) => {
    if (sortBy === 'name') {
      return a[1].localeCompare(b[1]);
    }
    if (sortBy === 'quantity') {
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
      const docRef = doc(db, 'stores', store);
      await setDoc(docRef, {
        stock,
        lastStockUpdate: serverTimestamp()
      }, { merge: true });

      setLastUpdate(new Date());
      setMessage({ type: 'success', text: 'Estoque atualizado com sucesso!' });
      
      // Limpar mensagem após 3 segundos
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Erro ao salvar estoque:", error);
      setMessage({ type: 'error', text: 'Erro ao salvar. Verifique sua conexão.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <RefreshCw className="animate-spin mb-4" size={32} />
        <p>Carregando contagem...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Sorting Navbar */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Ordenar por:</span>
        <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
          <button 
            onClick={() => setSortBy('default')}
            className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortBy === 'default' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Padrão
          </button>
          <button 
            onClick={() => setSortBy('name')}
            className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortBy === 'name' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Alfabética (A-Z)
          </button>
          <button 
            onClick={() => setSortBy('quantity')}
            className={`cursor-pointer px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sortBy === 'quantity' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Quantidade
          </button>
        </div>
      </div>

      <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Contagem de Estoque</h2>
            <p className="text-sm text-slate-400 font-medium">Insira a quantidade exata de pacotes/unidades em estoque</p>
          </div>
          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-right">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">ÚLTIMA ATUALIZAÇÃO</span>
            <span className="text-sm font-bold text-red-600">
              {lastUpdate ? lastUpdate.toLocaleString('pt-BR') : 'Nunca atualizado'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedItems.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-red-200 hover:bg-white hover:shadow-md transition-all group">
                <label className="text-[11px] font-black text-slate-500 group-hover:text-red-700 transition-colors uppercase leading-tight pr-2">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock[key] ?? ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="w-20 px-3 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-right font-black text-slate-800 focus:outline-none focus:ring-4 focus:ring-red-50/50 focus:border-red-500 transition-all text-lg"
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
            {message && (
              <div className={`flex items-center gap-2 text-sm font-semibold ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.type === 'error' && <AlertCircle size={18} />}
                {message.text}
              </div>
            )}
            
            <button
              type="submit"
              disabled={saving}
              className="ml-auto flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
              {saving ? 'Salvando...' : 'Salvar Contagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
