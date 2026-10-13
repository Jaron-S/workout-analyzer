// Starter routines. Exercise ids are Hevy built-ins; reps and rest come from
// the user's defaults.

import type { Routine } from "./types";

type DayPlan = [name: string, exercises: [exerciseId: string, sets: number][]];

export interface RoutineTemplate {
	id: string;
	name: string;
	summary: string;
	daysPerWeek: number;
	days: DayPlan[];
}

const PUSH: DayPlan[1] = [
	["79D0BB3A", 3], // Bench Press (Barbell)
	["07B38369", 3], // Incline Bench Press (Dumbbell)
	["6AC96645", 3], // Overhead Press (Dumbbell)
	["BE289E45", 4], // Lateral Raise (Cable)
	["94B7239B", 3], // Triceps Rope Pushdown
	["B5EFBF9C", 2], // Overhead Triceps Extension (Cable)
];
const PULL: DayPlan[1] = [
	["1B2B1E7C", 3], // Pull Up
	["55E6546F", 3], // Bent Over Row (Barbell)
	["0393F233", 3], // Seated Cable Row - V Grip (Cable)
	["BE640BA0", 3], // Face Pull
	["01A35BF9", 3], // EZ Bar Biceps Curl
	["7E3BC8B6", 2], // Hammer Curl (Dumbbell)
];
const PULL_2: DayPlan[1] = [
	["1B2B1E7C", 3], // Pull Up
	["2EE45F81", 3], // Single Arm Lat Pulldown
	["0393F233", 3], // Seated Cable Row - V Grip (Cable)
	["C315DC2A", 3], // Rear Delt Reverse Fly (Cable)
	["01A35BF9", 3], // EZ Bar Biceps Curl
	["7E3BC8B6", 2], // Hammer Curl (Dumbbell)
];
const LEGS_2: DayPlan[1] = [
	["1E42FD5F", 3], // Hack Squat (Machine)
	["D57C2EC7", 3], // Hip Thrust (Barbell)
	["75A4F6C4", 3], // Leg Extension (Machine)
	["B8127AD1", 3], // Lying Leg Curl (Machine)
	["062AB91A", 4], // Seated Calf Raise
	["23A48484", 3], // Cable Crunch
];
const LEGS: DayPlan[1] = [
	["D04AC939", 3], // Squat (Barbell)
	["2B4B7310", 3], // Romanian Deadlift (Barbell)
	["C7973E0E", 3], // Leg Press (Machine)
	["75A4F6C4", 3], // Leg Extension (Machine)
	["11A123F3", 3], // Seated Leg Curl (Machine)
	["E05C2C38", 4], // Standing Calf Raise (Machine)
];

// Tuned so every major muscle lands between MEV and MRV against the app's
// own landmarks (checked by lib/redesign.test.ts).
export const TEMPLATES: RoutineTemplate[] = [
	{
		id: "upper-lower",
		name: "Upper / Lower",
		summary: "Four days, every muscle twice a week. A great default.",
		daysPerWeek: 4,
		days: [
			// Bench, row, pulldown, lateral raise, rear-delt fly, curl, pushdown
			["Upper A", [["79D0BB3A", 3], ["55E6546F", 3], ["6A6C31A5", 3], ["422B08F1", 4], ["C315DC2A", 3], ["37FCC2BB", 3], ["93A552C6", 3]]],
			// Squat, RDL, leg press, seated curl, standing calf, hanging leg raise
			["Lower A", [["D04AC939", 3], ["2B4B7310", 3], ["C7973E0E", 3], ["11A123F3", 3], ["E05C2C38", 4], ["F8356514", 3]]],
			// Incline DB press, pull-up, cable row, cable lateral, face pull, hammer curl, overhead extension
			["Upper B", [["07B38369", 3], ["1B2B1E7C", 3], ["0393F233", 3], ["BE289E45", 4], ["BE640BA0", 3], ["7E3BC8B6", 2], ["B5EFBF9C", 3]]],
			// Hack squat, hip thrust, leg extension, lying curl, seated calf, cable crunch
			["Lower B", [["1E42FD5F", 3], ["D57C2EC7", 3], ["75A4F6C4", 3], ["B8127AD1", 3], ["062AB91A", 4], ["23A48484", 3]]],
		],
	},
	{
		id: "ppl",
		name: "Push / Pull / Legs",
		summary: "Six days, each session focused. High volume for experienced lifters.",
		daysPerWeek: 6,
		days: [
			["Push 1", PUSH],
			["Pull 1", PULL],
			["Legs 1", LEGS],
			["Push 2", PUSH],
			["Pull 2", PULL_2],
			["Legs 2", LEGS_2],
		],
	},
	{
		id: "full-body",
		name: "Full Body",
		summary: "Three days, short sessions. Ideal when time is tight.",
		daysPerWeek: 3,
		days: [
			// Squat, bench, row, lateral raise, face pull, curl, pushdown
			["Full Body A", [["D04AC939", 3], ["79D0BB3A", 3], ["55E6546F", 3], ["422B08F1", 3], ["BE640BA0", 3], ["37FCC2BB", 3], ["93A552C6", 3]]],
			// RDL, overhead press, pulldown, leg curl, cable lateral, standing calf
			["Full Body B", [["2B4B7310", 3], ["7B8D84E8", 3], ["6A6C31A5", 3], ["11A123F3", 2], ["BE289E45", 4], ["E05C2C38", 3]]],
			// Leg press, incline DB press, cable row, rear-delt fly, hammer curl, overhead extension
			["Full Body C", [["C7973E0E", 3], ["07B38369", 3], ["0393F233", 3], ["C315DC2A", 3], ["7E3BC8B6", 3], ["B5EFBF9C", 3]]],
		],
	},
];

export function routineFromTemplate(template: RoutineTemplate): Routine {
	const stamp = Date.now().toString(36);
	return {
		id: `${template.id}-${stamp}`,
		name: template.name,
		days: template.days.map(([name, exercises], i) => ({
			id: `day-${stamp}-${i}`,
			name,
			exercises: exercises.map(([exerciseId, sets]) => ({ exerciseId, sets })),
		})),
	};
}
