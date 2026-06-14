/**
 * Firebase Configuration — synchronous initialization
 *
 * Uses eager top-level imports so that getFirebaseAuth() returns
 * null or the Auth instance synchronously, matching the existing
 * AuthContext.jsx API (which calls it without await).
 *
 * Required env vars:
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_AUTH_DOMAIN
 *   VITE_FIREBASE_PROJECT_ID
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';

let firebaseAuth = null;
let googleProvider = null;
let initialized = false;

export function isFirebaseConfigured() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  return !!(apiKey && authDomain && projectId);
}

function ensureInit() {
  if (initialized) return;
  initialized = true;

  if (!isFirebaseConfigured()) return;

  try {
    const config = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
    };

    const app = initializeApp(config);
    firebaseAuth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
      connectAuthEmulator(firebaseAuth, 'http://localhost:9099');
    }
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
  }
}

export function getFirebaseAuth() {
  ensureInit();
  return firebaseAuth;
}

export function getGoogleProvider() {
  ensureInit();
  return googleProvider;
}
