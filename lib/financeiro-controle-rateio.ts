import { StoreId } from "@/types/index";
import {
	CustoComRateio,
	CustoFinanceiro,
	FaturamentoFinanceiro,
	SPECIFIC_STORE_IDS,
	isGeneralOnlyCostCategory,
} from "@/types/financeiro-controle";

export interface StoreProporcaoMes {
	faturamento: number;
	share: number; // Proporção 0..1 relativa ao faturamento total do mês das 4 lojas
}

export interface ProporcaoMensalFaturamento {
	total4Lojas: number;
	porLoja: Record<StoreId, StoreProporcaoMes>;
}

export const getMonthRef = (item: { mesReferencia?: string; data?: string }): string => {
	if (item.mesReferencia) return item.mesReferencia;
	if (item.data && item.data.length >= 7) return item.data.slice(0, 7);
	return "";
};

export function calcularProporcoesMensaisFaturamento(
	faturamentos: FaturamentoFinanceiro[]
): Record<string, ProporcaoMensalFaturamento> {
	const fatByMes: Record<string, Record<StoreId, number>> = {};

	faturamentos.forEach((f) => {
		if (!SPECIFIC_STORE_IDS.includes(f.lojaId as StoreId)) return;
		const ref = getMonthRef(f);
		if (!ref) return;

		if (!fatByMes[ref]) {
			fatByMes[ref] = {
				lago: 0,
				terraco: 0,
				conjunto: 0,
				noroeste: 0,
			};
		}

		fatByMes[ref][f.lojaId as StoreId] += f.valorTotal || 0;
	});

	const result: Record<string, ProporcaoMensalFaturamento> = {};

	Object.entries(fatByMes).forEach(([ref, byStore]) => {
		const total4Lojas = SPECIFIC_STORE_IDS.reduce((acc, s) => acc + (byStore[s] || 0), 0);

		const porLoja: Record<StoreId, StoreProporcaoMes> = {
			lago: {
				faturamento: byStore.lago || 0,
				share: total4Lojas > 0 ? (byStore.lago || 0) / total4Lojas : 0,
			},
			terraco: {
				faturamento: byStore.terraco || 0,
				share: total4Lojas > 0 ? (byStore.terraco || 0) / total4Lojas : 0,
			},
			conjunto: {
				faturamento: byStore.conjunto || 0,
				share: total4Lojas > 0 ? (byStore.conjunto || 0) / total4Lojas : 0,
			},
			noroeste: {
				faturamento: byStore.noroeste || 0,
				share: total4Lojas > 0 ? (byStore.noroeste || 0) / total4Lojas : 0,
			},
		};

		result[ref] = { total4Lojas, porLoja };
	});

	return result;
}

export function apportionCustosForStore(
	custos: CustoFinanceiro[],
	targetLoja: string,
	proporcoesMensais: Record<string, ProporcaoMensalFaturamento>
): CustoComRateio[] {
	// Consolidado (Todas as Lojas): exibe todos os lançamentos com seus valores integrais
	if (targetLoja === "todas") {
		return custos.map((c) => ({
			...c,
			isRateio: false,
		}));
	}

	// Loja específica (lago, terraco, conjunto, noroeste):
	// - Cookies e Insumos são rateados pela proporção de faturamento do mês entre as 4 lojas
	// - Demais categorias consideram apenas os lançamentos diretos daquela loja
	if (SPECIFIC_STORE_IDS.includes(targetLoja as StoreId)) {
		const storeId = targetLoja as StoreId;
		const projected: CustoComRateio[] = [];

		custos.forEach((c) => {
			if (isGeneralOnlyCostCategory(c.categoria)) {
				const ref = getMonthRef(c);
				const mesProp = ref ? proporcoesMensais[ref] : undefined;
				const share = mesProp?.porLoja[storeId]?.share ?? 0;
				const valorProporcional = (c.valor || 0) * share;

				if (share > 0 && valorProporcional > 0) {
					projected.push({
						...c,
						valor: valorProporcional,
						valorOriginal: c.valor || 0,
						rateioPercent: share * 100,
						isRateio: true,
					});
				}
			} else if (c.lojaId === storeId) {
				projected.push({
					...c,
					isRateio: false,
				});
			}
		});

		return projected;
	}

	// Fallback para filtro explícito "geral"
	return custos
		.filter((c) => c.lojaId === targetLoja)
		.map((c) => ({ ...c, isRateio: false }));
}

