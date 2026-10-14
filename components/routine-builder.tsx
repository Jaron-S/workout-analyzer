"use client";

import { ExerciseCard, GhostExercise } from "@/components/exercise-card";
import { ExerciseLibraryModal } from "@/components/exercise-library-modal";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useExercises } from "@/lib/exercise-context";
import { diffRoutine, type DayDiff } from "@/lib/routine-diff";
import type { Suggestion } from "@/lib/suggestions";
import type { Routine, RoutineExercise, WorkoutDay } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Download, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

// Firestore rejects undefined fields, and clearing a target sets it to undefined.
const withoutUndefined = <T extends object>(value: T): T =>
	Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

const totalSets = (day: WorkoutDay) => day.exercises.reduce((n, ex) => n + ex.sets, 0);

type LibraryMode = { kind: "add"; dayId: string } | { kind: "replace"; dayId: string; index: number };

interface RoutineBuilderProps {
	routine: Routine;
	onRoutineChange: (routine: Routine) => void;
	/** The applied routine while a draft is shown, to highlight what the draft changes. */
	baseRoutine?: Routine;
	suggestions?: Suggestion[];
	onImport?: () => void;
}

function useDragSensors() {
	return useSensors(
		// A small distance (mouse) or a short press (touch) starts a drag, so taps
		// and scrolling still work.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
}

export function RoutineBuilder({ routine, onRoutineChange, baseRoutine, suggestions, onImport }: RoutineBuilderProps) {
	const [library, setLibrary] = useState<LibraryMode | null>(null);
	const [editingName, setEditingName] = useState<string | null>(null);
	const sensors = useDragSensors();
	const diff = useMemo(() => (baseRoutine ? diffRoutine(baseRoutine, routine) : null), [baseRoutine, routine]);

	const setDays = (days: WorkoutDay[]) => onRoutineChange({ ...routine, days });
	const updateDay = (dayId: string, update: (day: WorkoutDay) => WorkoutDay) =>
		setDays(routine.days.map((d) => (d.id === dayId ? update(d) : d)));

	const addDay = () =>
		setDays([...routine.days, { id: `day-${Date.now().toString(36)}`, name: `Day ${routine.days.length + 1}`, exercises: [] }]);

	const duplicateDay = (day: WorkoutDay) => {
		const copy = { ...structuredClone(day), id: `day-${Date.now().toString(36)}`, name: `${day.name} (copy)` };
		const i = routine.days.findIndex((d) => d.id === day.id);
		setDays([...routine.days.slice(0, i + 1), copy, ...routine.days.slice(i + 1)]);
	};

	const handleDayDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = routine.days.findIndex((d) => d.id === active.id);
		const to = routine.days.findIndex((d) => d.id === over.id);
		setDays(arrayMove(routine.days, from, to));
	};

	const handleSelectExercise = (exerciseId: string) => {
		if (!library) return;
		if (library.kind === "add") {
			updateDay(library.dayId, (d) => ({ ...d, exercises: [...d.exercises, { exerciseId, sets: 3 }] }));
		} else {
			updateDay(library.dayId, (d) => ({
				...d,
				exercises: d.exercises.map((ex, i) => (i === library.index ? { ...ex, exerciseId } : ex)),
			}));
		}
	};

	const weeklySets = routine.days.reduce((n, d) => n + totalSets(d), 0);
	const saveName = () => {
		if (editingName?.trim()) onRoutineChange({ ...routine, name: editingName.trim() });
		setEditingName(null);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-end justify-between gap-3">
				<div className="min-w-0">
					{editingName !== null ? (
						<Input
							value={editingName}
							onChange={(e) => setEditingName(e.target.value)}
							onBlur={saveName}
							onKeyDown={(e) => {
								if (e.key === "Enter") saveName();
								if (e.key === "Escape") setEditingName(null);
							}}
							className="h-9 text-xl font-semibold"
							autoFocus
						/>
					) : (
						<button
							type="button"
							onClick={() => setEditingName(routine.name)}
							className={cn(
								"group flex max-w-full items-center gap-2 rounded-md text-left",
								diff?.renamed && "text-status-growing"
							)}
						>
							<h2 className="truncate text-xl font-semibold tracking-tight @lg:text-2xl">{routine.name}</h2>
							<Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100" />
						</button>
					)}
					<p className="tabular text-sm text-muted-foreground">
						{routine.days.length} day{routine.days.length === 1 ? "" : "s"} · {weeklySets} sets a week
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					{onImport && (
						<Button onClick={onImport} size="sm" variant="ghost" aria-label="Import a routine">
							<Download className="h-4 w-4" />
							<span className="hidden @md:inline">Import</span>
						</Button>
					)}
					<Button onClick={addDay} size="sm" variant="outline">
						<Plus className="h-4 w-4" />
						Day
					</Button>
				</div>
			</div>

			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
				<SortableContext items={routine.days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
					<div className="space-y-3">
						{routine.days.map((day) => (
							<DayCard
								key={day.id}
								day={day}
								diff={diff?.days.get(day.id)}
								canRemove={routine.days.length > 1}
								onChange={(update) => updateDay(day.id, update)}
								onRemove={() => setDays(routine.days.filter((d) => d.id !== day.id))}
								onDuplicate={() => duplicateDay(day)}
								onAddExercise={() => setLibrary({ kind: "add", dayId: day.id })}
								onReplaceExercise={(index) => setLibrary({ kind: "replace", dayId: day.id, index })}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>

			{diff?.removedDays.map((day) => (
				<div key={day.id} className="rounded-2xl border border-dashed border-status-under/40 p-4 opacity-70">
					<p className="text-sm font-medium line-through">{day.name}</p>
					<p className="text-xs text-status-under">Removed by Claude · {day.exercises.length} exercises</p>
				</div>
			))}

			<ExerciseLibraryModal
				open={library !== null}
				onOpenChange={(open) => !open && setLibrary(null)}
				onSelectExercise={handleSelectExercise}
				title={library?.kind === "replace" ? "Replace exercise" : undefined}
				suggestions={library?.kind === "add" ? suggestions : undefined}
			/>
		</div>
	);
}

function DayCard({
	day,
	diff,
	canRemove,
	onChange,
	onRemove,
	onDuplicate,
	onAddExercise,
	onReplaceExercise,
}: {
	day: WorkoutDay;
	diff?: DayDiff;
	canRemove: boolean;
	onChange: (update: (day: WorkoutDay) => WorkoutDay) => void;
	onRemove: () => void;
	onDuplicate: () => void;
	onAddExercise: () => void;
	onReplaceExercise: (index: number) => void;
}) {
	const { getExercise } = useExercises();
	const [editingName, setEditingName] = useState<string | null>(null);
	const sensors = useDragSensors();
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: day.id,
	});

	const updateExercise = (index: number, patch: Partial<RoutineExercise>) =>
		onChange((d) => ({
			...d,
			exercises: d.exercises.map((ex, i) => (i === index ? withoutUndefined({ ...ex, ...patch }) : ex)),
		}));

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = Number(String(active.id).split(":")[1]);
		const to = Number(String(over.id).split(":")[1]);
		onChange((d) => ({ ...d, exercises: arrayMove(d.exercises, from, to) }));
	};

	const saveName = () => {
		if (editingName?.trim()) onChange((d) => ({ ...d, name: editingName.trim() }));
		setEditingName(null);
	};

	const sets = totalSets(day);

	return (
		<section
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"rounded-2xl border bg-card p-2 shadow-xs @md:p-3",
				isDragging && "z-10 opacity-80 shadow-lg",
				diff?.added && "border-status-optimal/50 ring-1 ring-status-optimal/30"
			)}
		>
			<header className="flex items-center gap-1 py-1 pl-0.5 pr-1">
				<button
					ref={setActivatorNodeRef}
					{...attributes}
					{...listeners}
					className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
					aria-label={`Reorder ${day.name}`}
				>
					<GripVertical className="h-4 w-4" />
				</button>
				<div className="min-w-0 flex-1">
					{editingName !== null ? (
						<Input
							value={editingName}
							onChange={(e) => setEditingName(e.target.value)}
							onBlur={saveName}
							onKeyDown={(e) => {
								if (e.key === "Enter") saveName();
								if (e.key === "Escape") setEditingName(null);
							}}
							className="h-8 font-semibold"
							autoFocus
						/>
					) : (
						<button
							type="button"
							onClick={() => setEditingName(day.name)}
							className="block max-w-full truncate text-left font-semibold"
							title="Rename"
						>
							{day.name}
							{diff?.added && <span className="ml-2 text-xs font-medium text-status-optimal">New</span>}
							{diff?.renamed && <span className="ml-2 text-xs font-medium text-status-growing">Renamed</span>}
						</button>
					)}
					<p className="tabular text-xs text-muted-foreground">
						{day.exercises.length} exercise{day.exercises.length === 1 ? "" : "s"} · {sets} set{sets === 1 ? "" : "s"}
					</p>
				</div>
				<Button onClick={onAddExercise} size="sm" variant="ghost" aria-label={`Add exercise to ${day.name}`}>
					<Plus className="h-4 w-4" />
					<span className="hidden @md:inline">Exercise</span>
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`${day.name} options`}>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => setEditingName(day.name)}>
							<Pencil className="h-4 w-4" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={onDuplicate}>
							<Copy className="h-4 w-4" />
							Duplicate
						</DropdownMenuItem>
						{canRemove && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="destructive" onSelect={onRemove}>
									<Trash2 className="h-4 w-4" />
									Delete day
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</header>

			{day.exercises.length === 0 && !diff?.removed.length ? (
				<button
					type="button"
					onClick={onAddExercise}
					className="mt-1 flex w-full flex-col items-center gap-1 rounded-xl border border-dashed py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
				>
					<Plus className="h-5 w-5" />
					Add an exercise
				</button>
			) : (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
					<SortableContext items={day.exercises.map((_, i) => `${day.id}:${i}`)} strategy={verticalListSortingStrategy}>
						<ul className="mt-1 space-y-1.5">
							{day.exercises.map((routineEx, i) => {
								const exercise = getExercise(routineEx.exerciseId);
								if (!exercise) return null;
								return (
									<ExerciseCard
										key={`${day.id}:${i}`}
										id={`${day.id}:${i}`}
										exercise={exercise}
										routineExercise={routineEx}
										change={diff?.exercises.get(i)}
										onChange={(patch) => updateExercise(i, patch)}
										onReplace={() => onReplaceExercise(i)}
										onRemove={() => onChange((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}
									/>
								);
							})}
							{diff?.removed.map((ex, i) => (
								<GhostExercise key={`removed-${i}`} exercise={getExercise(ex.exerciseId)} sets={ex.sets} />
							))}
						</ul>
					</SortableContext>
				</DndContext>
			)}
		</section>
	);
}
