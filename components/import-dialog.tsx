"use client";

import { ExerciseLibraryModal } from "@/components/exercise-library-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useExercises } from "@/lib/exercise-context";
import type { HevyRoutine } from "@/lib/hevy/client";
import { routineFromHevy } from "@/lib/hevy/import";
import { useHevy } from "@/lib/hevy-context";
import { parseRoutineText, type ParsedDay } from "@/lib/import-text";
import { formatReps } from "@/lib/training-defaults";
import type { Routine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, ChevronDown, Loader2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImport: (routine: Routine) => void;
	onConnectHevy: () => void;
}

const EXAMPLE = `Push
Bench press 4x6-8
Incline DB press 3x8-10
Lateral raises 4x12-15
Tricep pushdowns 3x10-12

Pull
Pull-ups 3x6-10
Barbell rows 3x8-10
Face pulls 3x15
EZ bar curls 3x10`;

export function ImportDialog({ open, onOpenChange, onImport, onConnectHevy }: ImportDialogProps) {
	const { client } = useHevy();
	const finish = (routine: Routine) => {
		onImport(routine);
		onOpenChange(false);
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl max-sm:p-0">
				<DialogHeader className="border-b p-4 text-left sm:p-5">
					<DialogTitle>Import a routine</DialogTitle>
					<DialogDescription>Bring in the routine you already run to see how it stacks up.</DialogDescription>
				</DialogHeader>
				<Tabs defaultValue={client ? "hevy" : "text"} className="min-h-0 flex-1 gap-0">
					<TabsList className="mx-4 mt-3 grid grid-cols-2 sm:mx-5">
						<TabsTrigger value="hevy">From Hevy</TabsTrigger>
						<TabsTrigger value="text">Paste text</TabsTrigger>
					</TabsList>
					<TabsContent value="hevy" className="min-h-0 overflow-y-auto p-4 sm:p-5">
						{client ? (
							<HevyImport open={open} onImport={finish} />
						) : (
							<div className="space-y-3 py-6 text-center">
								<p className="text-sm text-muted-foreground">Connect Hevy to import the routines you already have there.</p>
								<Button
									onClick={() => {
										onOpenChange(false);
										onConnectHevy();
									}}
								>
									Connect Hevy
								</Button>
							</div>
						)}
					</TabsContent>
					<TabsContent value="text" className="min-h-0 overflow-y-auto p-4 sm:p-5">
						<TextImport onImport={finish} />
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}

type Folder = { id: number | null; title: string; routines: HevyRoutine[] };

function HevyImport({ open, onImport }: { open: boolean; onImport: (r: Routine) => void }) {
	const { client, refreshExercises } = useHevy();
	const [folders, setFolders] = useState<Folder[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [expanded, setExpanded] = useState<number | null | undefined>(undefined);
	const [excluded, setExcluded] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (!open || !client) return;
		setFolders(null);
		setError(null);
		// Custom exercises load too, so imported routines that use them resolve.
		Promise.all([client.getRoutineFolders(), client.getRoutines(), refreshExercises()])
			.then(([fs, rs]) => {
				const byCreation = (a: HevyRoutine, b: HevyRoutine) =>
					String((a as { created_at?: string }).created_at ?? "").localeCompare(String((b as { created_at?: string }).created_at ?? ""));
				const grouped: Folder[] = [...fs]
					.sort((a, b) => a.index - b.index)
					.map((f) => ({ id: f.id, title: f.title, routines: rs.filter((r) => r.folder_id === f.id).sort(byCreation) }))
					.filter((f) => f.routines.length > 0);
				const loose = rs.filter((r) => r.folder_id === null || !fs.some((f) => f.id === r.folder_id));
				if (loose.length) grouped.push({ id: null, title: "Not in a folder", routines: loose.sort(byCreation) });
				setFolders(grouped);
			})
			.catch((e) => setError(e instanceof Error ? e.message : String(e)));
	}, [open, client, refreshExercises]);

	if (error) return <p className="py-6 text-center text-sm text-status-under">{error}</p>;
	if (!folders)
		return (
			<p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading your Hevy routines…
			</p>
		);
	if (folders.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No routines in this Hevy account yet.</p>;

	return (
		<ul className="space-y-2">
			{folders.map((folder) => {
				const open = expanded === folder.id;
				const chosen = folder.routines.filter((r) => !excluded.has(r.id));
				return (
					<li key={folder.id ?? "loose"} className="rounded-xl bg-surface ring-1 ring-border">
						<div className="flex items-center gap-2 p-3">
							<button
								type="button"
								className="flex min-w-0 flex-1 items-center gap-2 text-left"
								onClick={() => setExpanded(open ? undefined : folder.id)}
								aria-expanded={open}
							>
								<ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
								<span className="min-w-0">
									<span className="block truncate font-medium">{folder.title}</span>
									<span className="block text-xs text-muted-foreground">
										{chosen.length === folder.routines.length
											? `${folder.routines.length} routine${folder.routines.length === 1 ? "" : "s"}`
											: `${chosen.length} of ${folder.routines.length} routines`}
									</span>
								</span>
							</button>
							<Button
								size="sm"
								disabled={chosen.length === 0}
								onClick={() => onImport(routineFromHevy(folder.id === null ? "Imported routine" : folder.title, chosen, folder.id))}
							>
								Import
							</Button>
						</div>
						{open && (
							<ul className="border-t px-3 py-2">
								{folder.routines.map((r) => {
									const included = !excluded.has(r.id);
									return (
										<li key={r.id}>
											<label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
												<input
													type="checkbox"
													className="h-4 w-4 accent-[var(--primary)]"
													checked={included}
													onChange={() =>
														setExcluded((prev) => {
															const next = new Set(prev);
															if (included) next.add(r.id);
															else next.delete(r.id);
															return next;
														})
													}
												/>
												<span className="flex-1 truncate">{r.title}</span>
												<span className="text-xs text-muted-foreground">{r.exercises.length} exercises</span>
											</label>
										</li>
									);
								})}
							</ul>
						)}
					</li>
				);
			})}
		</ul>
	);
}

function TextImport({ onImport }: { onImport: (r: Routine) => void }) {
	const { exercises } = useExercises();
	const [text, setText] = useState("");
	const [name, setName] = useState("My routine");
	// Matches the user corrected by hand: "day:line" -> exercise id.
	const [fixes, setFixes] = useState<Record<string, string>>({});
	const [fixing, setFixing] = useState<string | null>(null);

	const parsed: ParsedDay[] = useMemo(() => parseRoutineText(text, exercises), [text, exercises]);
	const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
	const lines = parsed.flatMap((d, di) => d.lines.map((l, li) => ({ key: `${di}:${li}`, line: l })));
	const resolved = (key: string, fallback: string | undefined) => fixes[key] ?? fallback;
	const unmatched = lines.filter(({ key, line }) => !resolved(key, line.match?.id)).length;

	const build = (): Routine => {
		const stamp = Date.now().toString(36);
		return {
			id: `import-${stamp}`,
			name: name.trim() || "My routine",
			days: parsed.map((day, di) => ({
				id: `day-${stamp}-${di}`,
				name: day.name,
				exercises: day.lines.flatMap((l, li) => {
					const id = resolved(`${di}:${li}`, l.match?.id);
					return id ? [{ exerciseId: id, sets: l.sets, ...(l.reps ? { reps: l.reps } : {}) }] : [];
				}),
			})),
		};
	};

	return (
		<div className="space-y-3">
			<Textarea
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					setFixes({});
				}}
				placeholder={EXAMPLE}
				rows={8}
				className="font-mono text-xs"
				aria-label="Routine text"
			/>
			<p className="text-xs text-muted-foreground">
				One exercise per line, like &ldquo;Bench press 3x8-10&rdquo;. Lines like &ldquo;Push day&rdquo; or &ldquo;Monday:&rdquo; start a new day.
			</p>

			{parsed.length > 0 && (
				<>
					<Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Routine name" placeholder="Routine name" />
					<div className="space-y-3">
						{parsed.map((day, di) => (
							<section key={di} className="rounded-xl bg-surface p-3 ring-1 ring-border">
								<h4 className="mb-1.5 text-sm font-semibold">{day.name}</h4>
								<ul className="space-y-1">
									{day.lines.map((l, li) => {
										const key = `${di}:${li}`;
										const id = resolved(key, l.match?.id);
										const ex = id ? byId.get(id) : undefined;
										const unsure = !fixes[key] && l.match && l.confidence < 0.8;
										return (
											<li key={key} className="flex items-center gap-2 text-sm">
												{ex ? (
													unsure ? (
														<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-maintain" />
													) : (
														<Check className="h-3.5 w-3.5 shrink-0 text-status-optimal" />
													)
												) : (
													<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-under" />
												)}
												<span className="min-w-0 flex-1 truncate">
													{ex ? ex.name : <span className="text-status-under">No match for &ldquo;{l.name}&rdquo;</span>}
													{ex && unsure && <span className="ml-1.5 text-xs text-muted-foreground">from &ldquo;{l.name}&rdquo;</span>}
												</span>
												<span className="tabular shrink-0 text-xs text-muted-foreground">
													{l.sets} × {l.reps ? formatReps(l.reps) : "default"}
												</span>
												<Button
													size="icon"
													variant="ghost"
													className="h-7 w-7 shrink-0"
													onClick={() => setFixing(key)}
													aria-label={`Change match for ${l.name}`}
												>
													<Pencil className="h-3.5 w-3.5" />
												</Button>
											</li>
										);
									})}
								</ul>
							</section>
						))}
					</div>
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs text-muted-foreground">
							{unmatched > 0
								? `${unmatched} line${unmatched > 1 ? "s" : ""} without a match will be left out.`
								: "Everything matched."}
						</p>
						<Button onClick={() => onImport(build())} disabled={lines.length === unmatched}>
							Import routine
						</Button>
					</div>
				</>
			)}

			<ExerciseLibraryModal
				open={fixing !== null}
				onOpenChange={(o) => !o && setFixing(null)}
				onSelectExercise={(id) => fixing && setFixes((prev) => ({ ...prev, [fixing]: id }))}
				title="Choose the exercise"
			/>
		</div>
	);
}
