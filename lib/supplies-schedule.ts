import { StoreId } from "@/types";

export interface StoreScheduleConfig {
	closingDayIndex: number; // 0 = Domingo, 1 = Segunda, 2 = Terça, etc.
	closingDayName: string;
	deliveryDayIndex: number;
	deliveryDayName: string;
}

export const STORE_SCHEDULES: Record<StoreId, StoreScheduleConfig> = {
	lago: {
		closingDayIndex: 1, // Segunda-feira
		closingDayName: "Segunda-feira",
		deliveryDayIndex: 2, // Terça-feira
		deliveryDayName: "Terça-feira",
	},
	conjunto: {
		closingDayIndex: 1, // Segunda-feira
		closingDayName: "Segunda-feira",
		deliveryDayIndex: 2, // Terça-feira
		deliveryDayName: "Terça-feira",
	},
	noroeste: {
		closingDayIndex: 2, // Terça-feira
		closingDayName: "Terça-feira",
		deliveryDayIndex: 3, // Quarta-feira
		deliveryDayName: "Quarta-feira",
	},
	terraco: {
		closingDayIndex: 2, // Terça-feira
		closingDayName: "Terça-feira",
		deliveryDayIndex: 3, // Quarta-feira
		deliveryDayName: "Quarta-feira",
	},
};

export interface CycleInfo {
	storeId: StoreId;
	closingDayName: string;
	deliveryDayName: string;
	closingDate: Date;
	deliveryDate: Date;
	formattedClosingDate: string; // Ex: "Segunda-feira, 28/09"
	formattedDeliveryDate: string; // Ex: "Terça-feira, 29/09"
	dateKey: string; // Ex: "28/09/2026"
	daysRemaining: number;
	isClosingDay: boolean; // Hoje é o dia do fechamento
	isOneDayBefore: boolean; // Amanhã é o dia do fechamento
	isTwoDaysBefore: boolean; // Depois de amanhã é o dia do fechamento
	headline: string;
	subtext: string;
	alertVariant: "today" | "tomorrow" | "two-days" | "normal";
}

const WEEKDAY_NAMES = [
	"Domingo",
	"Segunda-feira",
	"Terça-feira",
	"Quarta-feira",
	"Quinta-feira",
	"Sexta-feira",
	"Sábado",
];

export const formatDayAndMonth = (date: Date): string => {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}`;
};

export const formatFullDateBR = (date: Date): string => {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	return `${day}/${month}/${year}`;
};

export function getStoreCycleInfo(storeId: string, referenceDate: Date = new Date()): CycleInfo {
	const validStoreId = (storeId in STORE_SCHEDULES ? storeId : "lago") as StoreId;
	const schedule = STORE_SCHEDULES[validStoreId];

	// Normaliza para início do dia de referência
	const today = new Date(referenceDate);
	today.setHours(0, 0, 0, 0);

	const todayDay = today.getDay();
	const targetClosingDay = schedule.closingDayIndex;

	let daysRemaining = 0;
	if (todayDay === targetClosingDay) {
		daysRemaining = 0;
	} else if (todayDay < targetClosingDay) {
		daysRemaining = targetClosingDay - todayDay;
	} else {
		daysRemaining = 7 - todayDay + targetClosingDay;
	}

	const closingDate = new Date(today);
	closingDate.setDate(today.getDate() + daysRemaining);

	const deliveryDate = new Date(closingDate);
	deliveryDate.setDate(closingDate.getDate() + 1);

	const isClosingDay = daysRemaining === 0;
	const isOneDayBefore = daysRemaining === 1;
	const isTwoDaysBefore = daysRemaining === 2;

	const formattedClosingDate = `${schedule.closingDayName}, ${formatDayAndMonth(closingDate)}`;
	const formattedDeliveryDate = `${schedule.deliveryDayName}, ${formatDayAndMonth(deliveryDate)}`;
	const dateKey = formatFullDateBR(closingDate);

	let alertVariant: "today" | "tomorrow" | "two-days" | "normal" = "normal";
	let headline = "";
	let subtext = "";

	if (isClosingDay) {
		alertVariant = "today";
		headline = "Hoje é o último dia para fechar a lista de insumos!";
		subtext = `Revise os insumos pedidos da sua loja e clique em "Concluir lista de insumos" até o final do expediente. A entrega será amanhã cedo (${formattedDeliveryDate}).`;
	} else if (isOneDayBefore) {
		alertVariant = "tomorrow";
		headline = `Atenção: amanhã (${formattedClosingDate}) é o último dia para fechar a lista!`;
		subtext = `Verifique com a equipe os insumos necessários para a entrega de ${formattedDeliveryDate}.`;
	} else if (isTwoDaysBefore) {
		alertVariant = "two-days";
		headline = `Feche sua lista até depois de amanhã (${formattedClosingDate})`;
		subtext = `Prazo final para consolidar os insumos desta semana. A entrega pelo gerente ocorrerá na ${formattedDeliveryDate}.`;
	} else {
		alertVariant = "normal";
		headline = `Próximo fechamento: ${formattedClosingDate}`;
		subtext = `Os pedidos desta lista serão entregues na ${formattedDeliveryDate} pela manhã.`;
	}

	return {
		storeId: validStoreId,
		closingDayName: schedule.closingDayName,
		deliveryDayName: schedule.deliveryDayName,
		closingDate,
		deliveryDate,
		formattedClosingDate,
		formattedDeliveryDate,
		dateKey,
		daysRemaining,
		isClosingDay,
		isOneDayBefore,
		isTwoDaysBefore,
		headline,
		subtext,
		alertVariant,
	};
}
