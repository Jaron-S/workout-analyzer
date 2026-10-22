import { SETTINGS, type ClaudeDraft, type ClaudeUndo } from "../claude-sync";
import { DEFAULT_TRAINING_DEFAULTS } from "../training-defaults";
import type { ExercisePreferences, MuscleOverrides, PriorityTier, Routine, TrainingDefaults } from "../types";
import { Firestore, type Session } from "./firebase-rest";

// The signed-in user's Setsmith data, read and written through Firestore's
// REST API in the same document shapes the app uses (lib/firebase-storage.ts).

const routinePath = (uid: string, id: string) => `users/${uid}/routines/${id}`;
const settingPath = (uid: string, name: string) => `users/${uid}/settings/${name}`;

// Saved routines carry updatedAt; the routine itself doesn't.
const toRoutine = ({ updatedAt: _updatedAt, ...data }: Record<string, unknown>) => data as unknown as Routine;

export class UserStore {
	private fs: Firestore;

	constructor(private session: Session) {
		this.fs = new Firestore(session);
	}

	private get uid() {
		return this.session.uid;
	}

	private async setting<T>(name: string): Promise<T | null> {
		const doc = await this.fs.get(settingPath(this.uid, name));
		return (doc?.data.value as T | undefined) ?? null;
	}

	private saveSetting(name: string, value: unknown) {
		return this.fs.set(settingPath(this.uid, name), { value, updatedAt: new Date().toISOString() });
	}

	async listRoutines(): Promise<(Routine & { updatedAt?: string })[]> {
		const docs = await this.fs.list(`users/${this.uid}/routines`);
		return docs
			.map((d) => ({ ...toRoutine(d.data), updatedAt: d.data.updatedAt as string | undefined }))
			.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
	}

	/** The routine open in the app, else the most recently saved one. */
	async currentRoutine(): Promise<Routine | null> {
		const id = await this.setting<string>(SETTINGS.currentRoutine);
		if (id) {
			const doc = await this.fs.get(routinePath(this.uid, id));
			if (doc) return toRoutine(doc.data);
		}
		return (await this.listRoutines())[0] ?? null;
	}

	async getRoutine(id: string): Promise<Routine | null> {
		const doc = await this.fs.get(routinePath(this.uid, id));
		return doc ? toRoutine(doc.data) : null;
	}

	/** Makes this the routine open in the app (the app follows live). */
	setCurrentRoutine(id: string) {
		return this.saveSetting(SETTINGS.currentRoutine, id);
	}

	saveRoutine(routine: Routine) {
		return this.fs.set(routinePath(this.uid, routine.id), { ...routine, updatedAt: new Date().toISOString() });
	}

	async priorities(): Promise<Partial<Record<PriorityTier, string[]>>> {
		const doc = await this.fs.get(settingPath(this.uid, "priorities"));
		return (doc?.data.priorities as Partial<Record<PriorityTier, string[]>>) ?? {};
	}

	async trainingDefaults(): Promise<TrainingDefaults> {
		return { ...DEFAULT_TRAINING_DEFAULTS, ...(await this.setting<TrainingDefaults>("trainingDefaults")) };
	}

	async muscleOverrides(): Promise<MuscleOverrides> {
		return (await this.setting<MuscleOverrides>("muscleOverrides")) ?? {};
	}

	async exercisePreferences(): Promise<ExercisePreferences> {
		return (await this.setting<ExercisePreferences>("exercisePreferences")) ?? {};
	}

	saveExercisePreferences = (preferences: ExercisePreferences) => this.saveSetting("exercisePreferences", preferences);

	draft = () => this.setting<ClaudeDraft>(SETTINGS.draft);
	saveDraft = (draft: ClaudeDraft) => this.saveSetting(SETTINGS.draft, draft);
	clearDraft = () => this.fs.delete(settingPath(this.uid, SETTINGS.draft));

	undo = () => this.setting<ClaudeUndo>(SETTINGS.undo);
	saveUndo = (undo: ClaudeUndo) => this.saveSetting(SETTINGS.undo, undo);
	clearUndo = () => this.fs.delete(settingPath(this.uid, SETTINGS.undo));
}
