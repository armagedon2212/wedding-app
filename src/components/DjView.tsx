import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trash2, Music } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';

interface Song {
  id: string;
  title: string;
  artist: string;
  voteCount: number;
}

export default function DjView() {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    // DJ Should see all active songs sorted by voteCount
    const q = query(collection(db, 'songs'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Song[];
      
      // Sort locally
      fetched.sort((a, b) => b.voteCount - a.voteCount);
      setSongs(fetched);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (songId: string) => {
    if (!window.confirm("Na pewno chcesz usunąć tę propozycję?")) return;
    if (!auth.currentUser) return;
    
    try {
      await updateDoc(doc(db, 'songs', songId), {
        status: 'deleted'
      });
    } catch (e) {
      console.error(e);
      alert("Błąd podczas usuwania. Upewnij się że masz połączenie z siecią.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-6 lg:p-12 font-sans text-[#2D2D2D]">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-baseline gap-4 border-b border-[#EAE8E2] pb-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Panel Sterowania</span>
            <h1 className="font-serif text-4xl italic text-[#4A5D4E] flex items-center gap-3">
              <Music className="text-[#C5A27D]" size={32} />
              DJ Playlist
            </h1>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-widest font-bold text-[#8C8C8C]">Eliza & Miłosz</span>
          </div>
        </header>

        <div className="bg-white rounded-3xl shadow-xl border border-[#EEE] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#fcfbf9] border-b border-[#EAE8E2] text-xs uppercase tracking-widest text-[#8C8C8C]">
                <th className="px-6 py-4 font-bold">Pozycja</th>
                <th className="px-6 py-4 font-bold">Utwór</th>
                <th className="px-6 py-4 font-bold text-center">Głosy</th>
                <th className="px-6 py-4 font-bold text-right">Akcja</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, i) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={song.id} 
                  className="border-b border-[#EAE8E2] hover:bg-[#FAF9F6] transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-sm text-[#8C8C8C]">#{i + 1}</td>
                  <td className="px-6 py-4">
                    <div className="font-serif italic text-lg">{song.title}</div>
                    {song.artist && <div className="text-xs font-medium uppercase tracking-wider text-[#555] mt-1">{song.artist}</div>}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center bg-[#EAE8E2] text-[#4A5D4E] font-bold text-sm w-8 h-8 rounded-full">
                      {song.voteCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(song.id)}
                      className="text-[#AAA] hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                      title="Usuń propozycję"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {songs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#8C8C8C] italic">
                    Nikt jeszcze nie zaproponował żadnej piosenki.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
