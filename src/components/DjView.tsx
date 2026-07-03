import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where, doc, updateDoc } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';

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
      
      // Sort locally by votes descending, then by newest
      fetched.sort((a, b) => {
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount;
        }
        const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : Date.now();
        const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      setSongs(fetched);
    }, (error) => {
      console.error("Error fetching songs in DJ view:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (songId: string) => {
    if (!window.confirm("Na pewno chcesz usunąć tę pozycję?")) return;
    try {
      await updateDoc(doc(db, 'songs', songId), {
        status: 'deleted'
      });
    } catch (e) {
      console.error(e);
      alert("Błąd podczas usuwania. Upewnij się, że masz uprawnienia jako DJ.");
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8 font-sans text-gray-900">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 pb-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-xl font-bold">Zaproponowane piosenki</h1>
          <span className="text-xs font-medium text-gray-500 uppercase">Eliza & Miłosz</span>
        </header>

        <div className="overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-200">
                <th className="py-2 pl-2 w-8">#</th>
                <th className="py-2">Utwór / Wykonawca</th>
                <th className="py-2 text-right pr-2 w-16">Głosy</th>
                <th className="py-2 text-right pr-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song, i) => (
                <tr key={song.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-2 text-sm text-gray-400">{i + 1}</td>
                  <td className="py-3">
                    <div className="text-sm font-semibold">{song.title}</div>
                    {song.artist && <div className="text-xs text-gray-500 mt-0.5">{song.artist}</div>}
                  </td>
                  <td className="py-3 text-right pr-2 text-sm font-bold text-gray-700">
                    {song.voteCount}
                  </td>
                  <td className="py-3 text-right pr-2">
                    <button 
                      onClick={() => handleDelete(song.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Usuń propozycję"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {songs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400 text-sm">
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
