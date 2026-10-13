"use client";

import { ToneBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { MAX_MUSCLE_SETS_PER_SESSION, MAX_SETS_PER_SESSION } from "@/lib/constants";
import { TONE_CLASSES, type Tone } from "@/lib/design";
import { useExercises } from "@/lib/exercise-context";
import type { MuscleVolume, Routine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface FatigueAnalysisProps {
	routine: Routine;
	muscleVolumes: MuscleVolume[];
}

// Session size bands, by total working sets.
const FATIGUE_LEVELS: { maxSets: number; label: string; tone: Tone; description: string }[] = [
	{ maxSets: 12, label: "Light", tone: "growing", description: "Short session; recovery is quick." },
	{ maxSets: 18, label: "Moderate", tone: "optimal", description: "A productive workload." },
	{ maxSets: MAX_SETS_PER_SESSION, label: "High", tone: "high", description: "Later exercises may suffer; sleep and eat well." },
	{ maxSets: Infinity, label: "Very high", tone: "over", description: "Risks junk volume. Consider moving work to another day." },
];

export function FatigueAnalysis({ routine, muscleVolumes }: FatigueAnalysisProps) {
	const { getExercise } = useExercises();

	const sessions = useMemo(
		() =>
			routine.days.map((day) => {
				const totalSets = day.exercises.reduce((n, ex) => n + ex.sets, 0);
				const perMuscle = new Map<string, number>();
				for (const ex of day.exercises) {
					for (const w of getExercise(ex.exerciseId)?.muscle_weightings ?? []) {
						perMuscle.set(w.muscle, (perMuscle.get(w.muscle) ?? 0) + ex.sets * w.weighting);
					}
				}
				const junk = [...perMuscle]
					.filter(([, v]) => v > MAX_MUSCLE_SETS_PER_SESSION)
					.map(([muscle, volume]) => ({ muscle, volume }));
				const level = FATIGUE_LEVELS.find((l) => totalSets <= l.maxSets)!;
				return { day, totalSets, junk, level };
			}),
		[routine, getExercise]
	);

	const trained = muscleVolumes.filter((mv) => mv.totalSets > 0);
	const once = trained.filter((mv) => mv.frequency === 1);
	const often = trained.filter((mv) => mv.frequency >= 2);
	const maxSets = Math.max(MAX_SETS_PER_SESSION, ...sessions.map((s) => s.totalSets));

	return (
		<div className="space-y-4">
			<Card className="gap-4 p-4 sm:p-5">
				<div>
					<h3 className="font-semibold">Sessions</h3>
					<p className="text-xs text-muted-foreground">
						Working sets per session. Above {MAX_SETS_PER_SESSION} gets very fatiguing; above{" "}
						{MAX_MUSCLE_SETS_PER_SESSION} for one muscle in a session risks junk volume.
					</p>
				</div>
				<ul className="space-y-4">
					{sessions.map(({ day, totalSets, junk, level }) => (
						<li key={day.id} className="space-y-2">
							<div className="flex items-center gap-2">
								<span className="truncate text-sm font-medium">{day.name}</span>
								<ToneBadge tone={level.tone} className="ml-auto shrink-0">
									{level.label}
								</ToneBadge>
								<span className="tabular w-[4.5rem] shrink-0 text-right text-sm font-semibold">
									{totalSets}
									<span className="ml-1 text-xs font-normal text-muted-foreground">sets</span>
								</span>
							</div>
							<div className="relative h-2.5 overflow-hidden rounded-full bg-muted" title={level.description}>
								<div
									className={cn("h-full rounded-full transition-[width] duration-500", TONE_CLASSES[level.tone].fill)}
									style={{ width: `${(totalSets / maxSets) * 100}%` }}
								/>
								<div
									className="absolute inset-y-0 w-px bg-foreground/25"
									style={{ left: `${(MAX_SETS_PER_SESSION / maxSets) * 100}%` }}
								/>
							</div>
							{junk.length > 0 && (
								<p className={cn("text-xs", TONE_CLASSES.over.text)}>
									Junk-volume risk: {junk.map((j) => `${j.muscle} ${j.volume.toFixed(1)} sets`).join(", ")}.
								</p>
							)}
						</li>
					))}
				</ul>
			</Card>

			<Card className="gap-4 p-4 sm:p-5">
				<div>
					<h3 className="font-semibold">Frequency</h3>
					<p className="text-xs text-muted-foreground">
						Most muscles grow better with their weekly volume split over two or more sessions.
					</p>
				</div>
				{once.length > 0 && (
					<MuscleGroup tone="maintain" title={`Once a week (${once.length})`} muscles={once.map((m) => m.muscle)} />
				)}
				{often.length > 0 && (
					<MuscleGroup
						tone="optimal"
						title={`Twice or more (${often.length})`}
						muscles={often.map((m) => `${m.muscle} ${m.frequency}×`)}
					/>
				)}
			</Card>
		</div>
	);
}

function MuscleGroup({ tone, title, muscles }: { tone: Tone; title: string; muscles: string[] }) {
	return (
		<div className="space-y-2">
			<p className={cn("text-xs font-medium", TONE_CLASSES[tone].text)}>{title}</p>
			<div className="flex flex-wrap gap-1.5">
				{muscles.map((m) => (
					<span key={m} className="rounded-md bg-surface px-2 py-1 text-xs">
						{m}
					</span>
				))}
			</div>
		</div>
	);
}
