import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple auth wrapper
export const initAuth = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error: any) {
    console.error("Auth error", error);
    if (error.code === 'auth/admin-restricted-operation') {
      console.warn("Logowanie anonimowe jest wyłączone w Firebase. Włącz je w konsoli, aby goście mogli wrzucać zdjęcia bez konta Google.");
    }
  }
};
