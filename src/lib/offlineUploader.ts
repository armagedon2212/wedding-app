import { openDB } from 'idb';
import { db, storage } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const DB_NAME = 'wedding_offline_db';
const STORE_NAME = 'upload_queue';

export const initOfflineDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'docId' });
      }
    },
  });
};

export const addOfflineUpload = async (docId: string, file: File, fileName: string) => {
  const db = await initOfflineDB();
  await db.put(STORE_NAME, { docId, file, fileName });
};

export const processOfflineQueue = async () => {
  if (!navigator.onLine) return;
  const offlineDb = await initOfflineDB();
  const tasks = await offlineDb.getAll(STORE_NAME);
  
  for (const task of tasks) {
    try {
      const { docId, file, fileName } = task;
      const storageRef = ref(storage, `photos/${fileName}`);
      
      const snapshot = await uploadBytesResumable(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      await updateDoc(doc(db, 'photos', docId), {
        url: downloadUrl,
        status: 'active'
      });
      
      await offlineDb.delete(STORE_NAME, docId);
    } catch (err) {
      console.error(`Błąd przesyłania pliku z kolejki offline (docId: ${task.docId}):`, err);
    }
  }
};
