"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import exercises from "@/data/exercises.json";
import {
	MAX_MUSCLE_SETS_PER_SESSION,
	MAX_SETS_PER_SESSION,
} from "@/lib/constants";
import type { MuscleVolume, Routine } from "@/lib/types";
import { getTotalSessionSets } from "@/lib/volume-calculator";
import { AlertTriangle, CheckCircle2, Repeat, Zap } from "lucide-react";
import { useMemo } from "react";

// --- PROPS ---
interface FatigueAnalysisProps {
	routine: Routine;
	muscleVolumes: MuscleVolume[];
}

// --- CONFIGURATION ---
const FATIGUE_THRESHOLDS = [
	{
		level: "low",
		maxSets: 12,
		label: "Low",
		color: "bg-green-500",
		icon: CheckCircle2,
		description:
			"Great session length. Recovery should be quick and manageable.",
	},
	{
		level: "moderate",
		maxSets: 18,
		label: "Moderate",
		color: "bg-sky-500",
		icon: CheckCircle2,
		description:
			"Solid session volume. This is a productive workload for driving growth.",
	},
	{
		level: "high",
		maxSets: MAX_SETS_PER_SESSION,
		label: "High",
		color: "bg-yellow-500",
		icon: AlertTriangle,
		description:
			"High fatigue session. Performance on later exercises may decline. Ensure adequate nutrition and sleep.",
	},
	{
		level: "extreme",
		maxSets: Infinity,
		label: "Extreme",
		color: "bg-destructive",
		icon: AlertTriangle,
		description:
			"Very high fatigue. High risk of 'junk volume' and impaired recovery. Consider moving some exercises to another day.",
	},
];

const FREQUENCY_STATUS = {
	suboptimal: {
		label: "Suboptimal",
		color: "text-yellow-500",
		icon: AlertTriangle,
	},
	optimal: { label: "Optimal", color: "text-green-500", icon: CheckCircle2 },
	high: { label: "High", color: "text-sky-500", icon: CheckCircle2 },
};

