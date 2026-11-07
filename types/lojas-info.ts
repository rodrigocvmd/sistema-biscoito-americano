import { StoreId } from "./index";

export interface LojaInfo {
	razaoSocial: string;
	cnpj: string;
	cnpjSimples: string;
	chavePix1: string;
	chavePix2: string;
	contaBb: string;
	agenciaBb: string;
	chaveJBb: string;
	chaveJAnaBb: string;
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
	cnpjSimples: "",
	chavePix1: "",
	chavePix2: "",
	contaBb: "",
	agenciaBb: "",
	chaveJBb: "",
	chaveJAnaBb: "",
	telefone: "",
	endereco: "",
	cep: "",
	email: "",
	gmail: "",
	operadoraCelular: "",
	provedorInternet: "",
};
