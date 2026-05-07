import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Sistema Biscoito Americano",
	description: "Sistema de contagem de estoque e pedidos de insumos",
	icons: {
		icon: "/amcLogo.svg",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="h-full antialiased" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem={false}
					disableTransitionOnChange
					storageKey="biscoito-theme"
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
