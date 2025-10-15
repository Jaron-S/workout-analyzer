"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import {
  type User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail, // Import the password reset function
} from "firebase/auth"
import { auth, isFirebaseConfigured } from "./firebase-config"

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void> // Add to the type
  isConfigured: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  sendPasswordReset: async () => {}, // Add a default empty function
  isConfigured: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase not configured")
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase not configured")
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    if (!auth) throw new Error("Firebase not configured")
    await firebaseSignOut(auth)
  }

  // Implement the password reset function
  const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error("Firebase not configured")
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        sendPasswordReset, // Provide the function
        isConfigured: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)