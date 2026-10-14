"use client";

import { TierBadge, ToneBadge, VolumeBar } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import volumeLandmarks from "@/data/volume-landmarks.json";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { TIER_ORDER, TONE_CLASSES } from "@/lib/design";
import { useExercises } from "@/lib/exercise-context";
import { STATUS_TONE, type PriorityResult, type PriorityStatus } from "@/lib/priority-analysis";
import { buildSuggestions } from "@/lib/suggestions";
import type { Routine, VolumeLandmarks } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Lightbulb, Plus, SlidersHorizontal, Target } from "lucide-react";
import { useCallback, useMemo } from "react";

const LANDMARKS = volumeLandmarks as VolumeLandmarks;

interface PriorityAnalysisProps {
	routine: Routine;
	results: PriorityResult[];
	onEditPriorities: () => void;
	onAddExercise: (dayId: string, exerciseId: string, sets: number) => void;
}

type SortOption = "priority" | "volume-high" | "volume-low" | "status";
const SORT_STORAGE_KEY = "priorityAnalysisSortOption";
const STATUS_ORDER: Record<PriorityStatus, number> = { critical: 0, warning: 1, good: 2, optimal: 3 };
const STATUS_LABEL: Record<PriorityStatus, string> = {
	critical: "Needs work",
	warning: "Off target",
	good: "On track",
	optimal: "On target",
};

