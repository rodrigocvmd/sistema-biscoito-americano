"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InsumosRedirectPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/gerencia/insumos/lojas");
	}, [router]);

	return null;
}
