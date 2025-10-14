"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import volumeLandmarks from "@/data/volume-landmarks.json";
import { usePersistedState } from "@/hooks/use-persisted-state";
import type { MuscleVolume, PriorityTier } from "@/lib/types";
import { getVolumeZone } from "@/lib/volume-calculator";
import {
	AlertTriangle,
	CheckCircle2,
	Flame,
	Info,
	PauseCircle,
	ShieldAlert,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useCallback, useMemo } from "react";

// --- PROPS ---
interface VolumeAnalysisProps {
	muscleVolumes: MuscleVolume[];
	priorities?: Partial<Record<PriorityTier, string[]>>;
}

// --- CONFIG & UTILS ---
const ZONE_CONFIG = {
	"below-mv": {
		label: "Below MV",
		color: "bg-destructive",
		textColor: "text-destructive",
		icon: TrendingDown,
	},
	"mv-mev": {
		label: "MV-MEV",
		color: "bg-yellow-500",
		textColor: "text-yellow-500",
		icon: PauseCircle,
	},
	"mev-mav": {
		label: "MEV-MAV",
		color: "bg-green-500",
		textColor: "text-green-500",
		icon: TrendingUp,
	},
	mav: {
		label: "MAV (Optimal)",
		color: "bg-sky-500",
		textColor: "text-sky-500",
		icon: CheckCircle2,
	},
	"mav-mrv": {
		label: "MAV-MRV",
		color: "bg-orange-500",
		textColor: "text-orange-500",
		icon: Flame,
	},
	"above-mrv": {
		label: "Above MRV",
		color: "bg-destructive",
		textColor: "text-destructive",
		icon: ShieldAlert,
	},
};

const TIER_COLORS: Record<PriorityTier, string> = {
	S: "#ff7f7f", // Red
	A: "#ffbf7f", // Orange
	B: "#ffff7f", // Yellow
	C: "#7fff7f", // Green
	D: "#7fbfff", // Blue
	F: "#bfbfbf", // Gray
};

type SortOption = "volume-high" | "volume-low" | "alphabetical" | "priority";
const SORT_STORAGE_KEY = "volumeSortOption";