export function PriorityAnalysis({ routine, results, onEditPriorities, onAddExercise }: PriorityAnalysisProps) {
	const { exercises, getExercise } = useExercises();
	const save = useCallback((value: SortOption) => {
		try {
			window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(value));
		} catch {}
	}, []);
	const load = useCallback((): SortOption | null => {
		try {
			const item = window.localStorage.getItem(SORT_STORAGE_KEY);
			return item ? (JSON.parse(item) as SortOption) : null;
		} catch {
			return null;
		}
	}, []);
	const [sortBy, setSortBy] = usePersistedState<SortOption>(SORT_STORAGE_KEY, "status", save, load);

	const suggestions = useMemo(
		() => buildSuggestions(results, routine, exercises, getExercise),
		[results, routine, exercises, getExercise]
	);

	const sorted = useMemo(() => {
		const rows = [...results];
		switch (sortBy) {
			case "priority":
				return rows.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
			case "volume-high":
				return rows.sort((a, b) => b.currentSets - a.currentSets);
			case "volume-low":
				return rows.sort((a, b) => a.currentSets - b.currentSets);
			default:
				return rows.sort(
					(a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
				);
		}
	}, [results, sortBy]);

	if (results.length === 0) {
		return (
			<Card className="items-center gap-3 p-8 text-center">
				<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-brand-text">
					<Target className="h-6 w-6" />
				</div>
				<h3 className="text-lg font-semibold">Rank your muscles</h3>
				<p className="max-w-sm text-sm text-muted-foreground">
					Put muscles into tiers from S (most important) to F. Setsmith then checks every one against the volume its tier
					calls for and suggests what to add.
				</p>
				<Button onClick={onEditPriorities} className="mt-2">
					Set priorities
				</Button>
			</Card>
		);
	}

	const needWork = results.filter((r) => r.status === "critical").length;
	const offTarget = results.filter((r) => r.status === "warning").length;
	const onTarget = results.length - needWork - offTarget;
	const days = new Map(routine.days.map((d) => [d.id, d.name]));

	return (
		<div className="space-y-4">
			<SummaryBanner needWork={needWork} offTarget={offTarget} onTarget={onTarget} />

			{suggestions.length > 0 && (
				<Card className="gap-3 p-4 sm:p-5">
					<div className="flex items-center gap-2">
						<Lightbulb className="h-4 w-4 text-brand-text" />
						<h3 className="font-semibold">Suggestions</h3>
					</div>
					<ul className="divide-y divide-border">
						{suggestions.map((s) => {
							const best = s.exercises[0];
							return (
								<li key={s.muscle} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
									{best.thumbnailUrl ? (
										<img src={best.thumbnailUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md bg-white object-contain" />
									) : (
										<div className="h-10 w-10 shrink-0 rounded-md bg-muted" />
									)}
									<div className="min-w-0 flex-1">
										<p className="flex items-center gap-1.5 text-sm font-medium">
											<TierBadge tier={s.result.tier} />
											{s.muscle}
											<span className="tabular font-normal text-muted-foreground">
												+{Math.round(s.result.setsToTarget)} set{Math.round(s.result.setsToTarget) === 1 ? "" : "s"}
											</span>
										</p>
										<p className="truncate text-xs text-muted-foreground">
											{s.sets} × {best.name}
											{s.dayId && ` on ${days.get(s.dayId)}`}
										</p>
									</div>
									{s.dayId && (
										<Button size="sm" variant="secondary" onClick={() => onAddExercise(s.dayId!, best.id, s.sets)}>
											<Plus className="h-4 w-4" />
											Add
										</Button>
									)}
								</li>
							);
						})}
					</ul>
				</Card>
			)}

			<Card className="gap-4 p-4 sm:p-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="font-semibold">Your priorities</h3>
						<p className="text-xs text-muted-foreground">Each muscle against the range its tier calls for</p>
						<button
							type="button"
							onClick={onEditPriorities}
							className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-text hover:underline"
						>
							<SlidersHorizontal className="h-3.5 w-3.5" />
							Edit priorities
						</button>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
							<SelectTrigger size="sm" className="w-[120px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="status">Status</SelectItem>
								<SelectItem value="priority">Tier</SelectItem>
								<SelectItem value="volume-high">Most volume</SelectItem>
								<SelectItem value="volume-low">Least volume</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<ul className="space-y-4">
					{sorted.map((item) => {
						const tone = STATUS_TONE[item.status];
						return (
							<li key={item.muscle} className="space-y-2">
								<div className="flex items-center gap-2">
									<TierBadge tier={item.tier} />
									<span className="truncate text-sm font-medium">{item.muscle}</span>
									<ToneBadge tone={tone} className="ml-auto shrink-0">
										{STATUS_LABEL[item.status]}
									</ToneBadge>
									<span className="tabular w-[5.5rem] shrink-0 text-right text-xs text-muted-foreground">
										<span className="text-sm font-semibold text-foreground">{item.currentSets.toFixed(1)}</span> / {item.targetMin}–
										{item.targetMax}
									</span>
								</div>
								<VolumeBar
									sets={item.currentSets}
									landmarks={LANDMARKS[item.muscle]}
									tone={tone}
									target={[item.targetMin, item.targetMax]}
								/>
								<p className={cn("text-xs", item.status === "critical" ? TONE_CLASSES[tone].text : "text-muted-foreground")}>
									{item.recommendation}
								</p>
							</li>
						);
					})}
				</ul>
			</Card>
		</div>
	);
}

function SummaryBanner({ needWork, offTarget, onTarget }: { needWork: number; offTarget: number; onTarget: number }) {
	const tone = needWork > 0 ? "under" : offTarget > 0 ? "maintain" : "optimal";
	const t = TONE_CLASSES[tone];
	const text =
		needWork > 0
			? `${needWork} high-priority muscle${needWork > 1 ? "s need" : " needs"} more work${offTarget ? `, and ${offTarget} more ${offTarget > 1 ? "are" : "is"} off target` : ""}.`
			: offTarget > 0
				? `${offTarget} muscle${offTarget > 1 ? "s are" : " is"} off target. Small changes will line them up.`
				: `All ${onTarget} prioritised muscles are on target.`;
	return (
		<div className={cn("flex items-start gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset", t.soft, t.ring)}>
			{tone === "optimal" ? (
				<CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", t.text)} />
			) : (
				<Target className={cn("mt-0.5 h-4 w-4 shrink-0", t.text)} />
			)}
			<p>
				<span className="tabular font-semibold">{onTarget}</span> on target. {text}
			</p>
		</div>
	);
}
