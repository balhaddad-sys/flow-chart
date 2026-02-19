import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  type UserCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./client";
import { DEFAULT_PREFERENCES } from "../types/user";

const googleProvider = new GoogleAuthProvider();

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await ensureUserDoc(credential.user.uid, name, email);
  return credential;
}

export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(
      credential.user.uid,
      credential.user.displayName || "User",
      credential.user.email || ""
    );
    return credential;
  } catch (error: unknown) {
    // Fallback to redirect on popup blocked
    if (error && typeof error === "object" && "code" in error && error.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      throw error; // redirect navigates away
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  // Clear persisted chat messages and preferences from localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("medq_explore_chat") || key === "medq-active-course")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore localStorage errors (e.g., private browsing)
  }
  return firebaseSignOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

async function ensureUserDoc(uid: string, name: string, email: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      name,
      email,
      timezone: "UTC",
      preferences: DEFAULT_PREFERENCES,
      subscriptionTier: "free",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
