import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

async function main() {
  console.log("Starting Firebase Database Cleanup script...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

  // 1. Songs Collection & nested Votes Collection
  console.log("Fetching songs collection...");
  const songsColl = collection(db, "songs");
  const songsSnap = await getDocs(songsColl);
  console.log(`Found ${songsSnap.size} songs.`);
  
  for (const songDoc of songsSnap.docs) {
    const songId = songDoc.id;
    console.log(`Checking subcollections for song ${songId}...`);
    
    const votesColl = collection(db, `songs/${songId}/votes`);
    const votesSnap = await getDocs(votesColl);
    for (const voteDoc of votesSnap.docs) {
      console.log(`Deleting nested vote ${voteDoc.id} for song ${songId}...`);
      await deleteDoc(voteDoc.ref);
    }
    
    console.log(`Deleting song document ${songId}...`);
    await deleteDoc(songDoc.ref);
  }

  // 2. Photos/Videos Collection
  console.log("Fetching photos/videos collection...");
  const photosColl = collection(db, "photos");
  const photosSnap = await getDocs(photosColl);
  console.log(`Found ${photosSnap.size} photos.`);
  
  for (const photoDoc of photosSnap.docs) {
    console.log(`Deleting photo document ${photoDoc.id}...`);
    await deleteDoc(photoDoc.ref);
  }

  console.log("Database cleanup successfully finished! All matching entities removed.");
}

main().catch((err) => {
  console.error("Cleanup error:", err);
});
