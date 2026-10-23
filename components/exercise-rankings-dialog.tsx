"use client";

import { Thumb } from "@/components/exercise-card";
import { ExerciseInfoDialog } from "@/components/exercise-info-dialog";
import { ExerciseTierBadge } from "@/components/status";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_MUSCLES } from "@/lib/constants";
import { useExercises } from "@/lib/exercise-context";
import {
	describeOpinions,
	EXERCISE_TIERS,
	namedDifferently,
	sourceOf,
	type ExerciseRank,
	type ExerciseTier,
	type RankingEntry,
} from "@/lib/exercise-rankings";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Ban, Heart } from "lucide-react";
import { useMemo, useState } from "react";

interface ExerciseRankingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const YOURS = "Yours";

type Row = { key: string; tier: ExerciseTier; id?: string; exercise?: Exercise; entry: RankingEntry; rank?: ExerciseRank };

/** The tier lists by muscle, where the user marks favourites and exercises to avoid. */
export function ExerciseRankingsDialog({ open, onOpenChange }: ExerciseRankingsDialogProps) {
	const { rankings, preferences, getExercise } = useExercises();
	const muscles = useMemo(() => ALL_MUSCLES.filter((m) => rankings.muscles.includes(m)), [rankings]);
	const [muscle, setMuscle] = useState<string>(muscles[0] ?? YOURS);
	const [info, setInfo] = useState<Exercise | null>(null);

	// One row per exercise at its tier for this muscle, plus entries Hevy lacks.
	const rows = useMemo(() => {
		if (muscle === YOURS) return [];
		return rankings
			.listFor(muscle)
			.map((row): Row => ({ ...row, key: row.id ?? `${sourceOf(row.entry)} ${row.entry.name}`, exercise: row.id ? getExercise(row.id) : undefined }))
			.filter((row) => !row.id || row.exercise);
	}, [muscle, rankings, getExercise]);

	const yours = useMemo(
		() =>
			(["favourite", "avoid"] as const).map((pref) => ({
				pref,
				exercises: Object.entries(preferences)
					.filter(([, p]) => p.pref === pref)
					.map(([id]) => getExercise(id))
					.filter((e): e is Exercise => Boolean(e)),
			})),
		[preferences, getExercise]
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(760px,88vh)] flex-col gap-0 p-0 sm:max-w-2xl max-sm:h-[92dvh]">
				<DialogHeader className="space-y-3 border-b p-4 pb-3 text-left sm:p-5 sm:pb-4">
					<div>
						<DialogTitle>Exercise rankings</DialogTitle>
						<DialogDescription className="text-xs">
							Tier lists from Jeff Nippard, Jeremy Ethier and Mike Israetel / Milo Wolf, averaged where they overlap and
							matched to Hevy. Favourites are suggested first; avoided exercises never are, and Claude steers clear of them.
						</DialogDescription>
					</div>
					<div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-5 sm:px-5">
						{[YOURS, ...muscles].map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setMuscle(m)}
								className={cn(
									"shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
									muscle === m ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
								)}
							>
								{m}
							</button>
						))}
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-2 sm:p-3">
					{muscle === YOURS ? (
						yours.every((g) => g.exercises.length === 0) ? (
							<p className="mx-auto max-w-sm py-12 text-center text-sm text-muted-foreground">
								Nothing yet. Tap the heart or the ban icon on any exercise, here or in your routine&apos;s exercise menu.
							</p>
						) : (
							yours.map(
								(g) =>
									g.exercises.length > 0 && (
										<section key={g.pref} className="mb-3">
											<h3 className="px-2 pb-1.5 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
												{g.pref === "favourite" ? "Favourites" : "Avoided"}
											</h3>
											{g.exercises.map((e) => (
												<RankRow
													key={e.id}
													exercise={e}
													subtitle={preferences[e.id]?.note}
													tier={rankings.best(e.id)?.tier}
													onInfo={() => setInfo(e)}
												/>
											))}
										</section>
									)
							)
						)
					) : (
						EXERCISE_TIERS.map((tier) => {
							const inTier = rows.filter((r) => r.tier === tier);
							if (inTier.length === 0) return null;
							return (
								<section key={tier} className="mb-2">
									<h3 className="flex items-center gap-2 px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										<ExerciseTierBadge tier={tier} />
										{tier === "S+" ? "Best of the best" : `${tier} tier`}
									</h3>
									{inTier.map((r) =>
										r.exercise ? (
											<RankRow
												key={r.key}
												exercise={r.exercise}
												subtitle={[
													r.rank && r.rank.opinions.length > 1 ? describeOpinions(r.rank) : "",
													r.rank?.better.length ? `${r.rank.better[0].name} is ${r.rank.better[0].tier}` : "",
													namedDifferently(r.entry, r.exercise.name) ? `Ranked as ${r.entry.name}` : "",
													r.entry.note ?? "",
												]
													.filter(Boolean)
													.join(" · ")}
												onInfo={() => setInfo(r.exercise!)}
											/>
										) : (
											<div key={r.key} className="flex items-center gap-3 rounded-xl p-2 opacity-60">
												<div className="h-10 w-10 shrink-0 rounded-lg border border-dashed" />
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium">{r.entry.name}</p>
													<p className="truncate text-xs text-muted-foreground">
														Not in Hevy. Create it as a custom exercise with this name and it links up.
													</p>
												</div>
											</div>
										)
									)}
								</section>
							);
						})
					)}
				</div>
				<ExerciseInfoDialog exercise={info} open={info !== null} onOpenChange={(o) => !o && setInfo(null)} />
			</DialogContent>
		</Dialog>
	);
}

function RankRow({
	exercise,
	subtitle,
	tier,
	onInfo,
}: {
	exercise: Exercise;
	subtitle?: string;
	tier?: ExerciseTier;
	onInfo: () => void;
}) {
	const { preferences, setPreference } = useExercises();
	const pref = preferences[exercise.id]?.pref;
	const toggle = (next: "favourite" | "avoid") => setPreference(exercise.id, pref === next ? null : { pref: next });
	return (
		<div className={cn("flex items-center gap-1 rounded-xl transition-colors hover:bg-accent", pref === "avoid" && "[&>button:first-child]:opacity-55")}>
			<button type="button" onClick={onInfo} className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left focus-visible:outline-none">
				<Thumb exercise={exercise} />
				<div className="min-w-0 flex-1">
					<p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
						{tier && <ExerciseTierBadge tier={tier} className="h-4 min-w-4 text-[10px]" />}
						<span className="truncate">{exercise.name}</span>
					</p>
					{subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
				</div>
			</button>
			<button
				type="button"
				onClick={() => toggle("favourite")}
				aria-pressed={pref === "favourite"}
				aria-label={`Favourite ${exercise.name}`}
				className={cn(
					"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-brand-text",
					pref === "favourite" && "text-brand-text"
				)}
			>
				<Heart className={cn("h-4 w-4", pref === "favourite" && "fill-current")} />
			</button>
			<button
				type="button"
				onClick={() => toggle("avoid")}
				aria-pressed={pref === "avoid"}
				aria-label={`Avoid ${exercise.name}`}
				className={cn(
					"mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-status-under",
					pref === "avoid" && "bg-status-under/10 text-status-under"
				)}
			>
				<Ban className="h-4 w-4" />
			</button>
		</div>
	);
}
