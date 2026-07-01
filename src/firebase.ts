import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);

// Zamiast getFirestore(app) używamy initializeFirestore z persistentLocalCache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple auth wrapper
export const initAuth = () => {
  return new Promise((resolve, reject) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        try {
          const userCredential = await signInAnonymously(auth);
          resolve(userCredential.user);
        } catch (error: any) {
          console.error("Auth error", error);
          if (error.code === 'auth/admin-restricted-operation') {
            console.warn("Logowanie anonimowe jest wyłączone w Firebase. Włącz je w konsoli, aby goście mogli wrzucać zdjęcia bez konta Google.");
          }
          resolve(null);
        }
      }
    }, reject);
  });
};
