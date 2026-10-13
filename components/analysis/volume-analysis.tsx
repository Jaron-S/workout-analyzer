"use client";

import { TierBadge, VolumeBar, VolumeLegend, ZoneBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import volumeLandmarks from "@/data/volume-landmarks.json";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { TIER_ORDER, ZONES } from "@/lib/design";
import { tierOf } from "@/lib/priority-analysis";
import type { MuscleVolume, PriorityTier, VolumeLandmarks } from "@/lib/types";
import { getVolumeZone } from "@/lib/volume-calculator";
import { useCallback, useMemo } from "react";

const LANDMARKS = volumeLandmarks as VolumeLandmarks;

interface VolumeAnalysisProps {
	muscleVolumes: MuscleVolume[];
	priorities: Partial<Record<PriorityTier, string[]>>;
	onMuscleHover?: (muscle: string | null) => void;
}

type SortOption = "volume-high" | "volume-low" | "alphabetical" | "priority";
const SORT_STORAGE_KEY = "volumeSortOption";

export function VolumeAnalysis({ muscleVolumes, priorities, onMuscleHover }: VolumeAnalysisProps) {
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
	const [sortBy, setSortBy] = usePersistedState<SortOption>(SORT_STORAGE_KEY, "volume-high", save, load);
	const hasPriorities = Object.values(priorities).some((m) => m?.length);

	const rows = useMemo(() => {
		const rank = (m: string) => {
			const t = tierOf(priorities, m);
			return t ? TIER_ORDER.indexOf(t) : TIER_ORDER.length;
		};
		return muscleVolumes
			.filter((mv) => LANDMARKS[mv.muscle] && mv.totalSets > 0)
			.sort((a, b) => {
				switch (sortBy) {
					case "volume-low":
						return a.totalSets - b.totalSets;
					case "alphabetical":
						return a.muscle.localeCompare(b.muscle);
					case "priority":
						return rank(a.muscle) - rank(b.muscle) || b.totalSets - a.totalSets;
					default:
						return b.totalSets - a.totalSets;
				}
			});
	}, [muscleVolumes, sortBy, priorities]);

	const untrained = muscleVolumes.filter((mv) => LANDMARKS[mv.muscle] && mv.totalSets === 0).map((mv) => mv.muscle);

	return (
		<Card className="gap-4 p-4 sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="font-semibold">Weekly volume</h3>
					<p className="text-xs text-muted-foreground">Sets per muscle against its volume landmarks</p>
				</div>
				<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
					<SelectTrigger size="sm" className="w-[148px] shrink-0">
						<SelectValue />
					</SelectTrigger>
					<SelectContent align="end">
						<SelectItem value="volume-high">Most volume</SelectItem>
						<SelectItem value="volume-low">Least volume</SelectItem>
						<SelectItem value="alphabetical">A to Z</SelectItem>
						{hasPriorities && <SelectItem value="priority">Priority</SelectItem>}
					</SelectContent>
				</Select>
			</div>

			<VolumeLegend />

			<ul className="space-y-4">
				{rows.map((mv) => {
					const zone = getVolumeZone(mv.totalSets, LANDMARKS, mv.muscle);
					const tier = tierOf(priorities, mv.muscle);
					return (
						<li
							key={mv.muscle}
							className="space-y-2"
							onMouseEnter={() => onMuscleHover?.(mv.muscle)}
							onMouseLeave={() => onMuscleHover?.(null)}
						>
							<div className="flex items-center gap-2">
								<span className="truncate text-sm font-medium">{mv.muscle}</span>
								{tier && <TierBadge tier={tier} />}
								<ZoneBadge zone={zone} className="ml-auto shrink-0" />
								<span className="tabular w-[4.5rem] shrink-0 text-right text-sm font-semibold">
									{mv.totalSets.toFixed(1)}
									<span className="ml-1 text-xs font-normal text-muted-foreground">sets</span>
								</span>
							</div>
							<VolumeBar sets={mv.totalSets} landmarks={LANDMARKS[mv.muscle]} tone={ZONES[zone].tone} />
						</li>
					);
				})}
			</ul>

			{untrained.length > 0 && (
				<p className="text-xs text-muted-foreground">
					<span className="font-medium text-foreground">Not trained: </span>
					{untrained.join(", ")}
				</p>
			)}
		</Card>
	);
}
