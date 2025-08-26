// Firebase initialization and exports
// Uses Vite env variables (prefix VITE_) set in .env files

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
} as const;

function validateConfig(cfg: typeof config) {
  // measurementId is optional (Analytics)
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
  const missing = requiredKeys.filter((k) => (cfg as any)[k] === undefined || (cfg as any)[k] === null || (cfg as any)[k] === '');
  if (missing.length) {
    // Only warn in development
    if (import.meta.env.DEV) {
      console.warn(
        '[firebase] Missing env vars:', missing.join(', '),
        '\nAdd them to your .env.local as VITE_FIREBASE_* and restart the dev server.'
      );
    }
  }
}

validateConfig(config);

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);

// Initialize Firebase services
export const firebaseApp = app;
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);

export default app;
