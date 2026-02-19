import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FIREBASE_ERROR_MAP: Record<string, string> = {
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Try again or reset it.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
  "auth/invalid-credential": "Invalid email or password. Please try again.",
};

export function humanizeAuthError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (FIREBASE_ERROR_MAP[code]) return FIREBASE_ERROR_MAP[code];
  }
  if (error instanceof Error) {
    // Strip "Firebase: Error (auth/xxx)." pattern
    const match = error.message.match(/\(auth\/([^)]+)\)/);
    if (match && FIREBASE_ERROR_MAP[`auth/${match[1]}`]) {
      return FIREBASE_ERROR_MAP[`auth/${match[1]}`];
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
