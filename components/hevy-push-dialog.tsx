"use client";

import { ExerciseLibraryModal } from "@/components/exercise-library-modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useExercises } from "@/lib/exercise-context";
import { saveRoutineToFirebase } from "@/lib/firebase-storage";
import {
	guessEquipment,
	HEVY_EQUIPMENT,
	normalizeExerciseName,
	toCustomExerciseInput,
} from "@/lib/hevy/exercises";
import {
	findUnresolvedExercises,
	pushRoutine,
	replaceExercise,
	type PushResult,
} from "@/lib/hevy/push";
import { useHevy } from "@/lib/hevy-context";
import { useSettings } from "@/lib/settings-context";
import type { Exercise, Routine } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface HevyPushDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	routine: Routine;
	setRoutine: (update: (routine: Routine) => Routine) => void;
}

type Step =
	| { kind: "checking" }
	| { kind: "resolve"; unresolved: string[] }
	| { kind: "ready" }
	| { kind: "pushing" }
	| { kind: "done"; result: PushResult }
	| { kind: "error"; message: string };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function HevyPushDialog({ open, onOpenChange, routine, setRoutine }: HevyPushDialogProps) {
	const { user } = useAuth();
	const { client, refreshExercises } = useHevy();
	const { getExercise } = useExercises();
	const { defaults } = useSettings();
	const [step, setStep] = useState<Step>({ kind: "checking" });
	const [hevyIds, setHevyIds] = useState<Set<string>>(new Set());

	const check = useCallback(
		async (current: Routine, ids?: Set<string>) => {
			setStep({ kind: "checking" });
			try {
				const available = ids ?? new Set((await refreshExercises()).map((t) => t.id));
				setHevyIds(available);
				const unresolved = findUnresolvedExercises(current, available);
				setStep(unresolved.length ? { kind: "resolve", unresolved } : { kind: "ready" });
			} catch (e) {
				setStep({ kind: "error", message: errorMessage(e) });
			}
		},
		[refreshExercises]
	);

	// Fetch the account's exercises each time the dialog opens.
	useEffect(() => {
		if (open) check(routine);
		// Only on open: later routine changes come from this dialog and re-check explicitly.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const handleResolved = (updated: Routine) => {
		setRoutine(() => updated);
		const unresolved = findUnresolvedExercises(updated, hevyIds);
		setStep(unresolved.length ? { kind: "resolve", unresolved } : { kind: "ready" });
	};

	const handlePush = async () => {
		if (!client) return;
		setStep({ kind: "pushing" });
		let latest = routine;
		const saveLink = (link: Routine["hevy"]) => {
			latest = { ...latest, hevy: link };
			setRoutine((r) => ({ ...r, hevy: link }));
		};
		try {
			const result = await pushRoutine(client, routine, getExercise, defaults, saveLink);
			setStep({ kind: "done", result });
		} catch (e) {
			setStep({ kind: "error", message: errorMessage(e) });
		} finally {
			// The Hevy IDs must reach every device, or another device would
			// push duplicates; so signed-in users get the routine saved.
			if (user && latest.hevy) {
				saveRoutineToFirebase(user.uid, latest).catch((error) =>
					console.error("Failed to save Hevy link:", error)
				);
			}
		}
	};

	const dayCount = routine.days.filter((d) => d.exercises.length > 0).length;
	const pushedBefore = Boolean(routine.hevy);

	return (
		<Dialog open={open} onOpenChange={(o) => step.kind !== "pushing" && onOpenChange(o)}>
			<DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Push to Hevy</DialogTitle>
					<DialogDescription>
						&ldquo;{routine.name}&rdquo; becomes a Hevy folder with one routine per day.
					</DialogDescription>
				</DialogHeader>

				{(step.kind === "checking" || step.kind === "pushing") && (
					<div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						{step.kind === "checking" ? "Checking your Hevy exercises…" : "Pushing to Hevy…"}
					</div>
				)}

				{step.kind === "error" && (
					<Alert variant="destructive">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>
							{step.message} Anything already pushed is remembered, so trying again
							will not create duplicates.
						</AlertDescription>
					</Alert>
				)}

				{step.kind === "resolve" && (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							These exercises aren&rsquo;t in your Hevy account yet. Choose what to
							use instead for each one.
						</p>
						{step.unresolved.map((id) => (
							<UnresolvedExercise
								key={id}
								exerciseId={id}
								routine={routine}
								onResolved={handleResolved}
								onCreated={(updated, ids) => {
									setRoutine(() => updated);
									check(updated, ids);
								}}
							/>
						))}
					</div>
				)}

				{step.kind === "ready" && (
					<div className="space-y-2 text-sm">
						<p>
							{pushedBefore
								? `Updates the ${dayCount} routines pushed before, and adds any new days.`
								: `Creates a "${routine.name}" folder with ${dayCount} routines.`}
						</p>
						<p className="text-muted-foreground">
							Weights are left blank for you to fill in while training. Hevy&rsquo;s
							API can&rsquo;t delete routines, so anything pushed has to be removed in
							the Hevy app.
						</p>
					</div>
				)}

				{step.kind === "done" && <PushSummary result={step.result} />}

				<DialogFooter>
					{step.kind === "ready" && (
						<Button onClick={handlePush}>
							{pushedBefore ? "Update in Hevy" : `Push ${dayCount} routines`}
						</Button>
					)}
					{step.kind === "error" && <Button onClick={() => check(routine)}>Try again</Button>}
					{(step.kind === "done" || step.kind === "resolve" || step.kind === "error") && (
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PushSummary({ result }: { result: PushResult }) {
	return (
		<div className="space-y-2 text-sm">
			<p className="flex items-center gap-2 font-medium">
				<CheckCircle2 className="h-4 w-4 text-status-optimal" />
				Done. Open Hevy to see it.
			</p>
			{result.folderCreated && <p>Created a new folder.</p>}
			{result.created.length > 0 && <p>Created: {result.created.join(", ")}</p>}
			{result.updated.length > 0 && <p>Updated: {result.updated.join(", ")}</p>}
			{result.skipped.length > 0 && (
				<p className="text-muted-foreground">
					Skipped (no exercises): {result.skipped.join(", ")}
				</p>
			)}
			{result.orphanedRoutineIds.length > 0 && (
				<p className="text-muted-foreground">
					{result.orphanedRoutineIds.length} routine
					{result.orphanedRoutineIds.length > 1 ? "s" : ""} for days you removed{" "}
					{result.orphanedRoutineIds.length > 1 ? "are" : "is"} still in Hevy; delete{" "}
					{result.orphanedRoutineIds.length > 1 ? "them" : "it"} in the Hevy app.
				</p>
			)}
		</div>
	);
}

function UnresolvedExercise({
	exerciseId,
	routine,
	onResolved,
	onCreated,
}: {
	exerciseId: string;
	routine: Routine;
	onResolved: (routine: Routine) => void;
	onCreated: (routine: Routine, hevyIds: Set<string>) => void;
}) {
	const { client, customTemplates, refreshExercises } = useHevy();
	const { getExercise, hasMuscleOverride, setMuscleOverride } = useExercises();
	const [picking, setPicking] = useState(false);
	const [confirmingCreate, setConfirmingCreate] = useState(false);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const exercise = getExercise(exerciseId);
	const name = exercise?.name ?? "Unknown exercise";
	const [equipment, setEquipment] = useState<string>(() => guessEquipment(name));
	const suggestion = customTemplates.find(
		(t) => normalizeExerciseName(t.title) === normalizeExerciseName(name)
	);

	// A legacy exercise's curated weightings beat the estimate for a custom.
	const carryWeightings = (from: Exercise | undefined, toId: string) => {
		const target = getExercise(toId);
		if (from?.legacy && (!target || target.hevyCustom) && !hasMuscleOverride(toId)) {
			setMuscleOverride(
				toId,
				Object.fromEntries(from.muscle_weightings.map((w) => [w.muscle, w.weighting]))
			);
		}
	};

	const pickExercise = (toId: string) => {
		carryWeightings(exercise, toId);
		onResolved(replaceExercise(routine, exerciseId, toId));
	};

	const create = async () => {
		if (!client || !exercise) return;
		setCreating(true);
		setError(null);
		try {
			const created = await client.createCustomExercise(
				toCustomExerciseInput(exercise, equipment)
			);
			const templates = await refreshExercises();
			// The response ID's documented type is unreliable, so fall back to the title.
			const resolvedId = (
				templates.find((t) => t.id === String(created.id)) ??
				templates.find((t) => t.is_custom && t.title === exercise.name)
			)?.id;
			if (!resolvedId) throw new Error("Created it, but couldn't find it in Hevy afterwards.");
			const ids = new Set(templates.map((t) => t.id));
			carryWeightings(exercise, resolvedId);
			onCreated(replaceExercise(routine, exerciseId, resolvedId), ids);
		} catch (e) {
			setError(errorMessage(e));
			setCreating(false);
		}
	};

	return (
		<div className="rounded-md border border-border p-3 space-y-2">
			<p className="font-medium text-sm">{name}</p>
			<div className="flex flex-wrap gap-2">
				{suggestion && (
					<Button size="sm" onClick={() => pickExercise(suggestion.id)}>
						Use your &ldquo;{suggestion.title}&rdquo;
					</Button>
				)}
				<Button size="sm" variant="outline" onClick={() => setPicking(true)}>
					Choose another exercise
				</Button>
				{exercise && !confirmingCreate && (
					<Button size="sm" variant="outline" onClick={() => setConfirmingCreate(true)}>
						Create in Hevy
					</Button>
				)}
			</div>
			{confirmingCreate && (
				<div className="space-y-2 text-sm">
					<p className="text-muted-foreground">
						Adds &ldquo;{name}&rdquo; to your Hevy custom exercises. Hevy&rsquo;s API
						can&rsquo;t delete it, so removing it later means doing it in the Hevy app.
					</p>
					<div className="flex items-center gap-2">
						<Select value={equipment} onValueChange={setEquipment}>
							<SelectTrigger className="w-40 h-8">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{HEVY_EQUIPMENT.map((e) => (
									<SelectItem key={e} value={e}>
										{e === "none" ? "Bodyweight" : e.replace(/_/g, " ")}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button size="sm" onClick={create} disabled={creating}>
							{creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
							Create
						</Button>
						<Button size="sm" variant="ghost" onClick={() => setConfirmingCreate(false)}>
							Cancel
						</Button>
					</div>
				</div>
			)}
			{error && <p className="text-sm text-destructive">{error}</p>}
			<ExerciseLibraryModal
				open={picking}
				onOpenChange={setPicking}
				onSelectExercise={pickExercise}
			/>
		</div>
	);
}
