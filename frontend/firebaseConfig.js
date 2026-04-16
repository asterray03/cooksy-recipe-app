// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { requireEnv } from "./config/env";

const firebaseConfig = {
    apiKey: requireEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requireEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv("EXPO_PUBLIC_FIREBASE_APP_ID"),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
