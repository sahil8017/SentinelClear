import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

let auth = null;
let signInWithGoogle = async () => null;
let firebaseEnabled = false;
let _initPromise = null;

// Default Firebase web config (public — security enforced by Firebase Security Rules)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAwozXT7cQcpYTfVwvkBbtm-3Ge-qzsAeg',
  authDomain: 'sentinelclear-76442.firebaseapp.com',
  projectId: 'sentinelclear-76442',
  storageBucket: 'sentinelclear-76442.firebasestorage.app',
  messagingSenderId: '442684678543',
  appId: '1:442684678543:web:b7bf39a7e3b156119f2bfa',
};

function isValidConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  for (const k of required) {
    const val = cfg[k];
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null' || trimmed.startsWith('VITE_')) {
      return false;
    }
  }
  return true;
}

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
  return isValidConfig(cfg) ? cfg : null;
}

async function loadRuntimeConfig() {
  try {
    const res = await fetch('/firebase-config.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    return isValidConfig(cfg) ? cfg : null;
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
    let cfg = configFromEnv() || (await loadRuntimeConfig());
    if (!isValidConfig(cfg)) {
      console.warn('Firebase environment/runtime config not found. Falling back to DEFAULT_FIREBASE_CONFIG.');
      cfg = DEFAULT_FIREBASE_CONFIG;
    }
    if (!isValidConfig(cfg)) {
      console.warn('Firebase web auth not configured — use email/password sign-in.');
      return;
    }
    try {
      enableFirebase(cfg);
    } catch (error) {
      console.error('Failed to initialize Firebase SDK safely:', error);
    }
  })();
  return _initPromise;
}

export const firebaseReady = initFirebase();
export { auth, signInWithGoogle, firebaseEnabled };
