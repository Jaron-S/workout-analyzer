"use client";

import { FatigueAnalysis } from "@/components/analysis/fatigue-analysis";
import { PriorityAnalysis } from "@/components/analysis/priority-analysis";
import { VolumeAnalysis } from "@/components/analysis/volume-analysis";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import exercises from "@/data/exercises.json";
// 1. Import your hook and useCallback
import { usePersistedState } from "@/hooks/use-persisted-state";
import type { PriorityTier, Routine } from "@/lib/types";
import { calculateMuscleVolumes } from "@/lib/volume-calculator";
import { useCallback, useMemo } from "react";

interface AnalysisPanelProps {
	routine: Routine;
	priorities: Partial<Record<PriorityTier, string[]>>;
	onPrioritiesChange: (
		priorities: Partial<Record<PriorityTier, string[]>>
	) => void;
}

// 2. Define a key for localStorage
const TAB_STORAGE_KEY = "analysisPanelTab";

export function AnalysisPanel({
	routine,
	priorities,
	onPrioritiesChange,
}: AnalysisPanelProps) {
	const muscleVolumes = useMemo(() => {
		return calculateMuscleVolumes(routine, exercises);
	}, [routine]);

	// 3. Define helper functions for saving and loading the active tab
	const saveTab = useCallback((value: string) => {
		try {
			window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(value));
		} catch (error) {
			console.error("Error saving to localStorage", error);
		}
	}, []);

	const loadTab = useCallback((): string | null => {
		try {
			const item = window.localStorage.getItem(TAB_STORAGE_KEY);
			return item ? JSON.parse(item) : null;
		} catch (error) {
			console.error("Error loading from localStorage", error);
			return null;
		}
	}, []);

	// 4. Use the hook to manage the tab state
	const [activeTab, setActiveTab] = usePersistedState<string>(
		TAB_STORAGE_KEY,
		"volume",
		saveTab,
		loadTab
	);

	const hasExercises = routine.days.some((day) => day.exercises.length > 0);

	return (
		<div className="p-4 space-y-4">
			<div>
				<h2 className="text-xl font-bold">Live Analysis</h2>
				<p className="text-sm text-muted-foreground">
					Real-time feedback on your routine
				</p>
			</div>

			{/* 5. Control the Tabs component with the persisted state */}
			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="w-full space-y-4"
			>
				<TabsList className="w-full">
					<TabsTrigger value="volume" className="flex-1">
						Volume
					</TabsTrigger>
					<TabsTrigger value="priority" className="flex-1">
						Priorities
					</TabsTrigger>
					<TabsTrigger value="fatigue" className="flex-1">
						Fatigue
					</TabsTrigger>
				</TabsList>

				<TabsContent value="volume" className="space-y-4">
					{hasExercises ? (
						<VolumeAnalysis
							muscleVolumes={muscleVolumes}
							priorities={priorities}
						/>
					) : (
						<Card className="p-6">
							<div className="text-center py-12 text-muted-foreground">
								<p>Volume analysis will appear here</p>
								<p className="text-sm mt-2">
									Add exercises to see your weekly volume breakdown
								</p>
							</div>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="priority" className="space-y-4">
					{hasExercises ? (
						<PriorityAnalysis
							muscleVolumes={muscleVolumes}
							priorities={priorities}
							onPrioritiesChange={onPrioritiesChange}
						/>
					) : (
						<Card className="p-6">
							<div className="text-center py-12 text-muted-foreground">
								<p>Priority analysis will appear here</p>
								<p className="text-sm mt-2">
									Set your muscle priorities in settings
								</p>
							</div>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="fatigue" className="space-y-4">
					{hasExercises ? (
						<FatigueAnalysis routine={routine} muscleVolumes={muscleVolumes} />
					) : (
						<Card className="p-6">
							<div className="text-center py-12 text-muted-foreground">
								<p>Fatigue analysis will appear here</p>
								<p className="text-sm mt-2">
									Track session fatigue and training frequency
								</p>
							</div>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}
