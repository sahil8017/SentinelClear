import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

let auth = null;
let signInWithGoogle = async () => null;
let firebaseEnabled = false;
let _initPromise = null;

function configFromEnv() {
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    cfg.measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  }
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  if (required.some((k) => !cfg[k])) return null;
  return cfg;
}

async function loadRuntimeConfig() {
  try {
    const res = await fetch('/firebase-config.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    if (required.some((k) => !cfg[k])) return null;
    return cfg;
  } catch {
    return null;
  }
}

function enableFirebase(firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return { user: result.user, idToken };
    } catch (error) {
      console.error('Firebase Auth Error:', error);
      throw error;
    }
  };
  firebaseEnabled = true;
}

export async function initFirebase() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const cfg = configFromEnv() || (await loadRuntimeConfig());
    if (!cfg) {
      console.warn('Firebase web auth not configured — use email/password sign-in.');
      return;
    }
    enableFirebase(cfg);
  })();
  return _initPromise;
}

export const firebaseReady = initFirebase();
export { auth, signInWithGoogle, firebaseEnabled };
