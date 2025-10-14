import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// --- Debugging Logs Start ---

// 1. Log the loaded config to check environment variables.
console.log("--- Firebase Initialization ---");
console.log("Attempting to load Firebase config...");
console.table({
	apiKeyExists: !!firebaseConfig.apiKey,
	authDomainExists: !!firebaseConfig.authDomain,
	projectIdExists: !!firebaseConfig.projectId,
});

// --- Debugging Logs End ---

let app: FirebaseApp;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Initialize Firebase only if the config is valid.
if (firebaseConfig.apiKey) {
	if (getApps().length === 0) {
		// 2. Log when a new app is being created.
		console.log("No Firebase app found. Initializing a new app...");
		app = initializeApp(firebaseConfig);
		console.log("✅ Firebase app initialized successfully.");
	} else {
		// 3. Log when using an existing app (common in Next.js hot-reloading).
		console.log(
			"Firebase app already exists. Getting existing app instance..."
		);
		app = getApps()[0];
	}
	auth = getAuth(app);
	db = getFirestore(app);
} else {
	// 4. Log a specific error if the config is missing.
	console.error(
		"🚨 Firebase config is incomplete, especially the API Key. Firebase was not initialized."
	);
}

export { auth, db };
export const isFirebaseConfigured =
	!!firebaseConfig.apiKey && getApps().length > 0;
