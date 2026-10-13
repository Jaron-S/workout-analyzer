"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import priorityPresets from "@/data/priority-presets.json";
import { useAuth } from "@/lib/auth-context";
import { TIER_CLASSES, TIER_ORDER } from "@/lib/design";
import { getPrioritiesFromFirebase } from "@/lib/firebase-storage";
import type { PriorityTier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Priorities = Partial<Record<PriorityTier, string[]>>;

interface PrioritySettingsProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	priorities: Priorities;
	onPrioritiesChange: (priorities: Priorities) => void;
}

const GROUPS: [string, string[]][] = [
	["Push", ["Chest", "Front Delts", "Side Delts", "Triceps"]],
	["Pull", ["Lats", "Middle Back", "Rear Delts", "Traps", "Biceps", "Forearms"]],
	["Legs", ["Quads", "Hamstrings", "Glutes", "Calves", "Adductors", "Abductors"]],
	["Core and neck", ["Abs", "Lower Back", "Neck"]],
];

const TIER_HINT: Record<PriorityTier, string> = {
	S: "Top priority: aim for the MAV sweet spot",
	A: "High: aim for MAV",
	B: "Moderate: steady growth (MEV to MAV)",
	C: "Maintain: above MV",
	D: "Low: MV is fine",
	F: "Avoid: flag any direct work",
};

const tierOf = (p: Priorities, muscle: string) => TIER_ORDER.find((t) => p[t]?.includes(muscle));

function setTier(p: Priorities, muscle: string, tier: PriorityTier | undefined): Priorities {
	const next: Priorities = {};
	for (const t of TIER_ORDER) {
		const muscles = (p[t] ?? []).filter((m) => m !== muscle);
		if (t === tier) muscles.push(muscle);
		if (muscles.length) next[t] = muscles;
	}
	return next;
}

export function PrioritySettings({ open, onOpenChange, priorities, onPrioritiesChange }: PrioritySettingsProps) {
	const { user } = useAuth();
	const [local, setLocal] = useState<Priorities>(priorities);
	const [hint, setHint] = useState<PriorityTier | null>(null);

	// Start from the account's copy when signed in, so another device's edits show.
	useEffect(() => {
		if (!open) return;
		setLocal(priorities);
		if (user) {
			getPrioritiesFromFirebase(user.uid)
				.then((remote) => Object.keys(remote).length > 0 && setLocal(remote))
				.catch(() => {});
		}
	}, [open, user, priorities]);

	const ranked = TIER_ORDER.reduce((n, t) => n + (local[t]?.length ?? 0), 0);

	const save = () => {
		onPrioritiesChange(local);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-xl max-sm:p-0">
				<DialogHeader className="space-y-3 border-b p-4 text-left sm:p-5">
					<div>
						<DialogTitle>Muscle priorities</DialogTitle>
						<DialogDescription>
							Rank what matters to you. Setsmith checks each muscle against the volume its tier calls for.
						</DialogDescription>
					</div>
					<Select
						onValueChange={(id) => {
							const preset = priorityPresets.find((p) => p.id === id);
							if (preset) setLocal(preset.tiers as Priorities);
						}}
					>
						<SelectTrigger className="w-full sm:w-72">
							<SelectValue placeholder="Start from a preset…" />
						</SelectTrigger>
						<SelectContent>
							{priorityPresets.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
					{GROUPS.map(([group, muscles]) => (
						<section key={group} className="py-2">
							<h3 className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group}</h3>
							<ul className="divide-y divide-border">
								{muscles.map((muscle) => {
									const current = tierOf(local, muscle);
									return (
										<li key={muscle} className="flex items-center justify-between gap-3 py-2">
											<span className={cn("text-sm", !current && "text-muted-foreground")}>{muscle}</span>
											<div className="flex gap-1" role="radiogroup" aria-label={`${muscle} priority`}>
												{TIER_ORDER.map((tier) => {
													const selected = current === tier;
													return (
														<button
															key={tier}
															type="button"
															role="radio"
															aria-checked={selected}
															title={TIER_HINT[tier]}
															onMouseEnter={() => setHint(tier)}
															onMouseLeave={() => setHint(null)}
															onClick={() => setLocal((p) => setTier(p, muscle, selected ? undefined : tier))}
															className={cn(
																"h-8 w-8 rounded-lg text-xs font-bold transition",
																selected ? TIER_CLASSES[tier] : "text-muted-foreground hover:bg-muted"
															)}
														>
															{tier}
														</button>
													);
												})}
											</div>
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</div>

				<DialogFooter className="flex-row items-center justify-between gap-2 border-t p-4 sm:justify-between sm:p-5">
					<p className="text-xs text-muted-foreground">
						{hint ? TIER_HINT[hint] : `${ranked} ranked · tap a tier again to clear it`}
					</p>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button onClick={save}>Save</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
