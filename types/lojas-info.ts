import { StoreId } from "./index";

export interface LojaInfo {
	razaoSocial: string;
	cnpj: string;
	telefone: string;
	endereco: string;
	cep: string;
	email: string;
	gmail: string;
	operadoraCelular: string;
	provedorInternet: string;
}

export type LojasInfoMap = Record<StoreId, LojaInfo>;

export const DEFAULT_LOJA_INFO: LojaInfo = {
	razaoSocial: "",
	cnpj: "",
	telefone: "",
	endereco: "",
	cep: "",
	email: "",
	gmail: "",
	operadoraCelular: "",
	provedorInternet: "",
};
