import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type React from "react";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: "Workout Routine Analyzer",
	description: "Build smarter workout routines with science-backed feedback",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
				<AuthProvider>
					<Suspense fallback={null}>
						{children}
						<Toaster />
					</Suspense>
				</AuthProvider>
				<Analytics />
			</body>
		</html>
	);
}
