import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const loadServiceAccount = () => {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (fromEnv) {
    return JSON.parse(fromEnv);
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebaseKey.json";
  return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
};

const serviceAccount = loadServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

export { admin, db };
