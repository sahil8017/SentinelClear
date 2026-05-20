import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
  firebaseConfig.measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
}

const requiredKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];
const missingKeys = requiredKeys.filter((k) => !firebaseConfig[k]);

let auth = null;
let signInWithGoogle = async () => null; // default no-op
let firebaseEnabled = false;

if (missingKeys.length === 0) {
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
} else {
  console.warn('Missing Firebase configuration keys:', missingKeys, '- Firebase auth disabled.');
}

export { auth, signInWithGoogle, firebaseEnabled };
