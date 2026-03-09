// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const required = (key) => {
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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
