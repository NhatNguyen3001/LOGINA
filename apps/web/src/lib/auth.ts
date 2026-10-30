import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';

const auth = getAuth(
  initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }),
);

let pending: Promise<void> | null = null;

/** One anonymous session per browser. Waits for persistence first, so two tabs share it. */
export function ensureSession(): Promise<void> {
  pending ??= (async () => {
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
  })().finally(() => {
    pending = null;
  });
  return pending;
}

export async function idToken(): Promise<string> {
  await ensureSession();
  return auth.currentUser!.getIdToken();
}

export async function renewSession(): Promise<void> {
  await signOut(auth);
  await ensureSession();
}
