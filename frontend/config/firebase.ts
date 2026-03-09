import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const required = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const firebaseConfig = {
  apiKey: required("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: required("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: required("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: required("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: required("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: required("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
