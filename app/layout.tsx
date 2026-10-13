import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ExerciseProvider } from "@/lib/exercise-context";
import { HevyProvider } from "@/lib/hevy-context";
import { SettingsProvider } from "@/lib/settings-context";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type React from "react";
import { Suspense } from "react";
import "./globals.css";

const DESCRIPTION =
	"Plan hypertrophy training with live volume analysis, build routines with Claude, and push them straight to Hevy.";

export const metadata: Metadata = {
	metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://workout-analyzer.netlify.app"),
	title: { default: "Setsmith: forge your training week", template: "%s · Setsmith" },
	description: DESCRIPTION,
	applicationName: "Setsmith",
	openGraph: {
		title: "Setsmith: forge your training week",
		description: DESCRIPTION,
		siteName: "Setsmith",
		type: "website",
	},
	twitter: { card: "summary_large_image", title: "Setsmith", description: DESCRIPTION },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
		{ media: "(prefers-color-scheme: dark)", color: "#141210" },
	],
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		// next-themes sets the theme class before React hydrates.
		<html lang="en" suppressHydrationWarning>
			<body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<AuthProvider>
						<SettingsProvider>
							<HevyProvider>
								<ExerciseProvider>
									<Suspense fallback={null}>
										{children}
										<Toaster />
									</Suspense>
								</ExerciseProvider>
							</HevyProvider>
						</SettingsProvider>
					</AuthProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
