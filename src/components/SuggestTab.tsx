import { motion } from 'motion/react';
import { Music, ThumbsUp, ThumbsDown } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, serverTimestamp, doc, updateDoc, increment, getDoc, setDoc, where } from 'firebase/firestore';

interface Song {
  id: string;
  title: string;
  artist: string;
  voteCount: number;
}

export default function SuggestTab() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});

  useEffect(() => {
    const q = query(collection(db, 'songs'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Song[];
      
      // Sort locally by votes descending
      fetched.sort((a, b) => b.voteCount - a.voteCount);
      setSongs(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Fetch current user's votes to disable voting twice
  useEffect(() => {
    // If we wanted perfectly persistent UX, we could listen to a collection, 
    // or just rely on local state for quick feedback.
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert("Autoryzacja nie powiodła się. Włącz Logowanie Anonimowe w Firebase by dodać piosenkę.");
      return;
    }
    if (!title.trim()) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'songs'), {
        title: title.trim(),
        artist: '',
        createdAt: serverTimestamp(),
        status: 'active',
        suggesterId: auth.currentUser.uid,
        voteCount: 0
      });
      setTitle('');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (songId: string, value: 1 | -1) => {
    if (!auth.currentUser) {
      alert("Autoryzacja nie powiodła się. Włącz Logowanie Anonimowe w Firebase.");
      return;
    }
    
    // Optimistic UI could be added here, but let's keep it simple
    try {
      const voteRef = doc(db, `songs/${songId}/votes/${auth.currentUser.uid}`);
      const voteDoc = await getDoc(voteRef);
      
      if (voteDoc.exists()) {
        const existingVal = voteDoc.data().value;
        if (existingVal === value) return; // already voted this way

        // change vote (-1 to 1 means +2)
        const diff = value - existingVal;
        await setDoc(voteRef, { userId: auth.currentUser.uid, value });
        await updateDoc(doc(db, 'songs', songId), {
          voteCount: increment(diff)
        });
      } else {
        await setDoc(voteRef, { userId: auth.currentUser.uid, value });
        await updateDoc(doc(db, 'songs', songId), {
          voteCount: increment(value)
        });
      }
      setUserVotes(prev => ({ ...prev, [songId]: value }));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 pt-10 h-full flex flex-col">
      <div className="text-center mb-8">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Dla DJ'a</span>
        <h1 className="font-serif text-4xl italic text-[#4A5D4E] mb-4">Zaproponuj Piosenkę</h1>
        <p className="text-[#555] text-sm max-w-xs mx-auto leading-relaxed">
          Przy jakiej piosence na pewno ruszysz na parkiet?
        </p>
      </div>
      
      <form 
        onSubmit={handleSubmit} 
        className="bg-white p-6 rounded-[24px] shadow-sm border border-[#EAE8E2] space-y-5 mb-8"
      >
        <div>
          <label className="block text-xs uppercase tracking-widest font-bold text-[#8C8C8C] mb-2">Tytuł i wykonawca</label>
          <input 
            type="text" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            required 
            className="w-full bg-[#FAF9F6] border border-[#EAE8E2] rounded-xl px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-[#4A5D4E] focus:border-transparent transition-all" 
            placeholder="np. ABBA - Dancing Queen" 
          />
        </div>
        
        <button 
          type="submit" 
          disabled={submitting}
          className="w-full bg-[#4A5D4E] hover:bg-[#3D4D40] text-white rounded-full py-4 font-medium flex justify-center items-center gap-2 mt-4 active:scale-95 transition-all disabled:opacity-70"
        >
          <Music size={18} />
          <span className="uppercase tracking-wide text-xs font-bold">{submitting ? 'Wysyłanie...' : 'Wyślij propozycję'}</span>
        </button>
      </form>

      {/* Lista zaproponowanych */}
      <h3 className="text-xs uppercase tracking-[0.4em] font-bold border-b-2 border-[#4A5D4E] pb-1 mb-4 inline-block">Najchętniej zamawiane</h3>
      
      <div className="space-y-3 pb-8">
        {songs.map(song => (
          <div key={song.id} className="bg-white p-4 rounded-2xl shadow-sm border border-[#EAE8E2] flex items-center justify-between">
            <div className="min-w-0 pr-4">
              <p className="font-serif italic text-lg text-[#2D2D2D] truncate">{song.title}</p>
              {song.artist && <p className="text-xs text-[#8C8C8C] uppercase tracking-wider">{song.artist}</p>}
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => handleVote(song.id, -1)}
                className={`p-1.5 rounded-full transition-colors ${userVotes[song.id] === -1 ? 'bg-red-100 text-red-600' : 'text-[#AAA] hover:bg-[#FAF9F6]'}`}
              >
                <ThumbsDown size={18} />
              </button>
              
              <span className="font-bold text-sm w-6 text-center text-[#4A5D4E]">{song.voteCount}</span>
              
              <button 
                onClick={() => handleVote(song.id, 1)}
                className={`p-1.5 rounded-full transition-colors ${userVotes[song.id] === 1 ? 'bg-[#EAE8E2] text-[#4A5D4E]' : 'text-[#AAA] hover:bg-[#FAF9F6]'}`}
              >
                <ThumbsUp size={18} />
              </button>
            </div>
          </div>
        ))}
        {songs.length === 0 && (
          <p className="text-sm text-[#8C8C8C] italic text-center py-4">Brak propozycji. Bądź pierwszą osobą!</p>
        )}
      </div>
    </motion.div>
  );
}
