"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth-context";
import {
	deleteRoutineFromFirebase,
	getPrioritiesFromFirebase,
	getRoutinesFromFirebase,
	saveRoutineToFirebase,
} from "@/lib/firebase-storage";
import type { PriorityTier, Routine } from "@/lib/types";
import { Calendar, Copy, Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SavedRoutinesModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLoadRoutine: (routine: Routine) => void;
	onLoadPriorities: (
		priorities: Partial<Record<PriorityTier, string[]>>
	) => void;
}

export function SavedRoutinesModal({
	open,
	onOpenChange,
	onLoadRoutine,
	onLoadPriorities,
}: SavedRoutinesModalProps) {
	const { user } = useAuth();
	const [routines, setRoutines] = useState<Routine[]>([]);
	const [loading, setLoading] = useState(false);

	// State for managing the delete confirmation dialog
	const [isAlertOpen, setIsAlertOpen] = useState(false);
	const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);

	useEffect(() => {
		if (open && user) {
			loadRoutines();
		}
	}, [open, user]);

	const loadRoutines = async () => {
		if (!user) return;

		setLoading(true);
		try {
			const fetchedRoutines = await getRoutinesFromFirebase(user.uid);
			setRoutines(fetchedRoutines);
		} catch (error) {
			toast.error("Failed to load routines", {
				description:
					error instanceof Error
						? error.message
						: "Could not fetch your saved routines",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleLoadRoutine = async (routine: Routine) => {
		if (!user) return;

		try {
			const priorities = await getPrioritiesFromFirebase(user.uid);
			onLoadRoutine(routine);
			onLoadPriorities(priorities);
			onOpenChange(false);
			toast.success("Routine loaded", {
				description: `"${routine.name}" has been loaded successfully`,
			});
		} catch (error) {
			toast.error("Failed to load routine", {
				description:
					error instanceof Error ? error.message : "Could not load the routine",
			});
		}
	};

	const handleCreateNew = () => {
		const newRoutine: Routine = {
			id: crypto.randomUUID(),
			name: "New Routine",
			days: [],
		};

		onLoadRoutine(newRoutine);
		onOpenChange(false);
		toast.success("New routine created", {
			description: "Started a fresh routine workspace.",
		});
	};

	const handleDuplicate = async (routine: Routine) => {
		if (!user) return;

		try {
			const copiedRoutine: Routine = {
				...JSON.parse(JSON.stringify(routine)),
				id: crypto.randomUUID(),
				name: `${routine.name} (Copy)`,
			};

			await saveRoutineToFirebase(user.uid, copiedRoutine);
			setRoutines((prev) => [...prev, copiedRoutine]);

			toast.success("Routine duplicated", {
				description: `Created copy of "${routine.name}"`,
			});
		} catch (error) {
			toast.error("Failed to duplicate", {
				description: "Could not save the copied routine.",
			});
		}
	};

	const confirmDelete = (routine: Routine) => {
		setRoutineToDelete(routine);
		setIsAlertOpen(true);
	};

	const handleDeleteRoutine = async () => {
		if (!user || !routineToDelete) return;

		try {
			await deleteRoutineFromFirebase(user.uid, routineToDelete.id);

			setRoutines((prevRoutines) =>
				prevRoutines.filter((r) => r.id !== routineToDelete.id)
			);

			toast.success("Routine deleted", {
				description: `"${routineToDelete.name}" has been successfully deleted.`,
			});
		} catch (error) {
			toast.error("Deletion failed", {
				description:
					error instanceof Error
						? error.message
						: "Could not delete the routine.",
			});
		} finally {
			setIsAlertOpen(false);
			setRoutineToDelete(null);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-2xl max-h-[80vh]">
					<DialogHeader>
						<div className="flex items-center justify-between pr-8">
							<div>
								<DialogTitle>My Saved Routines</DialogTitle>
								<DialogDescription>
									Load, copy, or delete a previously saved routine
								</DialogDescription>
							</div>

							{/* STYLING UPDATE: Changed to outline variant */}
							<Button
								onClick={handleCreateNew}
								size="sm"
								variant="outline"
								className="gap-2"
							>
								<Plus className="h-4 w-4" />
								New Routine
							</Button>
						</div>
					</DialogHeader>

					{loading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : routines.length === 0 ? (
						<div className="text-center py-12">
							<Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
							<h3 className="font-semibold mb-2">No saved routines</h3>
							<p className="text-sm text-muted-foreground mb-4">
								Create a routine and save it to your account to see it here
							</p>
							<Button onClick={handleCreateNew} variant="outline">
								Create your first routine
							</Button>
						</div>
					) : (
						<ScrollArea className="h-[400px] pr-4">
							<div className="space-y-3">
								{routines.map((routine) => (
									<Card
										key={routine.id}
										className="p-4 transition-colors hover:bg-muted/40"
									>
										<div className="flex items-center justify-between">
											<div className="flex-1 mr-4">
												<h4 className="font-semibold mb-1">{routine.name}</h4>
												<div className="flex items-center gap-4 text-sm text-muted-foreground">
													<span className="flex items-center gap-1">
														<Calendar className="h-3 w-3" />
														{routine.days.length} days
													</span>
													<span className="flex items-center gap-1">
														<Dumbbell className="h-3 w-3" />
														{routine.days.reduce(
															(sum, day) => sum + day.exercises.length,
															0
														)}{" "}
														exercises
													</span>
												</div>
											</div>

											<div className="flex items-center gap-2">
												{/* STYLING UPDATE: Changed to secondary (usually grey in dark mode) */}
												<Button
													onClick={() => handleLoadRoutine(routine)}
													variant="default"
													size="sm"
												>
													Load
												</Button>

												{/* STYLING UPDATE: Changed to ghost to reduce clutter */}
												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleDuplicate(routine)}
													title="Duplicate Routine"
													className="text-muted-foreground hover:text-primary"
												>
													<Copy className="h-4 w-4" />
												</Button>

												<Button
													variant="ghost"
													size="icon"
													onClick={() => confirmDelete(routine)}
													aria-label={`Delete routine ${routine.name}`}
													className="text-muted-foreground hover:text-destructive"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</Card>
								))}
							</div>
						</ScrollArea>
					)}
				</DialogContent>
			</Dialog>

			<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the
							routine "{routineToDelete?.name}".
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setRoutineToDelete(null)}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteRoutine}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
