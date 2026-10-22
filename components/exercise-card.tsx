"use client";

import { ExerciseInfoDialog } from "@/components/exercise-info-dialog";
import { ExerciseTargetsPopover } from "@/components/exercise-targets-popover";
import { MuscleWeightingsDialog } from "@/components/muscle-weightings-dialog";
import { ExerciseTierBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExercises } from "@/lib/exercise-context";
import type { ExerciseChange } from "@/lib/routine-diff";
import type { Exercise, RoutineExercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeftRight, Ban, GripVertical, Heart, Info, Minus, MoreHorizontal, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

const MAX_SETS = 10;

interface ExerciseCardProps {
	id: string;
	exercise: Exercise;
	routineExercise: RoutineExercise;
	/** Set while previewing Claude's draft. */
	change?: ExerciseChange;
	onChange: (patch: Partial<RoutineExercise>) => void;
	onReplace: () => void;
	onRemove: () => void;
}

export function Thumb({ exercise, className }: { exercise?: Exercise; className?: string }) {
	return exercise?.thumbnailUrl ? (
		<img
			src={exercise.thumbnailUrl}
			alt=""
			loading="lazy"
			className={cn("h-10 w-10 shrink-0 rounded-lg bg-white object-contain", className)}
		/>
	) : (
		<div className={cn("h-10 w-10 shrink-0 rounded-lg bg-muted", className)} />
	);
}

const musclesLine = (exercise: Exercise) =>
	exercise.muscle_weightings
		.filter((w) => w.weighting >= 0.4)
		.slice(0, 2)
		.map((w) => w.muscle)
		.join(" · ") || "No muscle volume";

export function ExerciseCard({ id, exercise, routineExercise, change, onChange, onReplace, onRemove }: ExerciseCardProps) {
	const [editingMuscles, setEditingMuscles] = useState(false);
	const [showInfo, setShowInfo] = useState(false);
	const { rankings, preferences, setPreference } = useExercises();
	const preference = preferences[exercise.id]?.pref;
	const primary = exercise.muscle_weightings[0]?.muscle;
	const rank = (primary && rankings.forMuscle(exercise.id, primary)) || rankings.best(exercise.id);
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
	const sets = routineExercise.sets;

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"group flex items-center gap-2 rounded-xl bg-surface p-1.5 pr-1 animate-in fade-in duration-300 @md:gap-3 @md:p-2",
				isDragging && "relative z-10 shadow-lg ring-1 ring-primary/40",
				change === "added" && "bg-status-optimal/8 ring-1 ring-inset ring-status-optimal/40",
				change === "changed" && "bg-status-growing/8 ring-1 ring-inset ring-status-growing/40"
			)}
		>
			<button
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				className="flex h-10 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
				aria-label={`Reorder ${exercise.name}`}
			>
				<GripVertical className="h-4 w-4" />
			</button>
			<Thumb exercise={exercise} />

			<div className="min-w-0 flex-1">
				<p className="line-clamp-2 text-sm font-medium leading-snug @md:line-clamp-1">
					{rank && (
						<ExerciseTierBadge tier={rank.tier} muscle={rank.muscle} className="mr-1.5 h-4 min-w-4 align-[1px] text-[10px]" />
					)}
					{exercise.name}
					{preference === "favourite" && (
						<Heart className="ml-1 inline h-3 w-3 fill-brand-text align-[-1px] text-brand-text" aria-label="Favourite" />
					)}
					{change && (
						<span className={cn("ml-1.5 text-[11px] font-semibold", change === "added" ? "text-status-optimal" : "text-status-growing")}>
							{change === "added" ? "New" : "Changed"}
						</span>
					)}
				</p>
				<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					<ExerciseTargetsPopover exercise={exercise} routineExercise={routineExercise} onChange={onChange} />
					<span className="hidden min-w-0 shrink-[999] truncate @sm:inline">· {musclesLine(exercise)}</span>
				</div>
				{(exercise.customWeightings || exercise.legacy || exercise.estimatedWeightings || preference === "avoid") && (
					<p className="mt-0.5 flex gap-2 text-[11px]">
						{preference === "avoid" && <span className="text-status-under">You avoid this</span>}
						{exercise.customWeightings && <span className="text-brand-text">Your weightings</span>}
						{exercise.estimatedWeightings && !exercise.customWeightings && (
							<span className="text-muted-foreground">Estimated muscles</span>
						)}
						{exercise.legacy && <span className="text-status-under">Not in Hevy</span>}
					</p>
				)}
			</div>

			<div className="flex shrink-0 items-center rounded-lg bg-background/60 ring-1 ring-border">
				<Button
					onClick={() => sets > 1 && onChange({ sets: sets - 1 })}
					size="icon"
					variant="ghost"
					className="h-8 w-7 rounded-r-none @md:w-8"
					disabled={sets <= 1}
					aria-label="One set fewer"
				>
					<Minus className="h-3.5 w-3.5" />
				</Button>
				<span className="tabular w-5 text-center text-sm font-semibold" aria-label={`${sets} sets`}>
					{sets}
				</span>
				<Button
					onClick={() => sets < MAX_SETS && onChange({ sets: sets + 1 })}
					size="icon"
					variant="ghost"
					className="h-8 w-7 rounded-l-none @md:w-8"
					disabled={sets >= MAX_SETS}
					aria-label="One set more"
				>
					<Plus className="h-3.5 w-3.5" />
				</Button>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="icon" variant="ghost" className="h-8 w-7 shrink-0 text-muted-foreground" aria-label={`${exercise.name} options`}>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => setShowInfo(true)}>
						<Info className="h-4 w-4" />
						Tier and form cues
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => setPreference(exercise.id, preference === "favourite" ? null : { pref: "favourite" })}
					>
						<Heart className="h-4 w-4" />
						{preference === "favourite" ? "Remove favourite" : "Favourite"}
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => {
							if (preference === "avoid") return setPreference(exercise.id, null);
							// Opens the details too, to say why.
							setPreference(exercise.id, { pref: "avoid" });
							setShowInfo(true);
						}}
					>
						<Ban className="h-4 w-4" />
						{preference === "avoid" ? "Stop avoiding" : "Avoid…"}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => setEditingMuscles(true)}>
						<SlidersHorizontal className="h-4 w-4" />
						Muscle weightings
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onReplace}>
						<ArrowLeftRight className="h-4 w-4" />
						Replace exercise
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={onRemove}>
						<Trash2 className="h-4 w-4" />
						Remove
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<MuscleWeightingsDialog exercise={exercise} open={editingMuscles} onOpenChange={setEditingMuscles} />
			<ExerciseInfoDialog
				exercise={exercise}
				open={showInfo}
				onOpenChange={setShowInfo}
				onAddCue={(cue) => onChange({ notes: routineExercise.notes ? `${routineExercise.notes}\n${cue}` : cue })}
			/>
		</li>
	);
}

/** An exercise Claude's draft removes, shown in place until the draft is applied or discarded. */
export function GhostExercise({ exercise, sets }: { exercise?: Exercise; sets: number }) {
	return (
		<li className="flex items-center gap-3 rounded-xl border border-dashed border-status-under/40 p-2 pl-7 opacity-70">
			<Thumb exercise={exercise} className="grayscale" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium line-through">{exercise?.name ?? "Unknown exercise"}</p>
				<p className="text-xs text-status-under">Removed · {sets} sets</p>
			</div>
		</li>
	);
}
