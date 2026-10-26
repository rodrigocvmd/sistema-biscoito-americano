export interface InventoryCategory {
	category: string;
	items: string[];
}

export const INVENTORY_DATA: InventoryCategory[] = [
	{
		category: "BEBIDAS E SODAS",
		items: [
			"ÁGUA SEM GÁS",
			"ÁGUA COM GÁS",
			"COCA NORMAL",
			"COCA ZERO",
			"RED BULL NORMAL",
			"RED BULL ZERO",
			"BUBBLE MAÇÃ VERDE",
			"BUBBLE MORANGO",
			"BUBBLE LICHIA",
			"BUBBLE BLUEBERRY",
			"FANTA LARANJA",
			"SODA FRUTAS VERMELHAS",
			"SODA MORANGO",
			"SODA MAÇÃ VERDE",
			"SODA CRAMBERRY",
			"SODA LIMÃO",
			"SODA TANGERINA",
			"SODA PESSEGO",
			"SODA JABUTICABA",
			"SODA BLUEBERRY",
			"SODA CURAÇAO",
			"SODA FRAMBOESA",
			"GATORADE DE LIMÃO",
		],
	},
	{
		category: "INSUMOS E CONFEITARIA",
		items: [
			"NUTELLA",
			"LEITE NINHO",
			"LEITE LÍQUIDO",
			"PÓ DE CACAU 50%",
			"M&M",
			"GRANULADO",
			"CHANTILLY",
			"DOCE DE LEITE",
			"OVOMALTINE CREMOSO",
			"OVOMALTINE CROCANTE",
			"CHOCOLATE PICADO",
			"FLOR DE SAL",
			"BISCOITO LÓTUS",
			"LÓTUS TRITURADO",
			"BISCOITO OREO",
			"CHOCOLATE ALPINO",
			"GELO",
			"BARRA KINDER BUENO",
			"BISCOITO KINDER BUENO",
			"SORVETE CREME",
			"SORVETE FLOR DE LEITE",
		],
	},
	{
		category: "CALDAS",
		items: ["CALDA DE FRUTAS VERMELHAS", "CALDA DE CARAMELO", "CALDA CHOCOLATE"],
	},
	{
		category: "CAFETERIA E MATINAL",
		items: [
			"CÁPSULA DE CAFÉ",
			"NESCAFÉ MATINAL SUAVE",
			"PO DE CAPUCCINO",
			"SACHE CHOCOLATE QUENTE",
			"SACHE AÇÚCAR",
			"SACHE ADOÇANTE",
		],
	},
	{
		category: "EMBALAGENS E DESCARTÁVEIS",
		items: [
			"SAQUINHO UNITÁRIO",
			"KRAFT P",
			"KRAFT G",
			"CAIXA P",
			"CAIXA G",
			"AMERICAN BAG G",
			"AMERICAN BAG P",
			"HAMBURGUEIRA",
			"PAPEL INTERFOLHADO",
			"PAPEL MANTEIGA",
			"SACOLA PLÁSTICA",
			"SACOLA PLÁSTICA DELIVERY LÍQUIDOS",
			"ROLO PLÁSTICO FILME PVC PEQUENO",
			"ROLO PLÁSTICO FILME PVC GRANDE",
			"COPO DE ISOPOR 100ML",
			"COPO DE ISOPOR 180ML",
			"COPO DESCARTÁVEL (180ML)",
			"COPO PARA DELIVERY (CALDA)",
			"COPO TÉRMICO 100 ML",
			"COPO TÉRMICO 180 ML",
			"COPO 300 ML",
			"COPO 400 ML",
			"COPO FLURY",
			"TAMPA 300 ML",
			"TAMPA 400 ML",
			"TAMPA FLURY",
			"CANUDO NORMAL",
			"CANUDO BUBBLE",
			"CANUDO SHAKE",
			"GUARDANAPO",
			"SUPORTE SHAKE",
			"SUPORTE FLURY",
			"COLHER DESCARTÁVEL",
			"MISTURADOR CAFÉ",
		],
	},
	{
		category: "OPERACIONAL E DELIVERY",
		items: [
			"ETIQUETA VERMELHA",
			"ETIQUETA BRANCA",
			"ETIQUETA VALIDADE",
			"BILHETE RECADO DELIVERY",
			"BILHETE TELEFONE DELIVERY",
			"BOBINA IMPRESSORA",
			"BOBINA CIELO",
			"ENVELOPE",
			"TROCO NOTAS",
			"TROCO MOEDAS",
			"GRAMPO",
			"CLIPE DE PAPEL",
		],
	},
	{
		category: "HIGIENE E SEGURANÇA",
		items: [
			"LUVAS",
			"TOUCA",
			"DESINFETANTE",
			"DETERGENTE",
			"VEJA",
			"ÁLCOOL",
			"SACO DE LIXO",
			"PANO DE PRATO",
			"SABÃO LÍQUIDO",
			"BUCHA",
			"PERFEX",
			"KIBOA",
			"PAPEL TOALHA",
			"PAPEL HIGIÊNICO",
		],
	},
];

export type InsumoResponsavel = "Rodrigo" | "Ana" | "Edson";
export const RESPONSAVEIS_COMPRA: InsumoResponsavel[] = ["Rodrigo", "Ana", "Edson"];

export interface InsumoLocalCompraItem {
	nome: string;
	url?: string;
}

