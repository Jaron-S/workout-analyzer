"use client";

import { FatigueAnalysis } from "@/components/analysis/fatigue-analysis";
import { PriorityAnalysis } from "@/components/analysis/priority-analysis";
import { VolumeAnalysis } from "@/components/analysis/volume-analysis";
import { BodyMap, type MuscleTones } from "@/components/body-map";
import { TierBadge, ZoneBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import volumeLandmarks from "@/data/volume-landmarks.json";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { ALL_MUSCLES } from "@/lib/constants";
import { ZONES } from "@/lib/design";
import { useExercises } from "@/lib/exercise-context";
import { analyzePriorities, tierOf } from "@/lib/priority-analysis";
import type { PriorityTier, Routine, VolumeLandmarks } from "@/lib/types";
import { calculateMuscleVolumes, getVolumeZone } from "@/lib/volume-calculator";
import { useCallback, useMemo, useState } from "react";

const LANDMARKS = volumeLandmarks as VolumeLandmarks;

interface AnalysisPanelProps {
	routine: Routine;
	priorities: Partial<Record<PriorityTier, string[]>>;
	onPrioritiesChange: (priorities: Partial<Record<PriorityTier, string[]>>) => void;
	onAddExercise: (dayId: string, exerciseId: string, sets: number) => void;
}

const TAB_STORAGE_KEY = "analysisPanelTab";

export function AnalysisPanel({ routine, priorities, onPrioritiesChange, onAddExercise }: AnalysisPanelProps) {
	const { exercises } = useExercises();
	const muscleVolumes = useMemo(() => calculateMuscleVolumes(routine, exercises), [routine, exercises]);
	const priorityResults = useMemo(() => analyzePriorities(muscleVolumes, priorities), [muscleVolumes, priorities]);
	const [activeMuscle, setActiveMuscle] = useState<string | null>(null);

	const saveTab = useCallback((value: string) => {
		try {
			window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(value));
		} catch {}
	}, []);
	const loadTab = useCallback((): string | null => {
		try {
			const item = window.localStorage.getItem(TAB_STORAGE_KEY);
			return item ? JSON.parse(item) : null;
		} catch {
			return null;
		}
	}, []);
	const [activeTab, setActiveTab] = usePersistedState<string>(TAB_STORAGE_KEY, "volume", saveTab, loadTab);

	const setsFor = useCallback(
		(muscle: string) => muscleVolumes.find((mv) => mv.muscle === muscle)?.totalSets ?? 0,
		[muscleVolumes]
	);

	const tones = useMemo<MuscleTones>(
		() =>
			Object.fromEntries(
				ALL_MUSCLES.map((m) => {
					const sets = setsFor(m);
					return [m, sets > 0 ? ZONES[getVolumeZone(sets, LANDMARKS, m)].tone : null];
				})
			),
		[setsFor]
	);

	const hasExercises = routine.days.some((day) => day.exercises.length > 0);
	const totalSets = routine.days.reduce((n, d) => n + d.exercises.reduce((m, e) => m + e.sets, 0), 0);
	const hasPriorities = priorityResults.length > 0;
	const onTarget = priorityResults.filter((r) => r.status === "optimal" || r.status === "good").length;
	const needWork = priorityResults.length - onTarget;
	const zoneCounts = ALL_MUSCLES.reduce(
		(acc, m) => {
			const sets = setsFor(m);
			if (sets === 0) return acc;
			const tone = ZONES[getVolumeZone(sets, LANDMARKS, m)].tone;
			if (tone === "optimal" || tone === "growing") acc.good++;
			else if (tone === "under" || tone === "over") acc.attention++;
			return acc;
		},
		{ good: 0, attention: 0 }
	);

	return (
		<div className="space-y-4">
			<Card className="gap-0 overflow-hidden p-0">
				<div className="grid gap-4 p-4 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @lg:p-5">
					<BodyMap tones={tones} active={activeMuscle} onActiveChange={setActiveMuscle} className="mx-auto w-full max-w-[300px]" />
					<div className="flex flex-col justify-between gap-4">
						<div className="grid grid-cols-3 gap-2 @lg:grid-cols-1 @lg:gap-3">
							<Stat label="Sets / week" value={totalSets} />
							{hasPriorities ? (
								<>
									<Stat label="Priorities on target" value={`${onTarget}/${priorityResults.length}`} tone={needWork === 0 ? "good" : undefined} />
									<Stat label="Need work" value={needWork} tone={needWork > 0 ? "bad" : "good"} />
								</>
							) : (
								<>
									<Stat label="Growing or optimal" value={zoneCounts.good} />
									<Stat label="Need attention" value={zoneCounts.attention} tone={zoneCounts.attention > 0 ? "bad" : undefined} />
								</>
							)}
						</div>
						<MuscleDetail
							muscle={activeMuscle}
							sets={activeMuscle ? setsFor(activeMuscle) : 0}
							tier={activeMuscle ? tierOf(priorities, activeMuscle) : undefined}
							hasExercises={hasExercises}
						/>
					</div>
				</div>
			</Card>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="volume">Volume</TabsTrigger>
					<TabsTrigger value="priority">Priorities</TabsTrigger>
					<TabsTrigger value="fatigue">Fatigue</TabsTrigger>
				</TabsList>
				<TabsContent value="volume">
					{hasExercises ? (
						<VolumeAnalysis muscleVolumes={muscleVolumes} priorities={priorities} onMuscleHover={setActiveMuscle} />
					) : (
						<EmptyAnalysis text="Add exercises to see weekly volume for every muscle." />
					)}
				</TabsContent>
				<TabsContent value="priority">
					<PriorityAnalysis
						routine={routine}
						results={priorityResults}
						priorities={priorities}
						onPrioritiesChange={onPrioritiesChange}
						onAddExercise={onAddExercise}
					/>
				</TabsContent>
				<TabsContent value="fatigue">
					{hasExercises ? (
						<FatigueAnalysis routine={routine} muscleVolumes={muscleVolumes} />
					) : (
						<EmptyAnalysis text="Add exercises to see session fatigue and training frequency." />
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "bad" }) {
	return (
		<div className="rounded-lg bg-surface px-3 py-2.5">
			<div
				className={
					"tabular text-xl font-semibold tracking-tight @lg:text-2xl " +
					(tone === "good" ? "text-status-optimal" : tone === "bad" ? "text-status-under" : "")
				}
			>
				{value}
			</div>
			<div className="text-[11px] leading-tight text-muted-foreground @lg:text-xs">{label}</div>
		</div>
	);
}

function MuscleDetail({
	muscle,
	sets,
	tier,
	hasExercises,
}: {
	muscle: string | null;
	sets: number;
	tier?: PriorityTier;
	hasExercises: boolean;
}) {
	if (!muscle) {
		return (
			<p className="text-xs text-muted-foreground">
				{hasExercises
					? "Tap a muscle to see its weekly volume. Colours show where each one sits against its landmarks."
					: "Your muscles light up here as you add exercises."}
			</p>
		);
	}
	const l = LANDMARKS[muscle];
	const zone = getVolumeZone(sets, LANDMARKS, muscle);
	return (
		<div className="space-y-1.5 rounded-lg bg-surface px-3 py-2.5">
			<div className="flex items-center gap-2">
				<span className="font-medium">{muscle}</span>
				{tier && <TierBadge tier={tier} />}
				<span className="tabular ml-auto text-sm font-semibold">{sets.toFixed(1)} sets</span>
			</div>
			<div className="flex items-center justify-between gap-2">
				{sets > 0 ? <ZoneBadge zone={zone} /> : <span className="text-xs text-muted-foreground">Not trained</span>}
				<span className="tabular text-xs text-muted-foreground">
					MEV {l.mev} · MAV {l.mav_min}–{l.mav_max} · MRV {l.mrv}
				</span>
			</div>
		</div>
	);
}

function EmptyAnalysis({ text }: { text: string }) {
	return (
		<Card className="items-center p-10 text-center text-sm text-muted-foreground">{text}</Card>
	);
}
