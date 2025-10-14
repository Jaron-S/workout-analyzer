import { collection, doc, setDoc, getDoc, getDocs } from "firebase/firestore"
import { db } from "./firebase-config"
import type { Routine, PriorityTier } from "./types"

export async function saveRoutineToFirebase(userId: string, routine: Routine) {
  if (!db) throw new Error("Firebase not configured")

  const routineRef = doc(db, "users", userId, "routines", routine.id)
  await setDoc(routineRef, {
    ...routine,
    updatedAt: new Date().toISOString(),
  })
}

export async function getRoutinesFromFirebase(userId: string): Promise<Routine[]> {
  if (!db) throw new Error("Firebase not configured")

  const routinesRef = collection(db, "users", userId, "routines")
  const snapshot = await getDocs(routinesRef)

  return snapshot.docs.map((doc) => doc.data() as Routine)
}

export async function savePrioritiesToFirebase(userId: string, priorities: Partial<Record<PriorityTier, string[]>>) {
  if (!db) throw new Error("Firebase not configured")

  const prioritiesRef = doc(db, "users", userId, "settings", "priorities")
  await setDoc(prioritiesRef, {
    priorities,
    updatedAt: new Date().toISOString(),
  })
}

export async function getPrioritiesFromFirebase(userId: string): Promise<Partial<Record<PriorityTier, string[]>>> {
  if (!db) throw new Error("Firebase not configured")

  const prioritiesRef = doc(db, "users", userId, "settings", "priorities")
  const snapshot = await getDoc(prioritiesRef)

  return snapshot.exists() ? (snapshot.data().priorities as Partial<Record<PriorityTier, string[]>>) : {}
}