export interface InsumoCatalogItem {
	id: string;
	name: string;
	category: string;
	valorBom: string;
	valorMaximo: string;
	localCompra: string;
	locaisCompra?: InsumoLocalCompraItem[];
	responsaveis?: InsumoResponsavel[];
	marca: string;
	observacoes: string;
	createdAt?: any;
	updatedAt?: any;
}

// Retorna todos os itens do inventário de forma plana
export function getAllInventoryItems(): { name: string; category: string }[] {
	const list: { name: string; category: string }[] = [];
	for (const cat of INVENTORY_DATA) {
		for (const item of cat.items) {
			list.push({ name: item, category: cat.category });
		}
	}
	return list;
}

// Cria um ID slug estável para o nome do insumo
export function slugifyInsumoName(name: string): string {
	return name
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

// Converte e normaliza os locais de compra a partir de um insumo
export function parseLocaisCompra(item?: Partial<InsumoCatalogItem> | null): InsumoLocalCompraItem[] {
	if (!item) return [];
	if (item.locaisCompra && Array.isArray(item.locaisCompra) && item.locaisCompra.length > 0) {
		return item.locaisCompra
			.filter((loc) => loc && (loc.nome?.trim() || loc.url?.trim()))
			.map((loc) => ({
				nome: loc.nome ? loc.nome.trim() : "",
				url: loc.url ? loc.url.trim() : "",
			}));
	}
	if (item.localCompra && item.localCompra.trim()) {
		return item.localCompra
			.split("/")
			.map((s) => s.trim())
			.filter(Boolean)
			.map((nome) => ({ nome, url: "" }));
	}
	return [];
}

// Formata a lista de locais de compra para a string tradicional separada por " / "
export function formatLocalCompraString(locais: InsumoLocalCompraItem[]): string {
	return locais
		.map((l) => l.nome.trim())
		.filter(Boolean)
		.join(" / ");
}

// Higieniza URL garantindo protocolo para links externos
export function sanitizeExternalUrl(url?: string): string {
	if (!url) return "";
	const trimmed = url.trim();
	if (!trimmed) return "";
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

// Catálogo padrão pré-populado para todos os insumos conhecidos
export const DEFAULT_INSUMOS_CATALOG: InsumoCatalogItem[] = [
	// BEBIDAS E SODAS
	{
		id: "agua-sem-gas",
		name: "ÁGUA SEM GÁS",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 16,00",
		valorMaximo: "R$ 22,00",
		localCompra: "Atacadão / Sam's Club",
		marca: "Crystal / Indaiá",
		observacoes: "Fardo c/ 12 unidades 500ml sem gás",
	},
	{
		id: "agua-com-gas",
		name: "ÁGUA COM GÁS",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 24,00",
		localCompra: "Atacadão / Sam's Club",
		marca: "Crystal / Indaiá",
		observacoes: "Fardo c/ 12 unidades 500ml com gás",
	},
	{
		id: "coca-normal",
		name: "COCA NORMAL",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 3,10",
		valorMaximo: "R$ 3,80",
		localCompra: "Coca-Cola FEMSA / Atacadão",
		marca: "Coca-Cola",
		observacoes: "Lata 350ml - Fardo c/ 12 unidades",
	},
	{
		id: "coca-zero",
		name: "COCA ZERO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 3,10",
		valorMaximo: "R$ 3,80",
		localCompra: "Coca-Cola FEMSA / Atacadão",
		marca: "Coca-Cola",
		observacoes: "Lata 350ml - Fardo c/ 12 unidades",
	},
	{
		id: "red-bull-normal",
		name: "RED BULL NORMAL",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 7,50",
		valorMaximo: "R$ 9,20",
		localCompra: "Atacadão / Distribuidora",
		marca: "Red Bull",
		observacoes: "Lata 250ml",
	},
	{
		id: "red-bull-zero",
		name: "RED BULL ZERO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 7,50",
		valorMaximo: "R$ 9,20",
		localCompra: "Atacadão / Distribuidora",
		marca: "Red Bull",
		observacoes: "Lata 250ml Sugar Free",
	},
	{
		id: "bubble-maca-verde",
		name: "BUBBLE MAÇÃ VERDE",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 48,00",
		valorMaximo: "R$ 62,00",
		localCompra: "Fornecedor Especializado / Distribuidora",
		marca: "Bubble Tea Brasil",
		observacoes: "Pote de pérolas estouráveis de maçã verde",
	},
	{
		id: "bubble-morango",
		name: "BUBBLE MORANGO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 48,00",
		valorMaximo: "R$ 62,00",
		localCompra: "Fornecedor Especializado / Distribuidora",
		marca: "Bubble Tea Brasil",
		observacoes: "Pote de pérolas estouráveis de morango",
	},
	{
		id: "bubble-lichia",
		name: "BUBBLE LICHIA",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 48,00",
		valorMaximo: "R$ 62,00",
		localCompra: "Fornecedor Especializado / Distribuidora",
		marca: "Bubble Tea Brasil",
		observacoes: "Pote de pérolas estouráveis de lichia",
	},
	{
		id: "bubble-blueberry",
		name: "BUBBLE BLUEBERRY",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 48,00",
		valorMaximo: "R$ 62,00",
		localCompra: "Fornecedor Especializado / Distribuidora",
		marca: "Bubble Tea Brasil",
		observacoes: "Pote de pérolas estouráveis de blueberry",
	},
	{
		id: "fanta-laranja",
		name: "FANTA LARANJA",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 2,90",
		valorMaximo: "R$ 3,60",
		localCompra: "Coca-Cola FEMSA / Atacadão",
		marca: "Fanta",
		observacoes: "Lata 350ml",
	},
	{
		id: "soda-frutas-vermelhas",
		name: "SODA FRUTAS VERMELHAS",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-morango",
		name: "SODA MORANGO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-maca-verde",
		name: "SODA MAÇÃ VERDE",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-cramberry",
		name: "SODA CRAMBERRY",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-limao",
		name: "SODA LIMÃO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-tangerina",
		name: "SODA TANGERINA",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-pessego",
		name: "SODA PESSEGO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-jabuticaba",
		name: "SODA JABUTICABA",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-blueberry",
		name: "SODA BLUEBERRY",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "soda-curacao",
		name: "SODA CURAÇAO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope curaçao blue 700ml / 1L",
	},
	{
		id: "soda-framboesa",
		name: "SODA FRAMBOESA",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Distribuidora Monin / Atacadão",
		marca: "Monin / DaVinci",
		observacoes: "Xarope para soda italiana 700ml / 1L",
	},
	{
		id: "gatorade-de-limao",
		name: "GATORADE DE LIMÃO",
		category: "BEBIDAS E SODAS",
		valorBom: "R$ 5,20",
		valorMaximo: "R$ 6,80",
		localCompra: "Atacadão / Sam's Club",
		marca: "Gatorade",
		observacoes: "Garrafa 500ml sabor Limão",
	},

	// INSUMOS E CONFEITARIA
	{
		id: "nutella",
		name: "NUTELLA",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 145,00",
		valorMaximo: "R$ 175,00",
		localCompra: "Sam's Club / Atacadão",
		marca: "Ferrero Nutella",
		observacoes: "Balde profissional de 3kg",
	},
	{
		id: "leite-ninho",
		name: "LEITE NINHO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 16,50",
		valorMaximo: "R$ 21,00",
		localCompra: "Atacadão / Assaí",
		marca: "Nestlé Ninho",
		observacoes: "Lata ou sachê 380g / 400g integral",
	},
	{
		id: "leite-liquido",
		name: "LEITE LÍQUIDO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 4,20",
		valorMaximo: "R$ 5,50",
		localCompra: "Atacadão / Supermercado",
		marca: "Piracanjuba / Italac",
		observacoes: "Caixa 1L integral",
	},
	{
		id: "po-de-cacau-50",
		name: "PÓ DE CACAU 50%",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 28,00",
		valorMaximo: "R$ 38,00",
		localCompra: "Distribuidora de Confeitaria",
		marca: "Harald / Sicao / Nestlé",
		observacoes: "Pacote de 1kg ou 2kg",
	},
	{
		id: "m-m",
		name: "M&M",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 49,00",
		localCompra: "Sam's Club / Atacadão",
		marca: "Mars M&M's",
		observacoes: "Pacote de 1kg tradicional ao leite",
	},
	{
		id: "granulado",
		name: "GRANULADO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Distribuidora de Confeitaria",
		marca: "Harald Melken / Sicao",
		observacoes: "Granulado macio ou split chocolate puro",
	},
	{
		id: "chantilly",
		name: "CHANTILLY",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 25,00",
		localCompra: "Atacadão / Confeitaria",
		marca: "Norcau / Chanty Fest",
		observacoes: "Caixa de 1L tipo spray ou líquido para bater",
	},
	{
		id: "doce-de-leite",
		name: "DOCE DE LEITE",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 52,00",
		localCompra: "Sam's Club / Atacadão",
		marca: "Viçosa / Aviação / Itambé",
		observacoes: "Balde de 2kg a 5kg para confeitaria",
	},
	{
		id: "ovomaltine-cremoso",
		name: "OVOMALTINE CREMOSO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 32,00",
		valorMaximo: "R$ 42,00",
		localCompra: "Sam's Club / Atacadão",
		marca: "Ovomaltine",
		observacoes: "Pote de creme crocante 660g / 1kg",
	},
	{
		id: "ovomaltine-crocante",
		name: "OVOMALTINE CROCANTE",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 24,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Atacadão / Assaí",
		marca: "Ovomaltine",
		observacoes: "Pacote em pó crocante 1kg",
	},
	{
		id: "chocolate-picado",
		name: "CHOCOLATE PICADO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 34,00",
		valorMaximo: "R$ 46,00",
		localCompra: "Distribuidora de Confeitaria",
		marca: "Sicao / Harald / Callebaut",
		observacoes: "Gotas ou pedaços nobres forneáveis",
	},
	{
		id: "flor-de-sal",
		name: "FLOR DE SAL",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 35,00",
		localCompra: "Empório / Distribuidora",
		marca: "Cimsal / Smart",
		observacoes: "Pote 150g a 500g para finalização",
	},
	{
		id: "biscoito-lotus",
		name: "BISCOITO LÓTUS",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 26,00",
		localCompra: "Sam's Club / Importadora",
		marca: "Lotus Biscoff",
		observacoes: "Pacote 250g biscoito belga caramelizado",
	},
	{
		id: "lotus-triturado",
		name: "LÓTUS TRITURADO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 36,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Sam's Club / Distribuidora",
		marca: "Lotus Biscoff",
		observacoes: "Pacote de farofa crocante Lotus Biscoff",
	},
	{
		id: "biscoito-oreo",
		name: "BISCOITO OREO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 14,00",
		valorMaximo: "R$ 19,00",
		localCompra: "Atacadão / Sam's Club",
		marca: "Oreo / Mondelez",
		observacoes: "Pacote econômico ou triturado sem recheio",
	},
	{
		id: "chocolate-alpino",
		name: "CHOCOLATE ALPINO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 49,00",
		localCompra: "Atacadão / Sam's Club",
		marca: "Nestlé Alpino",
		observacoes: "Bombons ou barra para receitas",
	},
	{
		id: "gelo",
		name: "GELO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 9,00",
		valorMaximo: "R$ 14,00",
		localCompra: "Distribuidora de Gelo / Posto",
		marca: "Gelo Filtrado / Em Cubo",
		observacoes: "Saco de 5kg ou 10kg em cubos",
	},
	{
		id: "barra-kinder-bueno",
		name: "BARRA KINDER BUENO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 6,50",
		valorMaximo: "R$ 8,50",
		localCompra: "Sam's Club / Atacadão",
		marca: "Ferrero Kinder Bueno",
		observacoes: "Caixa display com unidades originais",
	},
	{
		id: "biscoito-kinder-bueno",
		name: "BISCOITO KINDER BUENO",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 6,50",
		valorMaximo: "R$ 8,50",
		localCompra: "Sam's Club / Atacadão",
		marca: "Ferrero Kinder Bueno",
		observacoes: "Biscoito / Barra Kinder Bueno",
	},
	{
		id: "sorvete-creme",
		name: "SORVETE CREME",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 45,00",
		valorMaximo: "R$ 60,00",
		localCompra: "Distribuidora de Sorvetes",
		marca: "Nestlé / Kibon / Fornecedor Local",
		observacoes: "Balde ou caixa de sorvete sabor creme",
	},
	{
		id: "sorvete-flor-de-leite",
		name: "SORVETE FLOR DE LEITE",
		category: "INSUMOS E CONFEITARIA",
		valorBom: "R$ 45,00",
		valorMaximo: "R$ 60,00",
		localCompra: "Distribuidora de Sorvetes",
		marca: "Nestlé / Kibon / Fornecedor Local",
		observacoes: "Balde ou caixa de sorvete sabor flor de leite",
	},

	// CALDAS
	{
		id: "calda-de-frutas-vermelhas",
		name: "CALDA DE FRUTAS VERMELHAS",
		category: "CALDAS",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Distribuidora / Confeitaria",
		marca: "D'agostini / Homemade / DaVinci",
		observacoes: "Bisnaga ou pote profissional para cobertura",
	},
	{
		id: "calda-de-caramelo",
		name: "CALDA DE CARAMELO",
		category: "CALDAS",
		valorBom: "R$ 20,00",
		valorMaximo: "R$ 30,00",
		localCompra: "Distribuidora / Atacadão",
		marca: "Marvi / DaVinci / Monin",
		observacoes: "Bisnaga de cobertura de caramelo salgado/tradicional",
	},
	{
		id: "calda-chocolate",
		name: "CALDA CHOCOLATE",
		category: "CALDAS",
		valorBom: "R$ 20,00",
		valorMaximo: "R$ 30,00",
		localCompra: "Distribuidora / Atacadão",
		marca: "Marvi / DaVinci / Hershey's",
		observacoes: "Bisnaga de cobertura de chocolate",
	},

	// CAFETERIA E MATINAL
	{
		id: "capsula-de-cafe",
		name: "CÁPSULA DE CAFÉ",
		category: "CAFETERIA E MATINAL",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 25,00",
		localCompra: "Sam's Club / Nespresso / Supermercado",
		marca: "Nespresso / L'Or",
		observacoes: "Caixa c/ 10 cápsulas compatíveis",
	},
	{
		id: "nescafe-matinal-suave",
		name: "NESCAFÉ MATINAL SUAVE",
		category: "CAFETERIA E MATINAL",
		valorBom: "R$ 16,00",
		valorMaximo: "R$ 22,00",
		localCompra: "Atacadão / Assaí",
		marca: "Nestlé Nescafé",
		observacoes: "Vidro ou sachê 160g / 200g solúvel",
	},
	{
		id: "po-de-capuccino",
		name: "PO DE CAPUCCINO",
		category: "CAFETERIA E MATINAL",
		valorBom: "R$ 14,00",
		valorMaximo: "R$ 20,00",
		localCompra: "Atacadão / Supermercado",
		marca: "3 Corações / Utam",
		observacoes: "Lata ou refil 400g tradicional",
	},
	{
		id: "sache-chocolate-quente",
		name: "SACHE CHOCOLATE QUENTE",
		category: "CAFETERIA E MATINAL",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 26,00",
		localCompra: "Distribuidora / Atacadão",
		marca: "3 Corações / Nestlé",
		observacoes: "Display com sachês individuais",
	},
	{
		id: "sache-acucar",
		name: "SACHE AÇÚCAR",
		category: "CAFETERIA E MATINAL",
		valorBom: "R$ 19,00",
		valorMaximo: "R$ 26,00",
		localCompra: "Atacadão / Makro",
		marca: "União / Caravelas",
		observacoes: "Caixa c/ 400 a 1000 sachês 5g",
	},
	{
		id: "sache-adocante",
		name: "SACHE ADOÇANTE",
		category: "CAFETERIA E MATINAL",
		valorBom: "R$ 16,00",
		valorMaximo: "R$ 24,00",
		localCompra: "Atacadão / Farmácia",
		marca: "Zero-Cal / Linea",
		observacoes: "Caixa c/ sachês individuais",
	},

	// EMBALAGENS E DESCARTÁVEIS
	{
		id: "saquinho-unitario",
		name: "SAQUINHO UNITÁRIO",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 45,00",
		valorMaximo: "R$ 60,00",
		localCompra: "Gráfica / Embalagens Personalizadas",
		marca: "Personalizado Biscoito Americano",
		observacoes: "Pacote c/ 500 ou 1000 unidades",
	},
	{
		id: "kraft-p",
		name: "KRAFT P",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 0,70",
		valorMaximo: "R$ 1,10",
		localCompra: "Distribuidora de Embalagens",
		marca: "Personalizado / Padrão",
		observacoes: "Sacola Kraft tamanho Pequeno",
	},
	{
		id: "kraft-g",
		name: "KRAFT G",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 1,10",
		valorMaximo: "R$ 1,60",
		localCompra: "Distribuidora de Embalagens",
		marca: "Personalizado / Padrão",
		observacoes: "Sacola Kraft tamanho Grande",
	},
	{
		id: "caixa-p",
		name: "CAIXA P",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 1,80",
		valorMaximo: "R$ 2,50",
		localCompra: "Gráfica / Fornecedor de Caixas",
		marca: "Personalizada Biscoito Americano",
		observacoes: "Caixa de presente/cookies tamanho Pequeno",
	},
	{
		id: "caixa-g",
		name: "CAIXA G",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 2,60",
		valorMaximo: "R$ 3,80",
		localCompra: "Gráfica / Fornecedor de Caixas",
		marca: "Personalizada Biscoito Americano",
		observacoes: "Caixa de presente/cookies tamanho Grande",
	},
	{
		id: "american-bag-g",
		name: "AMERICAN BAG G",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 2,50",
		valorMaximo: "R$ 3,80",
		localCompra: "Gráfica / Fornecedor",
		marca: "Personalizada",
		observacoes: "Sacola temática American Bag G",
	},
	{
		id: "american-bag-p",
		name: "AMERICAN BAG P",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 1,80",
		valorMaximo: "R$ 2,80",
		localCompra: "Gráfica / Fornecedor",
		marca: "Personalizada",
		observacoes: "Sacola temática American Bag P",
	},
	{
		id: "hamburgueira",
		name: "HAMBURGUEIRA",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 32,00",
		valorMaximo: "R$ 45,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Darf / Copobras",
		observacoes: "Fardo c/ 100 unidades isopor ou papel",
	},
	{
		id: "papel-interfolhado",
		name: "PAPEL INTERFOLHADO",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 26,00",
		localCompra: "Atacadão / Distribuidora Higiene",
		marca: "Mili / Santher",
		observacoes: "Fardo papel toalha interfolha 2 ou 3 dobras",
	},
	{
		id: "papel-manteiga",
		name: "PAPEL MANTEIGA",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 24,00",
		valorMaximo: "R$ 35,00",
		localCompra: "Atacadão / Embalagens",
		marca: "Wyda / Prack",
		observacoes: "Rolo 50m ou 100m para forno e bancada",
	},
	{
		id: "sacola-plastica",
		name: "SACOLA PLÁSTICA",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 25,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Padrão Reforçada",
		observacoes: "Fardo c/ 1000 unidades branca ou transparente",
	},
	{
		id: "sacola-plastica-delivery-liquidos",
		name: "SACOLA PLÁSTICA DELIVERY LÍQUIDOS",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 24,00",
		valorMaximo: "R$ 34,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Reforçada antivazamento",
		observacoes: "Para transporte seguro de copos e bebidas",
	},
	{
		id: "rolo-plastico-filme-pvc-pequeno",
		name: "ROLO PLÁSTICO FILME PVC PEQUENO",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 14,00",
		valorMaximo: "R$ 20,00",
		localCompra: "Atacadão / Embalagens",
		marca: "Wyda / Alpfilm",
		observacoes: "Rolo 28cm x 100m ou 300m",
	},
	{
		id: "rolo-plastico-filme-pvc-grande",
		name: "ROLO PLÁSTICO FILME PVC GRANDE",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 34,00",
		valorMaximo: "R$ 48,00",
		localCompra: "Atacadão / Embalagens",
		marca: "Wyda / Alpfilm",
		observacoes: "Rolo profissional 45cm x 300m c/ trilho cortador",
	},
	{
		id: "copo-de-isopor-100ml",
		name: "COPO DE ISOPOR 100ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Copobras / Dart",
		observacoes: "Pacote c/ 100 unidades térmicas",
	},
	{
		id: "copo-de-isopor-180ml",
		name: "COPO DE ISOPOR 180ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 26,00",
		valorMaximo: "R$ 36,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Copobras / Dart",
		observacoes: "Pacote c/ 100 unidades térmicas",
	},
	{
		id: "copo-descartavel-180ml",
		name: "COPO DESCARTÁVEL (180ML)",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 4,50",
		valorMaximo: "R$ 6,50",
		localCompra: "Atacadão / Distribuidora",
		marca: "Copobras / Altacoppo",
		observacoes: "Pacote c/ 100 unidades de plástico para água",
	},
	{
		id: "copo-para-delivery-calda",
		name: "COPO PARA DELIVERY (CALDA)",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 28,00",
		valorMaximo: "R$ 38,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Prafesta / Galvanotek",
		observacoes: "Pote pequeno c/ tampa trava 30ml a 60ml",
	},
	{
		id: "copo-termico-100-ml",
		name: "COPO TÉRMICO 100 ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 28,00",
		valorMaximo: "R$ 40,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Dart / Huhtamaki",
		observacoes: "Para café expresso e bebidas quentes",
	},
	{
		id: "copo-termico-180-ml",
		name: "COPO TÉRMICO 180 ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 32,00",
		valorMaximo: "R$ 44,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Dart / Huhtamaki",
		observacoes: "Para cappuccino e bebidas quentes médias",
	},
	{
		id: "copo-300-ml",
		name: "COPO 300 ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 42,00",
		valorMaximo: "R$ 56,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Copobras / Plaszom",
		observacoes: "Copo PP/PET transparente para sodas",
	},
	{
		id: "copo-400-ml",
		name: "COPO 400 ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 48,00",
		valorMaximo: "R$ 64,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Copobras / Plaszom",
		observacoes: "Copo PP/PET transparente para shakes e sodas grandes",
	},
	{
		id: "copo-flury",
		name: "COPO FLURY",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 40,00",
		valorMaximo: "R$ 55,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Padrão Flury / Sobremesa",
		observacoes: "Copo específico para sobremesa e sorvete",
	},
	{
		id: "tampa-300-ml",
		name: "TAMPA 300 ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Copobras / Plaszom",
		observacoes: "Tampa bolha ou reta c/ furo para copo 300ml",
	},
	{
		id: "tampa-400-ml",
		name: "TAMPA 400 ML",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 24,00",
		valorMaximo: "R$ 34,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Copobras / Plaszom",
		observacoes: "Tampa bolha ou reta c/ furo para copo 400ml",
	},
	{
		id: "tampa-flury",
		name: "TAMPA FLURY",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Padrão Flury",
		observacoes: "Tampa com furo largo para mistura/colher",
	},
	{
		id: "canudo-normal",
		name: "CANUDO NORMAL",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 12,00",
		valorMaximo: "R$ 18,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Strawplast / Bio",
		observacoes: "Sachê individual de canudo embalado",
	},
	{
		id: "canudo-bubble",
		name: "CANUDO BUBBLE",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 32,00",
		localCompra: "Distribuidora Especializada",
		marca: "Bubble Tea Brasil",
		observacoes: "Canudo grosso com ponta chanfrada embalado individualmente",
	},
	{
		id: "canudo-shake",
		name: "CANUDO SHAKE",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 16,00",
		valorMaximo: "R$ 24,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Strawplast",
		observacoes: "Canudo largo embalado para milk-shake",
	},
	{
		id: "guardanapo",
		name: "GUARDANAPO",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 26,00",
		valorMaximo: "R$ 36,00",
		localCompra: "Atacadão / Distribuidora",
		marca: "Snob / Mili / Carinho",
		observacoes: "Fardo c/ pacotes de guardanapo de papel folha dupla",
	},
	{
		id: "suporte-shake",
		name: "SUPORTE SHAKE",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 28,00",
		valorMaximo: "R$ 42,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Kraft Delivery",
		observacoes: "Suporte divisor para 2 ou 4 copos em delivery",
	},
	{
		id: "suporte-flury",
		name: "SUPORTE FLURY",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 26,00",
		valorMaximo: "R$ 38,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Kraft Delivery",
		observacoes: "Suporte para potes de sobremesa",
	},
	{
		id: "colher-descartavel",
		name: "COLHER DESCARTÁVEL",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 14,00",
		valorMaximo: "R$ 22,00",
		localCompra: "Distribuidora de Embalagens",
		marca: "Strawplast / Prafesta",
		observacoes: "Pacote c/ 50 unidades reforçada sobremesa",
	},
	{
		id: "misturador-cafe",
		name: "MISTURADOR CAFÉ",
		category: "EMBALAGENS E DESCARTÁVEIS",
		valorBom: "R$ 8,00",
		valorMaximo: "R$ 14,00",
		localCompra: "Atacadão / Embalagens",
		marca: "Theoto / Strawplast",
		observacoes: "Palito misturador de café de madeira ou plástico",
	},

	// OPERACIONAL E DELIVERY
	{
		id: "etiqueta-vermelha",
		name: "ETIQUETA VERMELHA",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 28,00",
		localCompra: "Papelaria / Gráfica",
		marca: "Pimaco / Colacril",
		observacoes: "Rolo ou folha adesiva vermelha",
	},
	{
		id: "etiqueta-branca",
		name: "ETIQUETA BRANCA",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 16,00",
		valorMaximo: "R$ 25,00",
		localCompra: "Papelaria / Gráfica",
		marca: "Pimaco / Colacril",
		observacoes: "Rolo ou folha adesiva branca",
	},
	{
		id: "etiqueta-validade",
		name: "ETIQUETA VALIDADE",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 34,00",
		localCompra: "Distribuidora de Etiquetas",
		marca: "Anvisa Padronizada",
		observacoes: "Rolo com campos: Produto, Data, Validade e Resp.",
	},
	{
		id: "bilhete-recado-delivery",
		name: "BILHETE RECADO DELIVERY",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 35,00",
		valorMaximo: "R$ 55,00",
		localCompra: "Gráfica Personalizada",
		marca: "Biscoito Americano",
		observacoes: "Bloco de cartões com recado carinhoso ao cliente",
	},
	{
		id: "bilhete-telefone-delivery",
		name: "BILHETE TELEFONE DELIVERY",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 35,00",
		valorMaximo: "R$ 55,00",
		localCompra: "Gráfica Personalizada",
		marca: "Biscoito Americano",
		observacoes: "Cartão institucional com contato e redes",
	},
	{
		id: "bobina-impressora",
		name: "BOBINA IMPRESSORA",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 5,50",
		valorMaximo: "R$ 8,00",
		localCompra: "Kalunga / Distribuidora",
		marca: "Silfer / Regispel",
		observacoes: "Bobina térmica 80mm x 40m para impressora de cupom",
	},
	{
		id: "bobina-cielo",
		name: "BOBINA CIELO",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 3,20",
		valorMaximo: "R$ 5,00",
		localCompra: "Kalunga / Distribuidora",
		marca: "Silfer / Regispel",
		observacoes: "Bobina térmica 57mm x 15m para máquina de cartão",
	},
	{
		id: "envelope",
		name: "ENVELOPE",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 15,00",
		valorMaximo: "R$ 24,00",
		localCompra: "Kalunga / Papelaria",
		marca: "Foroni / Scrity",
		observacoes: "Caixa de envelopes carta ou ofício para sangria",
	},
	{
		id: "troco-notas",
		name: "TROCO NOTAS",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "Face",
		valorMaximo: "Face",
		localCompra: "Banco / Agência",
		marca: "Banco Central",
		observacoes: "Cédulas de R$ 2, R$ 5, R$ 10 e R$ 20 para caixa",
	},
	{
		id: "troco-moedas",
		name: "TROCO MOEDAS",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "Face",
		valorMaximo: "Face",
		localCompra: "Banco / Agência",
		marca: "Banco Central",
		observacoes: "Rolinhos de R$ 0,10, R$ 0,25, R$ 0,50 e R$ 1,00",
	},
	{
		id: "grampo",
		name: "GRAMPO",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 6,00",
		valorMaximo: "R$ 10,00",
		localCompra: "Kalunga / Papelaria",
		marca: "Bacchi / Cis 26/6",
		observacoes: "Caixa com 5000 grampos galvanizados 26/6",
	},
	{
		id: "clipe-de-papel",
		name: "CLIPE DE PAPEL",
		category: "OPERACIONAL E DELIVERY",
		valorBom: "R$ 5,00",
		valorMaximo: "R$ 8,00",
		localCompra: "Kalunga / Papelaria",
		marca: "Acco / Cis",
		observacoes: "Caixa c/ 100 clips metálicos",
	},

	// HIGIENE E SEGURANÇA
	{
		id: "luvas",
		name: "LUVAS",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 24,00",
		valorMaximo: "R$ 38,00",
		localCompra: "Dental / Distribuidora Hospitalar / Sam's",
		marca: "Volk / Supermax / Unigloves",
		observacoes: "Caixa c/ 100 luvas nitrílicas ou vinil sem pó (M / G)",
	},
	{
		id: "touca",
		name: "TOUCA",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 14,00",
		valorMaximo: "R$ 22,00",
		localCompra: "Distribuidora Descartáveis / Sam's",
		marca: "Descarpack / Medix",
		observacoes: "Pacote c/ 100 toucas sanfonadas descartáveis brancas",
	},
	{
		id: "desinfetante",
		name: "DESINFETANTE",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 16,00",
		valorMaximo: "R$ 24,00",
		localCompra: "Atacadão / Assaí",
		marca: "Pinho Sol / Veja / Ypê",
		observacoes: "Galão de 5L uso geral",
	},
	{
		id: "detergente",
		name: "DETERGENTE",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 15,00",
		valorMaximo: "R$ 22,00",
		localCompra: "Atacadão / Assaí",
		marca: "Ypê / Limpol",
		observacoes: "Galão de 5L neutro ou fardo c/ 24 unidades 500ml",
	},
	{
		id: "veja",
		name: "VEJA",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 8,50",
		valorMaximo: "R$ 12,00",
		localCompra: "Atacadão / Supermercado",
		marca: "Veja Multiuso",
		observacoes: "Frasco 500ml tradicional",
	},
	{
		id: "alcool",
		name: "ÁLCOOL",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 28,00",
		valorMaximo: "R$ 42,00",
		localCompra: "Atacadão / Distribuidora",
		marca: "Tupi / Da Ilha 70%",
		observacoes: "Galão 5L álcool 70% líquido e gel para assepsia",
	},
	{
		id: "saco-de-lixo",
		name: "SACO DE LIXO",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 22,00",
		valorMaximo: "R$ 34,00",
		localCompra: "Atacadão / Distribuidora",
		marca: "Reforçado 100L / 60L",
		observacoes: "Pacote c/ 50 ou 100 unidades reforçado",
	},
	{
		id: "pano-de-prato",
		name: "PANO DE PRATO",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 3,50",
		valorMaximo: "R$ 5,50",
		localCompra: "Feira dos Importados / Atacadão",
		marca: "100% Algodão Santa Margarida",
		observacoes: "Unidade alvejado trama fechada",
	},
	{
		id: "sabao-liquido",
		name: "SABÃO LÍQUIDO",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 28,00",
		localCompra: "Atacadão / Distribuidora",
		marca: "Premisse / Bellinzoni",
		observacoes: "Galão de 5L sabonete líquido neutro para mãos",
	},
	{
		id: "bucha",
		name: "BUCHA",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 9,00",
		valorMaximo: "R$ 15,00",
		localCompra: "Atacadão / Assaí",
		marca: "Scotch-Brite 3M / Bettanin",
		observacoes: "Pacote c/ 10 esponjas dupla face verde/amarela",
	},
	{
		id: "perfex",
		name: "PERFEX",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 18,00",
		valorMaximo: "R$ 28,00",
		localCompra: "Atacadão / Distribuidora",
		marca: "Scott Duramax / Perfex",
		observacoes: "Rolo c/ 50 a 100 panos multiuso descartáveis",
	},
	{
		id: "kiboa",
		name: "KIBOA",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 12,00",
		valorMaximo: "R$ 18,00",
		localCompra: "Atacadão / Assaí",
		marca: "Q-Boa / Dragão",
		observacoes: "Galão 5L água sanitária",
	},
	{
		id: "papel-toalha",
		name: "PAPEL TOALHA",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 5,00",
		valorMaximo: "R$ 8,00",
		localCompra: "Atacadão / Assaí",
		marca: "Snob / Kitchen / Mili",
		observacoes: "Pacote c/ 2 rolos folha dupla para bancada",
	},
	{
		id: "papel-higienico",
		name: "PAPEL HIGIÊNICO",
		category: "HIGIENE E SEGURANÇA",
		valorBom: "R$ 38,00",
		valorMaximo: "R$ 55,00",
		localCompra: "Atacadão / Assaí",
		marca: "Neve / Personal / Mili",
		observacoes: "Fardo c/ 24 a 48 rolos folha dupla",
	},
];

export const INSUMO_CATEGORIES_LIST = [
	"BEBIDAS E SODAS",
	"INSUMOS E CONFEITARIA",
	"CALDAS",
	"CAFETERIA E MATINAL",
	"EMBALAGENS E DESCARTÁVEIS",
	"OPERACIONAL E DELIVERY",
	"HIGIENE E SEGURANÇA",
	"OUTROS",
] as const;

export type InsumoCategoryName = (typeof INSUMO_CATEGORIES_LIST)[number];

export function getInsumoCategory(itemName: string): string {
	if (!itemName) return "OUTROS";
	const norm = itemName
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();

	// 1. Direct match in INVENTORY_DATA
	for (const cat of INVENTORY_DATA) {
		for (const item of cat.items) {
			const itemNorm = item
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.toLowerCase()
				.trim();
			if (itemNorm === norm) {
				return cat.category;
			}
		}
	}

	// 2. Contains match in catalog
	for (const cat of INVENTORY_DATA) {
		for (const item of cat.items) {
			const itemNorm = item
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.toLowerCase()
				.trim();
			if (norm.includes(itemNorm) || itemNorm.includes(norm)) {
				return cat.category;
			}
		}
	}

	// 3. Keyword heuristic
	if (
		norm.includes("agua") ||
		norm.includes("coca") ||
		norm.includes("refrigerante") ||
		norm.includes("soda") ||
		norm.includes("red bull") ||
		norm.includes("bubble") ||
		norm.includes("gatorade") ||
		norm.includes("fanta") ||
		norm.includes("bebida")
	) {
		return "BEBIDAS E SODAS";
	}

	if (
		norm.includes("nutella") ||
		norm.includes("ninho") ||
		norm.includes("leite") ||
		norm.includes("cacau") ||
		norm.includes("m&m") ||
		norm.includes("granulado") ||
		norm.includes("chantilly") ||
		norm.includes("doce de leite") ||
		norm.includes("ovomaltine") ||
		norm.includes("chocolate") ||
		norm.includes("lotus") ||
		norm.includes("oreo") ||
		norm.includes("alpino") ||
		norm.includes("kinder") ||
		norm.includes("gelo") ||
		norm.includes("confeitaria")
	) {
		return "INSUMOS E CONFEITARIA";
	}

	if (norm.includes("calda")) {
		return "CALDAS";
	}

	if (
		norm.includes("cafe") ||
		norm.includes("capsula") ||
		norm.includes("capuccino") ||
		norm.includes("nescafe") ||
		norm.includes("cha") ||
		norm.includes("acucar") ||
		norm.includes("adocante")
	) {
		return "CAFETERIA E MATINAL";
	}

	if (
		norm.includes("copo") ||
		norm.includes("tampa") ||
		norm.includes("canudo") ||
		norm.includes("guardanapo") ||
		norm.includes("saquinho") ||
		norm.includes("kraft") ||
		norm.includes("caixa") ||
		norm.includes("bag") ||
		norm.includes("hamburgueira") ||
		norm.includes("papel manteiga") ||
		norm.includes("papel interfolhado") ||
		norm.includes("sacola") ||
		norm.includes("filme pvc") ||
		norm.includes("pvc") ||
		norm.includes("colher") ||
		norm.includes("misturador") ||
		norm.includes("suporte") ||
		norm.includes("embalag") ||
		norm.includes("descart")
	) {
		return "EMBALAGENS E DESCARTÁVEIS";
	}

	if (
		norm.includes("etiqueta") ||
		norm.includes("bobina") ||
		norm.includes("bilhete") ||
		norm.includes("envelope") ||
		norm.includes("troco") ||
		norm.includes("grampo") ||
		norm.includes("clipe") ||
		norm.includes("cielo")
	) {
		return "OPERACIONAL E DELIVERY";
	}

	if (
		norm.includes("luva") ||
		norm.includes("touca") ||
		norm.includes("desinfetante") ||
		norm.includes("detergente") ||
		norm.includes("veja") ||
		norm.includes("alcool") ||
		norm.includes("lixo") ||
		norm.includes("sabao") ||
		norm.includes("bucha") ||
		norm.includes("perfex") ||
		norm.includes("kiboa") ||
		norm.includes("papel toalha") ||
		norm.includes("papel higienico") ||
		norm.includes("higiene") ||
		norm.includes("seguranca")
	) {
		return "HIGIENE E SEGURANÇA";
	}

	return "OUTROS";
}
