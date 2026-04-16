import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { StoreId, STORE_NAMES } from '../types';

export const seedDatabase = async () => {
  console.log('Iniciando povoamento do banco de dados...');
  
  const stores = Object.keys(STORE_NAMES) as StoreId[];

  for (const storeId of stores) {
    try {
      const storeRef = doc(db, 'stores', storeId);
      await setDoc(storeRef, {
        id: storeId,
        lastStockUpdate: serverTimestamp(),
        stock: {} // Inicia com estoque vazio
      }, { merge: true });
      
      console.log(`✅ Loja ${STORE_NAMES[storeId]} configurada.`);
    } catch (error) {
      console.error(`❌ Erro ao configurar loja ${storeId}:`, error);
    }
  }

  console.log('Povoamento concluído!');
};
