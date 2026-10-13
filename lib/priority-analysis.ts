// How each prioritised muscle's weekly volume compares with what its tier
// calls for. Shared by the Priorities view, suggestions and the body map.

import volumeLandmarks from "@/data/volume-landmarks.json";
import type { Tone, VolumeZone } from "./design";
import { TIER_ORDER } from "./design";
import type { MuscleVolume, PriorityTier, VolumeLandmarks } from "./types";
import { getVolumeZone } from "./volume-calculator";

const LANDMARKS = volumeLandmarks as VolumeLandmarks;

export type PriorityStatus = "optimal" | "good" | "warning" | "critical";

export interface PriorityResult {
	muscle: string;
	tier: PriorityTier;
	currentSets: number;
	zone: VolumeZone;
	status: PriorityStatus;
	recommendation: string;
	targetMin: number;
	targetMax: number;
	/** Sets to add to reach the target range (positive), or to remove (negative); 0 when in range. */
	setsToTarget: number;
}

export const STATUS_TONE: Record<PriorityStatus, Tone> = {
	optimal: "optimal",
	good: "growing",
	warning: "maintain",
	critical: "under",
};

// The range each tier aims for, in landmark terms.
const TIER_TARGET: Record<PriorityTier, [keyof VolumeLandmarks[string], keyof VolumeLandmarks[string]]> = {
	S: ["mav_min", "mav_max"],
	A: ["mav_min", "mav_max"],
	B: ["mev", "mav_max"],
	C: ["mv", "mev"],
	D: ["mv", "mev"],
	F: ["mv", "mev"],
};

export function tierOf(
	priorities: Partial<Record<PriorityTier, string[]>>,
	muscle: string
): PriorityTier | undefined {
	return TIER_ORDER.find((tier) => priorities[tier]?.includes(muscle));
}

export function analyzePriorities(
	muscleVolumes: MuscleVolume[],
	priorities: Partial<Record<PriorityTier, string[]>>
): PriorityResult[] {
	const results: PriorityResult[] = [];
	for (const tier of TIER_ORDER) {
		for (const muscle of priorities[tier] ?? []) {
			const landmarks = LANDMARKS[muscle];
			if (!landmarks) continue;
			const currentSets = muscleVolumes.find((mv) => mv.muscle === muscle)?.totalSets ?? 0;
			const zone = getVolumeZone(currentSets, LANDMARKS, muscle);
			const [minKey, maxKey] = TIER_TARGET[tier];
			const targetMin = landmarks[minKey];
			const targetMax = landmarks[maxKey];
			const setsToTarget =
				currentSets < targetMin ? targetMin - currentSets : currentSets > targetMax ? targetMax - currentSets : 0;
			const fmt = (n: number) => Math.abs(n).toFixed(1).replace(/\.0$/, "");

			let status: PriorityStatus = "good";
			let recommendation = "";
			if (zone === "above-mrv") {
				status = "critical";
				recommendation = `Above MRV (${landmarks.mrv} sets): more than you can recover from. Cut about ${fmt(currentSets - landmarks.mrv)} sets.`;
			} else if (tier === "F" && currentSets > landmarks.mv) {
				status = "warning";
				recommendation = `Getting ${fmt(currentSets)} sets of indirect work. If you want to minimise it, trim the lifts that hit it.`;
			} else if (tier === "S" || tier === "A") {
				if (zone === "mav") {
					status = "optimal";
					recommendation = "In the sweet spot for growth.";
				} else if (zone === "mev-mav" || zone === "mav-mrv") {
					status = "good";
					recommendation =
						zone === "mev-mav"
							? `Growing. About ${fmt(setsToTarget)} more sets reaches the sweet spot.`
							: "Productive, but above the sweet spot. Watch recovery.";
				} else {
					status = "critical";
					recommendation = `Top priority but under-trained. Add about ${fmt(setsToTarget)} sets.`;
				}
			} else if (tier === "B") {
				if (zone === "mev-mav" || zone === "mav" || zone === "mav-mrv") {
					status = "optimal";
					recommendation = "On target for steady progress.";
				} else {
					status = "warning";
					recommendation = `Below target. Add about ${fmt(setsToTarget)} sets for steady growth.`;
				}
			} else if (zone === "below-mv") {
				status = "warning";
				recommendation = "Below maintenance; you may lose some muscle here.";
			} else if (zone === "mv-mev") {
				status = "optimal";
				recommendation = "Right for this priority: maintained without stealing recovery.";
			} else if (zone === "mev-mav") {
				status = "good";
				recommendation = "A little more than this priority needs, but fine.";
			} else {
				status = "warning";
				recommendation = "Much more than this priority needs; it may cost recovery for your main goals.";
			}

			results.push({ muscle, tier, currentSets, zone, status, recommendation, targetMin, targetMax, setsToTarget });
		}
	}
	return results;
}
