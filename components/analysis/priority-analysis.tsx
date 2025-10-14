"use client";

import { PrioritySettings } from "@/components/priority-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import volumeLandmarks from "@/data/volume-landmarks.json";
import type { MuscleVolume, PriorityTier } from "@/lib/types";
import { getVolumeZone } from "@/lib/volume-calculator";
import {
	AlertTriangle,
	CheckCircle2,
	Settings,
	ShieldAlert,
	Target,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

// --- PROPS ---
interface PriorityAnalysisProps {
	muscleVolumes: MuscleVolume[];
	priorities: Partial<Record<PriorityTier, string[]>>;
	onPrioritiesChange: (
		priorities: Partial<Record<PriorityTier, string[]>>
	) => void;
}

// --- CONFIGURATION ---
const TIER_TARGETS: Record<
	PriorityTier,
	{
		targetZone: "mav" | "mev-mav" | "mv-mev";
		description: string;
	}
> = {
	S: {
		targetZone: "mav",
		description: "Maximize growth with optimal MAV stimulus.",
	},
	A: {
		targetZone: "mav",
		description: "Target the MAV range for strong growth.",
	},
	B: {
		targetZone: "mev-mav",
		description: "Aim for the MEV-MAV range for steady progress.",
	},
	C: {
		targetZone: "mv-mev",
		description: "Maintain muscle with volume above MV.",
	},
	D: {
		targetZone: "mv-mev",
		description: "Acceptable to be at MV; focus on higher tiers.",
	},
	F: {
		targetZone: "mv-mev",
		description: "Avoid direct work; minimize indirect stimulus.",
	},
};

const TIER_COLORS: Record<PriorityTier, string> = {
	S: "hsl(var(--destructive))",
	A: "hsl(var(--primary))",
	B: "hsl(142.1 76.2% 46.5%)", // Green
	C: "hsl(47.9 95.8% 53.1%)", // Yellow
	D: "hsl(210 40% 96.1%)", // Muted
	F: "hsl(215 20.2% 65.1%)", // Gray
};

type AnalysisStatus = "optimal" | "good" | "warning" | "critical";
type SortOption = "priority" | "volume-high" | "volume-low" | "status";

// --- COMPONENT ---
export function PriorityAnalysis({
	muscleVolumes,
	priorities,
	onPrioritiesChange,
}: PriorityAnalysisProps) {
	const [sortBy, setSortBy] = useState<SortOption>("status");
	const [showSettings, setShowSettings] = useState(false);
	const hasPriorities = useMemo(
		() => Object.values(priorities).some((arr) => arr.length > 0),
		[priorities]
	);

	const analysis = useMemo(() => {
		if (!hasPriorities) return [];

		const results = [];
		const allMuscles = Object.values(priorities).flat();

		for (const muscle of allMuscles) {
			const tier = (Object.keys(priorities) as PriorityTier[]).find((t) =>
				priorities[t]?.includes(muscle)
			);
			if (!tier) continue;

			const landmarks = volumeLandmarks[muscle as keyof typeof volumeLandmarks];
			if (!landmarks) continue;

			const volume = muscleVolumes.find((mv) => mv.muscle === muscle);
			const currentSets = volume?.totalSets || 0;
			const zone = getVolumeZone(currentSets, volumeLandmarks, muscle);
			const target = TIER_TARGETS[tier];

			let status: AnalysisStatus = "good";
			let recommendation = "";

			if (zone === "above-mrv") {
				status = "critical";
				recommendation = `Exceeding MRV (${landmarks.mrv} sets). This is unsustainable and risks injury. Reduce volume immediately.`;
			} else if (tier === "F" && currentSets > landmarks.mv) {
				status = "warning";
				recommendation = `Receiving ${currentSets.toFixed(
					1
				)} sets of stimulus. To minimize growth, reduce indirect work from other lifts.`;
			} else if (tier === "S" || tier === "A") {
				if (zone === "mav") {
					status = "optimal";
					recommendation =
						"Perfect! Volume is in the optimal range for maximum growth.";
				} else if (zone === "mev-mav" || zone === "mav-mrv") {
					status = "good";
					recommendation =
						"Great work! You're in a productive growth zone. Aim for the MAV sweet spot for the best results.";
				} else {
					status = "critical";
					const setsNeeded = (landmarks.mav_min - currentSets).toFixed(1);
					recommendation = `CRITICAL: High priority, but volume is too low. Add ~${setsNeeded} sets to reach the optimal MAV range.`;
				}
			} else if (tier === "B") {
				if (zone === "mev-mav" || zone === "mav" || zone === "mav-mrv") {
					status = "optimal";
					recommendation =
						"Excellent! You've hit the target zone for steady progress.";
				} else {
					status = "warning";
					const setsNeeded = (landmarks.mev - currentSets).toFixed(1);
					recommendation = `Volume is below target. Add ~${setsNeeded} sets to stimulate consistent growth.`;
				}
			} else if (tier === "C" || tier === "D") {
				// *** REFACTORED LOGIC WITH LENIENCY ZONE ***
				if (zone === "below-mv") {
					status = "warning";
					recommendation =
						"Volume is below maintenance, risking muscle loss for this group.";
				} else if (zone === "mv-mev") {
					status = "optimal";
					recommendation =
						"Perfect! Volume is ideal for this priority level, allowing you to focus on your main goals.";
				} else if (zone === "mev-mav") {
					// The new "Leniency Zone"
					status = "good";
					recommendation =
						"Good. Volume is slightly high for this priority, but acceptable. You can consider reducing it to optimize recovery.";
				} else {
					// Catches mav and mav-mrv as "Significantly Over-invested"
					status = "warning";
					recommendation = `Warning: Volume is unnecessarily high. This may be stealing recovery capacity from your main goals.`;
				}
			}

			const targetMin =
				landmarks[
					target.targetZone === "mav"
						? "mav_min"
						: target.targetZone === "mev-mav"
						? "mev"
						: "mv"
				];
			const targetMax =
				landmarks[
					target.targetZone === "mav"
						? "mav_max"
						: target.targetZone === "mev-mav"
						? "mav_max"
						: "mev"
				];
			const displayMax = Math.max(targetMax, currentSets) * 1.2;

			results.push({
				tier,
				muscle,
				currentSets,
				zone,
				status,
				recommendation,
				targetMin,
				targetMax,
				displayMax,
			});
		}
		return results;
	}, [muscleVolumes, priorities, hasPriorities]);

	const sortedAnalysis = useMemo(() => {
		const sorted = [...analysis];
		const statusOrder: Record<AnalysisStatus, number> = {
			critical: 0,
			warning: 1,
			good: 2,
			optimal: 3,
		};
		switch (sortBy) {
			case "priority":
				const tierOrder: Record<PriorityTier, number> = {
					S: 0,
					A: 1,
					B: 2,
					C: 3,
					D: 4,
					F: 5,
				};
				return sorted.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
			case "volume-high":
				return sorted.sort((a, b) => b.currentSets - a.currentSets);
			case "volume-low":
				return sorted.sort((a, b) => a.currentSets - b.currentSets);
			case "status":
				return sorted.sort(
					(a, b) => statusOrder[a.status] - statusOrder[b.status]
				);
			default:
				return sorted;
		}
	}, [analysis, sortBy]);

	if (!hasPriorities) {
		return (
			<Card className="p-6 text-center">
				<div className="flex flex-col items-center justify-center h-full py-12">
					<Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
					<h3 className="text-xl font-semibold mb-2">
						Set Your Physique Goals
					</h3>
					<p className="text-sm text-muted-foreground mb-6 max-w-sm">
						Define your muscle priorities to unlock personalized coaching and
						see how your routine stacks up against your goals.
					</p>
					<Button onClick={() => setShowSettings(true)}>
						<Settings className="h-4 w-4 mr-2" />
						Set Priorities
					</Button>
				</div>
				<PrioritySettings
					open={showSettings}
					onOpenChange={setShowSettings}
					priorities={priorities}
					onPrioritiesChange={onPrioritiesChange}
				/>
			</Card>
		);
	}

	const criticalIssues = analysis.filter((a) => a.status === "critical").length;
	const warnings = analysis.filter((a) => a.status === "warning").length;
	const optimalCount = analysis.filter((a) => a.status === "optimal").length;

	return (
		<div className="space-y-6">
			{/* Summary Alerts */}
			<div>
				{criticalIssues > 0 && (
					<Alert variant="destructive">
						<ShieldAlert className="h-4 w-4" />
						<AlertTitle>Critical Alert</AlertTitle>
						<AlertDescription>
							You have{" "}
							<span className="font-bold">
								{criticalIssues} critical issues
							</span>{" "}
							where high-priority muscles are severely undertrained or a muscle
							is exceeding its MRV.
						</AlertDescription>
					</Alert>
				)}
				{warnings > 0 && criticalIssues === 0 && (
					<Alert className="border-yellow-500/50 text-yellow-500 [&>svg]:text-yellow-500">
						<AlertTriangle className="h-4 w-4" />
						<AlertTitle>Suggestions for Improvement</AlertTitle>
						<AlertDescription>
							There are <span className="font-bold">{warnings} areas</span> to
							adjust for better alignment with your goals. Check the
							recommendations below.
						</AlertDescription>
					</Alert>
				)}
				{criticalIssues === 0 && warnings === 0 && (
					<Alert className="border-green-500/50 text-green-500 [&>svg]:text-green-500">
						<CheckCircle2 className="h-4 w-4" />
						<AlertTitle>Great Work!</AlertTitle>
						<AlertDescription>
							Your routine is well-aligned with your priorities. You have{" "}
							<span className="font-bold">{optimalCount} muscles</span> in their
							target growth zones.
						</AlertDescription>
					</Alert>
				)}
			</div>

			{/* Detailed Analysis Card */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-xl">
						<Target className="h-5 w-5" />
						Priority Analysis
					</CardTitle>
					<div className="flex items-center gap-2">
						<Select
							value={sortBy}
							onValueChange={(value) => setSortBy(value as SortOption)}
						>
							<SelectTrigger className="w-[180px] hidden md:flex">
								<SelectValue placeholder="Sort by..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="status">Sort by Status</SelectItem>
								<SelectItem value="priority">Sort by Priority</SelectItem>
								<SelectItem value="volume-high">
									Sort by Volume (High-Low)
								</SelectItem>
								<SelectItem value="volume-low">
									Sort by Volume (Low-High)
								</SelectItem>
							</SelectContent>
						</Select>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowSettings(true)}
						>
							<Settings className="h-4 w-4 md:mr-2" />
							<span className="hidden md:inline">Edit Priorities</span>
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{sortedAnalysis.map((item) => {
						const statusConfig = {
							optimal: { icon: CheckCircle2, color: "text-green-500" },
							good: { icon: TrendingUp, color: "text-sky-500" },
							warning: { icon: AlertTriangle, color: "text-yellow-500" },
							critical: { icon: ShieldAlert, color: "text-destructive" },
						}[item.status];
						const StatusIcon = statusConfig.icon;

						const currentPercent = (item.currentSets / item.displayMax) * 100;
						const targetMinPercent = (item.targetMin / item.displayMax) * 100;
						const targetWidthPercent =
							((item.targetMax - item.targetMin) / item.displayMax) * 100;

						return (
							<div
								key={`${item.tier}-${item.muscle}`}
								className="p-4 bg-secondary/50 rounded-lg border-l-4 space-y-3"
								style={{ borderLeftColor: TIER_COLORS[item.tier] }}
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex items-center gap-3">
										<Badge
											variant="outline"
											style={{
												borderColor: TIER_COLORS[item.tier],
												color: TIER_COLORS[item.tier],
											}}
										>
											{item.tier}-Tier
										</Badge>
										<span className="font-semibold text-lg">{item.muscle}</span>
									</div>
									<div className="text-sm font-mono text-muted-foreground">
										<span className="font-bold text-foreground">
											Current: {item.currentSets.toFixed(1)}
										</span>
										<span className="mx-2">|</span>
										<span title="Target Volume Range">
											Target: {item.targetMin}-{item.targetMax}
										</span>
									</div>
								</div>

								<div className="relative h-2 w-full bg-muted rounded-full">
									<div
										className="absolute top-0 h-full bg-green-500/30 rounded-full"
										style={{
											left: `${targetMinPercent}%`,
											width: `${targetWidthPercent}%`,
										}}
										title={`Target Zone: ${item.targetMin}-${item.targetMax} sets`}
									/>
									<div
										className="absolute top-0 h-full bg-white/20 border border-white/50 rounded-full"
										style={{ width: `${currentPercent}%` }}
									/>
								</div>

								<div
									className={`flex items-start gap-2 text-sm ${statusConfig.color}`}
								>
									<StatusIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
									<p>{item.recommendation}</p>
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>

			<PrioritySettings
				open={showSettings}
				onOpenChange={setShowSettings}
				priorities={priorities}
				onPrioritiesChange={onPrioritiesChange}
			/>
		</div>
	);
}
