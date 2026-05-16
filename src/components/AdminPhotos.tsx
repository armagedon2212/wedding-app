import { useState, useEffect } from 'react';
import { Download, Loader2, ArrowLeft, Play, Film } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface PhotoData {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediaType?: 'image' | 'video';
}

export default function AdminPhotos() {
  const [images, setImages] = useState<PhotoData[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'photos'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhotoData[];
      
      fetched.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : 0;
        const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setImages(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const downloadAll = async () => {
    if (images.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("Weselne_Zdjecia");
      
      // We process sequentially to avoid killing the browser RAM immediately
      for (let i = 0; i < images.length; i++) {
        try {
          const response = await fetch(images[i].url);
          const blob = await response.blob();
          const ext = images[i].mediaType === 'video' ? 'mp4' : 'jpg';
          folder?.file(`wspomnienie_${i+1}.${ext}`, blob);
        } catch (e) {
          console.error("Skipped image", e);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "weselne_zdjecia.zip");
    } catch (e) {
      console.error(e);
      alert("Wystąpił błąd podczas pobierania.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-6 lg:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#8C8C8C] hover:text-[#4A5D4E] transition-colors mb-6">
            <ArrowLeft size={16} /> Wróć do aplikacji
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-[#8C8C8C] mb-2 block">Panel Pary Młodej</span>
              <h1 className="text-4xl font-serif italic text-[#4A5D4E]">Pobieranie zdjęć</h1>
            </div>
            
            <button 
              onClick={downloadAll}
              disabled={downloading || images.length === 0}
              className="inline-flex items-center gap-2 bg-[#C5A27D] text-white px-6 py-3 rounded-full hover:bg-[#b0906f] transition-all disabled:opacity-50 active:scale-95 font-bold text-sm tracking-widest uppercase"
            >
              {downloading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Pakowanie do .ZIP...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Pobierz {images.length} zdjęć w ZIP
                </>
              )}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="animate-spin text-[#C5A27D]" size={40} />
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-xl overflow-hidden shadow-sm bg-gray-100 aspect-square">
                {img.thumbnailUrl ? (
                  <img
                    src={img.thumbnailUrl}
                    className="w-full h-full object-cover"
                    alt="Podgląd"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <Film size={24} className="text-gray-400" />
                  </div>
                )}
                {img.mediaType === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <Play size={24} className="text-white opacity-90 drop-shadow-md" fill="white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-[#8C8C8C] border-2 border-dashed border-[#EAE8E2] rounded-3xl bg-[#f8f8f5]">
            <p>Jeszcze nikt nie dodał żadnego zdjęcia.</p>
          </div>
        )}
      </div>
    </div>
  );
}
