import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { StoreId } from "@/types";
import { DEFAULT_LOJA_INFO, LojaInfo, LojasInfoMap } from "@/types/lojas-info";

const LOJAS_INFO_COLLECTION = "configuracoes";
const LOJAS_INFO_DOC = "informacoes_lojas";

export const getInitialLojasInfo = (): LojasInfoMap => ({
	lago: { ...DEFAULT_LOJA_INFO },
	terraco: { ...DEFAULT_LOJA_INFO },
	conjunto: { ...DEFAULT_LOJA_INFO },
	noroeste: { ...DEFAULT_LOJA_INFO },
});

export const subscribeLojasInfo = (callback: (data: LojasInfoMap) => void) => {
	const docRef = doc(db, LOJAS_INFO_COLLECTION, LOJAS_INFO_DOC);

	return onSnapshot(
		docRef,
		(snapshot) => {
			if (snapshot.exists()) {
				const data = snapshot.data() as Partial<LojasInfoMap>;
				const initial = getInitialLojasInfo();
				const merged: LojasInfoMap = {
					lago: { ...initial.lago, ...(data.lago || {}) },
					terraco: { ...initial.terraco, ...(data.terraco || {}) },
					conjunto: { ...initial.conjunto, ...(data.conjunto || {}) },
					noroeste: { ...initial.noroeste, ...(data.noroeste || {}) },
				};
				callback(merged);
			} else {
				callback(getInitialLojasInfo());
			}
		},
		(error) => {
			console.error("Erro ao escutar informações das lojas:", error);
			callback(getInitialLojasInfo());
		}
	);
};

export const updateLojaInfo = async (storeId: StoreId, info: LojaInfo) => {
	const docRef = doc(db, LOJAS_INFO_COLLECTION, LOJAS_INFO_DOC);
	await setDoc(
		docRef,
		{
			[storeId]: info,
		},
		{ merge: true }
	);
};
