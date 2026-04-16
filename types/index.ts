export type StoreId = 'conjunto' | 'terraco' | 'lago' | 'noroeste';

export const STORE_NAMES: Record<StoreId, string> = {
  conjunto: 'Conjunto Nacional',
  terraco: 'Terraço Shopping',
  lago: 'Lago Sul',
  noroeste: 'Noroeste',
};

export interface StockData {
  classicoAoLeite: number;
  nutella: number;
  brigadeiro: number;
  pistache: number;
  macadamia: number;
  ovomaltine: number;
  newYork: number;
  mms: number;
  cremeBrulle: number;
  kinderBueno: number;
  lotus: number;
  brownie: number;
  triploChocolate: number;
  redNinho: number;
  redNutella: number;
  oreo: number;
  classicoRed: number;
  jackDaniels: number;
  eclipse: number;
  sorvete: number;
  acai: number;
}

export const STOCK_LABELS: Record<keyof StockData, string> = {
  classicoAoLeite: 'CLÁSSICO AO LEITE',
  nutella: 'NUTELLA',
  brigadeiro: 'BRIGADEIRO',
  pistache: 'PISTACHE',
  macadamia: 'MACADAMIA',
  ovomaltine: 'OVOMALTINE',
  newYork: 'NEW YORK',
  mms: "M'MS",
  cremeBrulle: 'CREME BRÜLLE',
  kinderBueno: 'KINDER BUENO',
  lotus: 'LÓTUS',
  brownie: 'BROWNIE',
  triploChocolate: 'TRIPLO CHOCOLATE',
  redNinho: 'RED NINHO',
  redNutella: 'RED NUTELLA',
  oreo: 'OREO',
  classicoRed: 'CLÁSSICO RED',
  jackDaniels: 'JACK DANIELS',
  eclipse: 'ECLIPSE',
  sorvete: 'SORVETE',
  acai: 'AÇAÍ',
};

export interface StoreDocument {
  id: StoreId;
  lastStockUpdate: any; // Firestore Timestamp
  stock: Partial<StockData>;
}

export type UrgencyLevel = 'Urgente' | 'Normal' | 'Sem urgência';

export interface SupplyOrder {
  id: string;
  name: string;
  urgency: UrgencyLevel;
  quantity?: string;
  status: 'pending' | 'delivered';
  createdAt: any; // Firestore Timestamp
  deliveredAt?: any; // Firestore Timestamp
  expireAt?: any; // Firestore Timestamp
}
