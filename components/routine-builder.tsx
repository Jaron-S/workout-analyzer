"use client";

import { ExerciseCard } from "@/components/exercise-card";
import { ExerciseLibraryModal } from "@/components/exercise-library-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import exercises from "@/data/exercises.json";
import type { Routine } from "@/lib/types";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Edit2, GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface RoutineBuilderProps {
	routine: Routine;
	onRoutineChange: (routine: Routine) => void;
}

export function RoutineBuilder({
	routine,
	onRoutineChange,
}: RoutineBuilderProps) {
	const [isLibraryOpen, setIsLibraryOpen] = useState(false);
	const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
	const [editingRoutineName, setEditingRoutineName] = useState(false);
	const [routineName, setRoutineName] = useState(routine.name);
	const [editingDayId, setEditingDayId] = useState<string | null>(null);
	const [editingDayName, setEditingDayName] = useState("");

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const addDay = () => {
		const newDay = {
			id: `day-${Date.now()}`,
			name: `Day ${routine.days.length + 1}`,
			exercises: [],
		};
		onRoutineChange({
			...routine,
			days: [...routine.days, newDay],
		});
	};

	const removeDay = (dayId: string) => {
		onRoutineChange({
			...routine,
			days: routine.days.filter((d) => d.id !== dayId),
		});
	};

	const updateDayName = (dayId: string, newName: string) => {
		onRoutineChange({
			...routine,
			days: routine.days.map((day) =>
				day.id === dayId ? { ...day, name: newName } : day
			),
		});
	};

	const addExerciseToDay = (dayId: string, exerciseId: string) => {
		onRoutineChange({
			...routine,
			days: routine.days.map((day) =>
				day.id === dayId
					? {
							...day,
							exercises: [...day.exercises, { exerciseId, sets: 3 }],
					  }
					: day
			),
		});
	};

	const updateExerciseSets = (
		dayId: string,
		exerciseIndex: number,
		sets: number
	) => {
		onRoutineChange({
			...routine,
			days: routine.days.map((day) =>
				day.id === dayId
					? {
							...day,
							exercises: day.exercises.map((ex, idx) =>
								idx === exerciseIndex ? { ...ex, sets } : ex
							),
					  }
					: day
			),
		});
	};

	const removeExercise = (dayId: string, exerciseIndex: number) => {
		onRoutineChange({
			...routine,
			days: routine.days.map((day) =>
				day.id === dayId
					? {
							...day,
							exercises: day.exercises.filter(
								(_, idx) => idx !== exerciseIndex
							),
					  }
					: day
			),
		});
	};

	const handleDragEnd = (event: DragEndEvent, dayId: string) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const day = routine.days.find((d) => d.id === dayId);
			if (!day) return;

			const oldIndex = day.exercises.findIndex(
				(_, idx) => `${dayId}-${idx}` === active.id
			);
			const newIndex = day.exercises.findIndex(
				(_, idx) => `${dayId}-${idx}` === over.id
			);

			const newExercises = arrayMove(day.exercises, oldIndex, newIndex);

			onRoutineChange({
				...routine,
				days: routine.days.map((d) =>
					d.id === dayId ? { ...d, exercises: newExercises } : d
				),
			});
		}
	};

	const openLibraryForDay = (dayId: string) => {
		setSelectedDayId(dayId);
		setIsLibraryOpen(true);
	};

	const handleSelectExercise = (exerciseId: string) => {
		if (selectedDayId) {
			addExerciseToDay(selectedDayId, exerciseId);
		}
	};

	const updateRoutineName = () => {
		onRoutineChange({
			...routine,
			name: routineName,
		});
		setEditingRoutineName(false);
	};

	const saveDayNameEdit = (dayId: string) => {
		if (editingDayName.trim()) {
			updateDayName(dayId, editingDayName);
		}
		setEditingDayId(null);
		setEditingDayName("");
	};

	return (
		<div className="p-4 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex-1">
					{editingRoutineName ? (
						<div className="flex items-center gap-2">
							<Input
								value={routineName}
								onChange={(e) => setRoutineName(e.target.value)}
								onBlur={updateRoutineName}
								onKeyDown={(e) => {
									if (e.key === "Enter") updateRoutineName();
									if (e.key === "Escape") {
										setRoutineName(routine.name);
										setEditingRoutineName(false);
									}
								}}
								className="text-xl font-bold h-auto py-1"
								autoFocus
							/>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<h2 className="text-xl font-bold">{routine.name}</h2>
							<Button
								size="icon"
								variant="ghost"
								className="h-6 w-6"
								onClick={() => setEditingRoutineName(true)}
							>
								<Edit2 className="h-3 w-3" />
							</Button>
						</div>
					)}
					<p className="text-sm text-muted-foreground">
						{routine.days.length} training days per week
					</p>
				</div>
				<Button onClick={addDay} size="sm" variant="outline">
					<Plus className="h-4 w-4 mr-2" />
					Add Day
				</Button>
			</div>

			<div className="space-y-4">
				{routine.days.map((day, dayIndex) => {
					const totalSets = day.exercises.reduce((sum, ex) => sum + ex.sets, 0);
					return (
						<Card key={day.id} className="p-4 bg-card">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center gap-2">
									<GripVertical className="h-5 w-5 text-muted-foreground" />
									{editingDayId === day.id ? (
										<Input
											value={editingDayName}
											onChange={(e) => setEditingDayName(e.target.value)}
											onBlur={() => saveDayNameEdit(day.id)}
											onKeyDown={(e) => {
												if (e.key === "Enter") saveDayNameEdit(day.id);
												if (e.key === "Escape") {
													setEditingDayId(null);
													setEditingDayName("");
												}
											}}
											className="text-lg font-semibold h-auto py-1 w-48"
											autoFocus
										/>
									) : (
										<>
											<h3 className="font-semibold text-lg">{day.name}</h3>
											<Button
												size="icon"
												variant="ghost"
												className="h-6 w-6"
												onClick={() => {
													setEditingDayId(day.id);
													setEditingDayName(day.name);
												}}
											>
												<Edit2 className="h-3 w-3" />
											</Button>
										</>
									)}
									<span className="text-sm text-muted-foreground">
										({day.exercises.length} exercises, {totalSets} total sets)
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Button
										onClick={() => openLibraryForDay(day.id)}
										size="sm"
										variant="ghost"
									>
										<Plus className="h-4 w-4 mr-1" />
										Exercise
									</Button>
									{routine.days.length > 1 && (
										<Button
											onClick={() => removeDay(day.id)}
											size="sm"
											variant="ghost"
											className="text-destructive"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
								</div>
							</div>

							{day.exercises.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
									<p className="text-sm">No exercises yet</p>
									<Button
										onClick={() => openLibraryForDay(day.id)}
										variant="link"
										size="sm"
										className="mt-2"
									>
										Add your first exercise
									</Button>
								</div>
							) : (
								<DndContext
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={(e) => handleDragEnd(e, day.id)}
								>
									<SortableContext
										items={day.exercises.map((_, idx) => `${day.id}-${idx}`)}
										strategy={verticalListSortingStrategy}
									>
										<div className="space-y-2">
											{day.exercises.map((routineEx, exIndex) => {
												const exercise = exercises.find(
													(ex) => ex.id === routineEx.exerciseId
												);
												if (!exercise) return null;

												return (
													<ExerciseCard
														key={`${day.id}-${exIndex}`}
														id={`${day.id}-${exIndex}`}
														exercise={exercise}
														sets={routineEx.sets}
														onSetsChange={(sets) =>
															updateExerciseSets(day.id, exIndex, sets)
														}
														onRemove={() => removeExercise(day.id, exIndex)}
													/>
												);
											})}
										</div>
									</SortableContext>
								</DndContext>
							)}
						</Card>
					);
				})}
			</div>

			<ExerciseLibraryModal
				open={isLibraryOpen}
				onOpenChange={setIsLibraryOpen}
				onSelectExercise={handleSelectExercise}
			/>
		</div>
	);
}
