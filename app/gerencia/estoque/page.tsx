"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EstoquePage() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/gerencia/estoque/atual");
	}, [router]);

	return null;
}
