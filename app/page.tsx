"use client";

import { AnalysisPanel } from "@/components/analysis-panel";
import { AuthModal } from "@/components/auth-modal";
import { RoutineBuilder } from "@/components/routine-builder";
import { SavedRoutinesModal } from "@/components/saved-routines-modal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth } from "@/lib/auth-context";
import {
	savePrioritiesToFirebase,
	saveRoutineToFirebase,
} from "@/lib/firebase-storage";
import {
	loadPriorities,
	loadRoutine,
	savePriorities,
	saveRoutine,
} from "@/lib/storage";
import type { PriorityTier, Routine } from "@/lib/types";
import {
	BarChart3,
	Dumbbell,
	FolderOpen,
	LogOut,
	Save,
	User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const DEFAULT_ROUTINE: Routine = {
	id: "default",
	name: "My Routine",
	days: [
		{ id: "day-1", name: "Day 1", exercises: [] },
		{ id: "day-2", name: "Day 2", exercises: [] },
		{ id: "day-3", name: "Day 3", exercises: [] },
	],
};

export default function Home() {
	const { user, signOut, isConfigured } = useAuth();
	const [showAuth, setShowAuth] = useState(false);
	const [showSavedRoutines, setShowSavedRoutines] = useState(false);

	const [routine, setRoutine] = usePersistedState<Routine>(
		"routine",
		DEFAULT_ROUTINE,
		saveRoutine,
		loadRoutine
	);

	const [priorities, setPriorities] = usePersistedState<
		Partial<Record<PriorityTier, string[]>>
	>("priorities", {}, savePriorities, loadPriorities);

	// Show toast on first load if data was restored
	useEffect(() => {
		const hasStoredData = loadRoutine() !== null || loadPriorities() !== null;
		if (hasStoredData) {
			// MODIFIED: Changed to sonner's syntax
			toast("Welcome Back!", {
				description:
					"Your routine and settings have been restored from your last session.",
			});
		}
	}, []); // Removed toast from dependency array as it's a stable import

	const handleSaveToFirebase = async () => {
		if (!user) {
			// MODIFIED: Changed to sonner's error syntax
			toast.error("Login Required", {
				description: "Please log in or create an account to save your routine.",
			});
			return;
		}

		try {
			await saveRoutineToFirebase(user.uid, routine);
			await savePrioritiesToFirebase(user.uid, priorities);
			// MODIFIED: Changed to sonner's success syntax
			toast.success("Routine Saved!", {
				description:
					"Your routine has been successfully saved to your account.",
			});
		} catch (error) {
			console.error("Failed to save routine:", error);
			// MODIFIED: Changed to sonner's error syntax
			toast.error("Save Failed", {
				description:
					"We couldn't save your routine. Please check your connection and try again.",
			});
		}
	};

	const handleSignOut = async () => {
		try {
			await signOut();
			// MODIFIED: Changed to sonner's success syntax
			toast.success("Signed Out", {
				description: "You have been signed out successfully.",
			});
		} catch (error) {
			console.error("Failed to sign out:", error);
			// MODIFIED: Changed to sonner's error syntax
			toast.error("Sign Out Failed", {
				description: "There was an issue signing you out. Please try again.",
			});
		}
	};

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b border-border bg-card">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex gap-4 items-center">
							<Dumbbell />
							<div>
								<h1 className="text-2xl font-bold text-balance">
									Workout Routine Analyzer
								</h1>
								<p className="text-sm text-muted-foreground">
									Build smarter routines with science-backed feedback
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							{user ? (
								<>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowSavedRoutines(true)}
									>
										<FolderOpen className="h-4 w-4 mr-2" />
										My Routines
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={handleSaveToFirebase}
									>
										<Save className="h-4 w-4 mr-2" />
										Save to Account
									</Button>
									<Button variant="outline" size="sm" onClick={handleSignOut}>
										<LogOut className="h-4 w-4 mr-2" />
										Sign Out
									</Button>
								</>
							) : (
								isConfigured && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowAuth(true)}
									>
										<User className="h-4 w-4 mr-2" />
										Login / Sign Up
									</Button>
								)
							)}
						</div>
					</div>
				</div>
			</header>

			{/* Desktop: Two-panel layout */}
			<div className="hidden lg:grid lg:grid-cols-2 lg:gap-0 h-[calc(100vh-73px)]">
				<div className="border-r border-border overflow-y-auto p-6 xl:p-8">
					<RoutineBuilder routine={routine} onRoutineChange={setRoutine} />
				</div>
				<div className="overflow-y-auto bg-card/50 p-6 xl:p-8">
					<AnalysisPanel
						routine={routine}
						priorities={priorities}
						onPrioritiesChange={setPriorities}
					/>
				</div>
			</div>

			{/* Mobile: Tab-based interface */}
			<div className="lg:hidden">
				<Tabs defaultValue="builder" className="w-full">
					<TabsList className="w-full rounded-none border-b border-border h-14 bg-card">
						<TabsTrigger value="builder" className="flex-1 gap-2">
							<Dumbbell className="h-4 w-4" />
							Builder
						</TabsTrigger>
						<TabsTrigger value="analysis" className="flex-1 gap-2">
							<BarChart3 className="h-4 w-4" />
							Analysis
						</TabsTrigger>
					</TabsList>
					<TabsContent
						value="builder"
						className="m-0 min-h-[calc(100vh-129px)] p-4 sm:p-6"
					>
						<RoutineBuilder routine={routine} onRoutineChange={setRoutine} />
					</TabsContent>
					<TabsContent
						value="analysis"
						className="m-0 min-h-[calc(100vh-129px)] p-4 sm:p-6"
					>
						<AnalysisPanel
							routine={routine}
							priorities={priorities}
							onPrioritiesChange={setPriorities}
						/>
					</TabsContent>
				</Tabs>
			</div>

			<AuthModal open={showAuth} onOpenChange={setShowAuth} />
			<SavedRoutinesModal
				open={showSavedRoutines}
				onOpenChange={setShowSavedRoutines}
				onLoadRoutine={setRoutine}
				onLoadPriorities={setPriorities}
			/>
		</div>
	);
}