// --- COMPONENT ---
export function FatigueAnalysis({
	routine,
	muscleVolumes,
}: FatigueAnalysisProps) {
	const analysis = useMemo(() => {
		const sessionAnalyses = routine.days.map((day) => {
			const totalSets = day.exercises.reduce((acc, curr) => acc + curr.sets, 0);

			const muscleSessionVolumes = new Map<string, number>();
			day.exercises.forEach((routineEx) => {
				const exercise = exercises.find((ex) => ex.id === routineEx.exerciseId);
				if (!exercise) return;
				exercise.muscle_weightings.forEach((mw) => {
					const volume = routineEx.sets * mw.weighting;
					muscleSessionVolumes.set(
						mw.muscle,
						(muscleSessionVolumes.get(mw.muscle) || 0) + volume
					);
				});
			});

			const highVolumeMuscles = Array.from(muscleSessionVolumes.entries())
				.filter(([, volume]) => volume > MAX_MUSCLE_SETS_PER_SESSION)
				.map(([muscle, volume]) => ({ muscle, volume }));

			const fatigueLevel =
				FATIGUE_THRESHOLDS.find((t) => totalSets <= t.maxSets) ||
				FATIGUE_THRESHOLDS[FATIGUE_THRESHOLDS.length - 1];

			return { day, totalSets, highVolumeMuscles, fatigueLevel };
		});

		const frequencyAnalysis = {
			suboptimal: muscleVolumes.filter(
				(mv) => mv.frequency === 1 && mv.totalSets > 0
			),
			optimal: muscleVolumes.filter(
				(mv) => mv.frequency >= 2 && mv.frequency <= 3 && mv.totalSets > 0
			),
			high: muscleVolumes.filter((mv) => mv.frequency > 3 && mv.totalSets > 0),
		};

		return { sessionAnalyses, frequencyAnalysis };
	}, [routine, muscleVolumes]);

	const highFatigueSessions = analysis.sessionAnalyses.filter(
		(s) => s.fatigueLevel.level === "extreme"
	).length;
	const junkVolumeRisks = analysis.sessionAnalyses.reduce(
		(acc, s) => acc + s.highVolumeMuscles.length,
		0
	);
	const frequencyWarnings = analysis.frequencyAnalysis.suboptimal.length;

	return (
		<TooltipProvider>
			<div className="space-y-6">
				{/* At-a-Glance Summary */}
				<div className="grid gap-4 md:grid-cols-3">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								High Fatigue Sessions
							</CardTitle>
							<Zap
								className={`h-4 w-4 ${
									highFatigueSessions > 0
										? "text-destructive"
										: "text-muted-foreground"
								}`}
							/>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{highFatigueSessions}</div>
							<p className="text-xs text-muted-foreground">
								Sessions over {MAX_SETS_PER_SESSION} sets
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Junk Volume Risks
							</CardTitle>
							<AlertTriangle
								className={`h-4 w-4 ${
									junkVolumeRisks > 0
										? "text-yellow-500"
										: "text-muted-foreground"
								}`}
							/>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{junkVolumeRisks}</div>
							<p className="text-xs text-muted-foreground">
								Muscles over {MAX_MUSCLE_SETS_PER_SESSION} sets per session
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Frequency Issues
							</CardTitle>
							<Repeat
								className={`h-4 w-4 ${
									frequencyWarnings > 0
										? "text-yellow-500"
										: "text-muted-foreground"
								}`}
							/>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{frequencyWarnings}</div>
							<p className="text-xs text-muted-foreground">
								Muscles trained only 1x/week
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Session Fatigue Analysis */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5" />
							Session Fatigue Analysis
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{analysis.sessionAnalyses.map(
							({ day, totalSets, highVolumeMuscles, fatigueLevel }) => (
								<div key={day.id} className="p-4 bg-secondary/50 rounded-lg">
									<div className="flex items-center justify-between mb-2">
										<span className="font-semibold">{day.name}</span>
										<div className="flex items-center gap-2">
											<span className="text-sm font-mono font-bold">
												{totalSets} sets
											</span>
											<Tooltip>
												<TooltipTrigger asChild>
													<Badge
														variant={
															fatigueLevel.level === "extreme"
																? "destructive"
																: "secondary"
														}
														className="gap-1 cursor-help"
													>
														<fatigueLevel.icon className="h-3 w-3" />
														{fatigueLevel.label}
													</Badge>
												</TooltipTrigger>
												<TooltipContent>
													<p className="text-xs max-w-xs">
														{fatigueLevel.description}
													</p>
												</TooltipContent>
											</Tooltip>
										</div>
									</div>
									{/* *** NEW: FATIGUE METER *** */}
									<div className="flex w-full h-2 gap-1 rounded-full overflow-hidden bg-muted">
										{FATIGUE_THRESHOLDS.map((threshold, index) => {
											const isActive =
												totalSets >
												(FATIGUE_THRESHOLDS[index - 1]?.maxSets || 0);
											return (
												<div
													key={threshold.level}
													className={`w-1/4 h-full ${
														isActive ? threshold.color : ""
													}`}
												/>
											);
										})}
									</div>
									{highVolumeMuscles.length > 0 && (
										<Alert variant="destructive" className="mt-3">
											<AlertTriangle className="h-4 w-4" />
											<AlertTitle>Junk Volume Warning</AlertTitle>
											<AlertDescription className="text-xs">
												High per-session volume for:{" "}
												{highVolumeMuscles
													.map((m) => `${m.muscle} (${m.volume.toFixed(1)})`)
													.join(", ")}
												. Performance may decline after ~12 sets for a single
												muscle.
											</AlertDescription>
										</Alert>
									)}
								</div>
							)
						)}
					</CardContent>
				</Card>

				{/* Frequency Analysis */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Repeat className="h-5 w-5" />
							Training Frequency
						</CardTitle>
					</CardHeader>
					<CardContent>
						{analysis.frequencyAnalysis.suboptimal.length > 0 && (
							<Alert className="mb-4 border-yellow-500/50 text-yellow-500 [&>svg]:text-yellow-500">
								<AlertTriangle className="h-4 w-4" />
								<AlertTitle>Suboptimal Frequency Detected</AlertTitle>
								<AlertDescription>
									Training a muscle only once per week is often less effective
									for growth. Consider splitting the volume for these muscles
									across 2 or more sessions.
								</AlertDescription>
							</Alert>
						)}
						{Object.entries(analysis.frequencyAnalysis).map(
							([status, muscles]) => {
								if (muscles.length === 0) return null;
								const statusConfig =
									FREQUENCY_STATUS[status as keyof typeof FREQUENCY_STATUS];
								return (
									<div key={status} className="mb-4 last:mb-0">
										<h4
											className={`font-semibold text-sm mb-2 flex items-center gap-2 ${statusConfig.color}`}
										>
											<statusConfig.icon className="h-4 w-4" />
											{statusConfig.label} ({muscles.length})
										</h4>
										<div className="flex flex-wrap gap-2">
											{muscles.map((mv) => (
												<Badge key={mv.muscle} variant="secondary">
													{mv.muscle} ({mv.frequency}x)
												</Badge>
											))}
										</div>
									</div>
								);
							}
						)}
					</CardContent>
				</Card>
			</div>
		</TooltipProvider>
	);
}
