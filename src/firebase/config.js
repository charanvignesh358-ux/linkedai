import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDTKrs6M1D3EQOIlyDldDpH35yNI88iOHk",
  authDomain: "linkedin-6fea9.firebaseapp.com",
  projectId: "linkedin-6fea9",
  storageBucket: "linkedin-6fea9.firebasestorage.app",
  messagingSenderId: "228260778205",
  appId: "1:228260778205:web:0256a4b6d5e9115fee4b34",
  measurementId: "G-M3E8N6WK6Z",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
