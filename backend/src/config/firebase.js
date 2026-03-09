import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const firebaseProjectId = requiredEnv("FIREBASE_PROJECT_ID");
const firebaseClientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
const firebasePrivateKey = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: firebaseProjectId,
    clientEmail: firebaseClientEmail,
    privateKey: firebasePrivateKey,
  }),
});

const db = admin.firestore();

export { admin, db };
