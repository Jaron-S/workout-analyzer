// Shared visual vocabulary: every view shows volume status and priority tiers
// the same way. Class names are spelled out in full so Tailwind can see them.

import type { PriorityTier } from "./types";
import type { getVolumeZone } from "./volume-calculator";

export type VolumeZone = ReturnType<typeof getVolumeZone>;
export type Tone = "under" | "maintain" | "growing" | "optimal" | "high" | "over";

export const TONE_CLASSES: Record<
	Tone,
	{ text: string; fill: string; soft: string; ring: string; glass: string; edge: string }
> = {
	under: { text: "text-status-under", fill: "bg-status-under", soft: "bg-status-under/12", ring: "ring-status-under/35", glass: "bg-status-under/25 dark:bg-status-under/18", edge: "border-status-under" },
	maintain: { text: "text-status-maintain", fill: "bg-status-maintain", soft: "bg-status-maintain/12", ring: "ring-status-maintain/35", glass: "bg-status-maintain/25 dark:bg-status-maintain/18", edge: "border-status-maintain" },
	growing: { text: "text-status-growing", fill: "bg-status-growing", soft: "bg-status-growing/12", ring: "ring-status-growing/35", glass: "bg-status-growing/25 dark:bg-status-growing/18", edge: "border-status-growing" },
	optimal: { text: "text-status-optimal", fill: "bg-status-optimal", soft: "bg-status-optimal/12", ring: "ring-status-optimal/35", glass: "bg-status-optimal/25 dark:bg-status-optimal/18", edge: "border-status-optimal" },
	high: { text: "text-status-high", fill: "bg-status-high", soft: "bg-status-high/12", ring: "ring-status-high/35", glass: "bg-status-high/25 dark:bg-status-high/18", edge: "border-status-high" },
	over: { text: "text-status-over", fill: "bg-status-over", soft: "bg-status-over/12", ring: "ring-status-over/35", glass: "bg-status-over/25 dark:bg-status-over/18", edge: "border-status-over" },
};

/** CSS custom property for each tone, for SVG fills. */
export const TONE_VAR: Record<Tone, string> = {
	under: "var(--status-under)",
	maintain: "var(--status-maintain)",
	growing: "var(--status-growing)",
	optimal: "var(--status-optimal)",
	high: "var(--status-high)",
	over: "var(--status-over)",
};

export const ZONES: Record<VolumeZone, { tone: Tone; label: string; description: string }> = {
	"below-mv": { tone: "under", label: "Under", description: "Below maintenance volume (MV)" },
	"mv-mev": { tone: "maintain", label: "Maintenance", description: "Enough to keep, not to grow (MV to MEV)" },
	"mev-mav": { tone: "growing", label: "Growing", description: "Growing, below the sweet spot (MEV to MAV)" },
	mav: { tone: "optimal", label: "Optimal", description: "In the sweet spot for growth (MAV)" },
	"mav-mrv": { tone: "high", label: "High", description: "Above MAV, nearing what you can recover from (MRV)" },
	"above-mrv": { tone: "over", label: "Over MRV", description: "More than you can recover from (above MRV)" },
};

export const TIER_ORDER: PriorityTier[] = ["S", "A", "B", "C", "D", "F"];

/** S is solid amber and each tier below steps down toward plain slate. */
export const TIER_CLASSES: Record<PriorityTier, string> = {
	S: "bg-primary text-primary-foreground",
	A: "bg-primary/25 text-brand-text",
	B: "bg-primary/10 text-brand-text ring-1 ring-inset ring-primary/30",
	C: "bg-muted text-foreground",
	D: "bg-muted text-muted-foreground",
	F: "text-muted-foreground ring-1 ring-inset ring-border",
};
