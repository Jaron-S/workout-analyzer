"use client";

import { Thumb } from "@/components/exercise-card";
import { TierBadge } from "@/components/status";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_MUSCLES } from "@/lib/constants";
import { useExercises } from "@/lib/exercise-context";
import { searchExercises } from "@/lib/search";
import type { Suggestion } from "@/lib/suggestions";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

interface ExerciseLibraryModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelectExercise: (exerciseId: string) => void;
	title?: string;
	/** Exercises for muscles short of their priority target, shown first. */
	suggestions?: Suggestion[];
}

const ALL_EQUIPMENT = "all";

const formatEquipment = (equipment: string) =>
	equipment === "none" ? "Bodyweight" : equipment.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function ExerciseLibraryModal({ open, onOpenChange, onSelectExercise, title, suggestions = [] }: ExerciseLibraryModalProps) {
	const { exercises } = useExercises();
	const [query, setQuery] = useState("");
	const [muscle, setMuscle] = useState<string | null>(null);
	const [equipment, setEquipment] = useState(ALL_EQUIPMENT);

	const allEquipment = useMemo(
		() => Array.from(new Set(exercises.flatMap((ex) => (ex.equipment ? [ex.equipment] : [])))).sort(),
		[exercises]
	);

	const filtered = useMemo(
		() =>
			searchExercises(exercises, query).filter(
				(ex) =>
					// Legacy exercises only exist so old routines keep working.
					!ex.legacy &&
					// Main muscle only, so "Chest" doesn't list every triceps exercise.
					(!muscle || ex.muscle_weightings[0]?.muscle === muscle) &&
					(equipment === ALL_EQUIPMENT || ex.equipment === equipment)
			),
		[exercises, query, muscle, equipment]
	);

	const browsing = !query && !muscle && equipment === ALL_EQUIPMENT;

	const select = (id: string) => {
		onSelectExercise(id);
		onOpenChange(false);
		setQuery("");
		setMuscle(null);
		setEquipment(ALL_EQUIPMENT);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(720px,88vh)] flex-col gap-0 p-0 sm:max-w-2xl max-sm:h-[92dvh] max-sm:p-0">
				<DialogHeader className="space-y-3 border-b p-4 pb-3 text-left sm:p-5 sm:pb-4">
					<div>
						<DialogTitle>{title ?? "Add exercise"}</DialogTitle>
						<DialogDescription className="text-xs">
							{exercises.filter((e) => !e.legacy).length} exercises from the Hevy library
						</DialogDescription>
					</div>
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search exercises"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								className="pl-9"
								autoFocus={false}
							/>
						</div>
						<Select value={equipment} onValueChange={setEquipment}>
							<SelectTrigger className="w-[9.5rem] shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL_EQUIPMENT}>Any equipment</SelectItem>
								{allEquipment.map((e) => (
									<SelectItem key={e} value={e}>
										{formatEquipment(e)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:-mx-5 sm:px-5">
						{[null, ...ALL_MUSCLES].map((m) => (
							<button
								key={m ?? "all"}
								type="button"
								onClick={() => setMuscle(m)}
								className={cn(
									"shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
									muscle === m ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
								)}
							>
								{m ?? "All"}
							</button>
						))}
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto p-2 sm:p-3">
					{browsing && suggestions.length > 0 && (
						<section className="mb-3">
							<h3 className="px-2 pb-1.5 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Suggested for your priorities
							</h3>
							{suggestions.map((s) =>
								s.exercises.slice(0, 2).map((ex) => (
									<ExerciseOption
										key={`${s.muscle}-${ex.id}`}
										exercise={ex}
										onSelect={select}
										note={
											<span className="flex items-center gap-1">
												<TierBadge tier={s.result.tier} className="h-4 min-w-4 px-1 text-[10px]" />
												{s.muscle} needs ~{Math.round(s.result.setsToTarget)} more set{Math.round(s.result.setsToTarget) === 1 ? "" : "s"}
											</span>
										}
									/>
								))
							)}
							<h3 className="px-2 pb-1.5 pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								All exercises
							</h3>
						</section>
					)}
					{filtered.map((ex) => (
						<ExerciseOption key={ex.id} exercise={ex} onSelect={select} />
					))}
					{filtered.length === 0 && (
						<p className="py-12 text-center text-sm text-muted-foreground">No exercises match. Try fewer words.</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ExerciseOption({
	exercise,
	onSelect,
	note,
}: {
	exercise: Exercise;
	onSelect: (id: string) => void;
	note?: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(exercise.id)}
			className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
		>
			<Thumb exercise={exercise} className="h-11 w-11" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">
					{exercise.name}
					{exercise.hevyCustom && <span className="ml-1.5 text-[11px] font-normal text-brand-text">Custom</span>}
				</p>
				<p className="truncate text-xs text-muted-foreground">
					{note ??
						(exercise.muscle_weightings
							.slice(0, 3)
							.map((w) => (w.weighting < 1 ? `${w.muscle} ${Math.round(w.weighting * 100)}%` : w.muscle))
							.join(" · ") ||
							"No muscle volume")}
				</p>
			</div>
		</button>
	);
}
