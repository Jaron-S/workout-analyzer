/**
 * Go-to hypertrophy movements per muscle (Hevy ids), best first. Suggestions
 * lead with these; anything else that trains the muscle follows.
 */
export const STAPLES: Record<string, string[]> = {
	Chest: ["3601968B", "07B38369", "79D0BB3A", "651F844C", "7EB3F7C3", "78683336"],
	"Side Delts": ["422B08F1", "BE289E45", "D5D0354D", "DE68C825"],
	"Front Delts": ["878CD1D0", "7B8D84E8", "9237BAD1"],
	"Rear Delts": ["C315DC2A", "D8281C62", "BE640BA0", "E5988A0A"],
	Lats: ["6A6C31A5", "1B2B1E7C", "2EE45F81", "F1E57334", "29083183"],
	"Middle Back": ["0393F233", "914F3A96", "08A2974E", "55E6546F"],
	Traps: ["ABEC557F", "0B841777", "19A38071"],
	"Lower Back": ["4F5866F8", "091737FA"],
	Biceps: ["37FCC2BB", "8BAB2735", "1E9A6B8E", "ADA8623C", "01A35BF9", "7E3BC8B6"],
	Triceps: ["93A552C6", "B5EFBF9C", "94B7239B", "68F8A292"],
	Forearms: ["95F2E076", "D8460FA6", "0E4523F4"],
	Quads: ["75A4F6C4", "C7973E0E", "1E42FD5F", "D04AC939", "B5D3A742"],
	Hamstrings: ["11A123F3", "B8127AD1", "2B4B7310", "72CFFAD5"],
	Glutes: ["D57C2EC7", "68CE0B9B", "CBA02382", "8C331CD8"],
	Calves: ["E05C2C38", "062AB91A", "91237BDD"],
	Abs: ["23A48484", "F8356514", "EB43ADD4", "99D5F10E"],
	Adductors: ["8BEBFED6", "22578A94"],
	Abductors: ["F4B4C6EE", "C469EA70"],
	Neck: ["31B8DA0F", "D6A73CF2"],
};

/** Every staple id, for search to favour. */
export const STAPLE_IDS = new Set(Object.values(STAPLES).flat());

/** Each staple's position in its muscle's list (0 = the go-to choice). */
export const STAPLE_RANK = new Map(Object.values(STAPLES).flatMap((ids) => ids.map((id, i) => [id, i] as const)));
