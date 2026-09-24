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

let app: FirebaseApp;
let auth: Auth | null = null;
let db: Firestore | null = null;

// Initialize Firebase only if the config is valid.
if (firebaseConfig.apiKey) {
	// getApps() is checked so Next.js hot-reloading reuses the existing app.
	app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
	auth = getAuth(app);
	db = getFirestore(app);
} else if (process.env.NODE_ENV === "development") {
	// Not an error: without Firebase the app runs in guest mode and persists
	// to localStorage. See .env.example to enable accounts and sync.
	console.info(
		"Firebase env vars not set - running in guest mode (localStorage only)."
	);
}

export { auth, db };
export const isFirebaseConfigured =
	!!firebaseConfig.apiKey && getApps().length > 0;