// --- COMPONENT ---
export function VolumeAnalysis({
	muscleVolumes,
	priorities,
}: VolumeAnalysisProps) {
	// 2. Define helper functions for saving and loading
	const saveSortOption = useCallback((value: SortOption) => {
		try {
			window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(value));
		} catch (error) {
			console.error("Error saving to localStorage", error);
		}
	}, []);

	const loadSortOption = useCallback((): SortOption | null => {
		try {
			const item = window.localStorage.getItem(SORT_STORAGE_KEY);
			return item ? (JSON.parse(item) as SortOption) : null;
		} catch (error) {
			console.error("Error loading from localStorage", error);
			return null;
		}
	}, []);

	// 3. Use the persisted state hook
	const [sortBy, setSortBy] = usePersistedState<SortOption>(
		SORT_STORAGE_KEY,
		"volume-high",
		saveSortOption,
		loadSortOption
	);

	const priorityMap = useMemo(() => {
		const map = new Map<string, PriorityTier>();
		if (priorities) {
			(Object.keys(priorities) as PriorityTier[]).forEach((tier) => {
				priorities[tier]?.forEach((muscle) => map.set(muscle, tier));
			});
		}
		return map;
	}, [priorities]);

	const sortedVolumes = useMemo(() => {
		return [...muscleVolumes].sort((a, b) => {
			switch (sortBy) {
				case "volume-high":
					return b.totalSets - a.totalSets;
				case "volume-low":
					return a.totalSets - b.totalSets;
				case "alphabetical":
					return a.muscle.localeCompare(b.muscle);
				case "priority": {
					const tierOrder: Record<PriorityTier, number> = {
						S: 0,
						A: 1,
						B: 2,
						C: 3,
						D: 4,
						F: 5,
					};
					const aTier = priorityMap.get(a.muscle);
					const bTier = priorityMap.get(b.muscle);
					if (!aTier && !bTier) return 0;
					if (!aTier) return 1;
					if (!bTier) return -1;
					return tierOrder[aTier] - tierOrder[bTier];
				}
				default:
					return 0;
			}
		});
	}, [muscleVolumes, sortBy, priorityMap]);

	const summary = useMemo(() => {
		let optimal = 0,
			growth = 0,
			needsAttention = 0;
		muscleVolumes.forEach((mv) => {
			const landmarks =
				volumeLandmarks[mv.muscle as keyof typeof volumeLandmarks];
			if (!landmarks || mv.totalSets === 0) return;
			const zone = getVolumeZone(mv.totalSets, volumeLandmarks, mv.muscle);
			if (zone === "mav") optimal++;
			else if (zone === "mev-mav" || zone === "mav-mrv") growth++;
			else if (zone === "below-mv" || zone === "above-mrv") needsAttention++;
		});
		return { optimal, growth, needsAttention };
	}, [muscleVolumes]);

	return (
		<div className="space-y-6">
			{/* At-a-Glance Summary */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Optimal Zone</CardTitle>
						<CheckCircle2 className="h-4 w-4 text-sky-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{summary.optimal}</div>
						<p className="text-xs text-muted-foreground">
							Muscles in the MAV sweet spot
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Growth Zone</CardTitle>
						<TrendingUp className="h-4 w-4 text-green-500" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{summary.growth}</div>
						<p className="text-xs text-muted-foreground">
							Muscles receiving growth stimulus
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Needs Attention
						</CardTitle>
						<AlertTriangle className="h-4 w-4 text-destructive" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{summary.needsAttention}</div>
						<p className="text-xs text-muted-foreground">
							Muscles undertrained or overtrained
						</p>
					</CardContent>
				</Card>
			</div>

			{/* --- Radar Chart and related data processing removed --- */}

			{/* Detailed Volume List */}
			<Card className="p-6">
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-2">
						<h3 className="font-semibold text-lg">
							Weekly Muscle Group Volume
						</h3>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Info className="h-4 w-4 text-muted-foreground cursor-help" />
								</TooltipTrigger>
								<TooltipContent className="max-w-xs">
									<p className="text-sm">
										Compare your training volume against scientific landmarks
										(MV, MEV, MAV, MRV) to ensure effective programming.
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<Select
						value={sortBy}
						onValueChange={(value) => setSortBy(value as SortOption)}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="volume-high">Volume: High to Low</SelectItem>
							<SelectItem value="volume-low">Volume: Low to High</SelectItem>
							<SelectItem value="alphabetical">Alphabetical</SelectItem>
							{priorities && priorityMap.size > 0 && (
								<SelectItem value="priority">Priority</SelectItem>
							)}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-6">
					{sortedVolumes.map((mv) => {
						const landmarks =
							volumeLandmarks[mv.muscle as keyof typeof volumeLandmarks];
						if (!landmarks || mv.totalSets === 0) return null;

						const zone = getVolumeZone(
							mv.totalSets,
							volumeLandmarks,
							mv.muscle
						);
						const zoneConfig = ZONE_CONFIG[zone];
						const Icon = zoneConfig.icon;
						const priority = priorityMap.get(mv.muscle);

						const maxValue = landmarks.mrv * 1.25;
						const mvPercent = (landmarks.mv / maxValue) * 100,
							mevPercent = (landmarks.mev / maxValue) * 100;
						const mavMinPercent = (landmarks.mav_min / maxValue) * 100,
							mavMaxPercent = (landmarks.mav_max / maxValue) * 100;
						const mrvPercent = (landmarks.mrv / maxValue) * 100;
						const currentPercent = (mv.totalSets / maxValue) * 100;

						return (
							<div key={mv.muscle}>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<span className="font-semibold text-base">{mv.muscle}</span>
										{priority && (
											<Badge
												variant="outline"
												style={{
													borderColor: TIER_COLORS[priority],
													color: TIER_COLORS[priority],
												}}
											>
												{priority}-Tier
											</Badge>
										)}
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="secondary" className={zoneConfig.textColor}>
											<Icon className="h-3 w-3 mr-1" />
											{zoneConfig.label}
										</Badge>
										<span className="text-sm font-mono font-bold">
											{mv.totalSets.toFixed(1)} sets
										</span>
									</div>
								</div>

								<div className="relative h-4 bg-secondary rounded-md overflow-hidden">
									<div className="absolute inset-0 flex">
										<div
											style={{ width: `${mvPercent}%` }}
											className="bg-destructive/20"
										/>
										<div
											style={{ width: `${mevPercent - mvPercent}%` }}
											className="bg-yellow-500/20"
										/>
										<div
											style={{ width: `${mavMinPercent - mevPercent}%` }}
											className="bg-green-500/20"
										/>
										<div
											style={{ width: `${mavMaxPercent - mavMinPercent}%` }}
											className="bg-sky-500/30"
										/>
										<div
											style={{ width: `${mrvPercent - mavMaxPercent}%` }}
											className="bg-orange-500/20"
										/>
										<div
											style={{ width: `${100 - mrvPercent}%` }}
											className="bg-destructive/20"
										/>
									</div>
									<div
										className="absolute top-0 bottom-0 bg-white/40 border-r border-white/50 transition-all"
										style={{ width: `${Math.min(currentPercent, 100)}%` }}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</Card>
		</div>
	);
}
