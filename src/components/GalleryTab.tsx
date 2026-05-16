import React, { useRef, useState, useEffect } from 'react';
import { Camera, Download, Loader2, X, Play, Image as ImageIcon, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface PhotoData {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediaType?: 'image' | 'video';
}

export default function GalleryTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PhotoData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'photos'|'videos'>('photos');
  
  const filteredMedia = images.filter(img => activeTab === 'photos' ? (!img.mediaType || img.mediaType === 'image') : img.mediaType === 'video');
  const selectedImage = selectedIndex !== null ? filteredMedia[selectedIndex] : null;

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = selectedImage?.mediaType === 'video' ? 'mp4' : 'jpg';
      a.download = `wspomnienie_weselne_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Direct download failed", e);
      window.open(url, '_blank');
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    if (selectedIndex === null) return;
    if (info.offset.x > 50 && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (info.offset.x < -50 && selectedIndex < filteredMedia.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'photos'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhotoData[];
      
      // Sort in JS instead of Firestore to avoid composite index requirement
      fetched.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : 0;
        const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setImages(fetched);
    });
    return () => unsubscribe();
  }, []);

  const resizeImage = (file: File, maxWidth: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = maxWidth;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, video.duration / 2 || 0);
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        let width = video.videoWidth;
        let height = video.videoHeight;
        const max_size = 600;
        
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, width, height);
        URL.revokeObjectURL(video.src);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(''); // empty thumbnail fallback
      };
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!auth.currentUser) {
      alert("Autoryzacja nie powiodła się. Włącz Logowanie Anonimowe (Anonymous) w ustawieniach Authentication w Firebase, aby dodać pliki.");
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      setUploading(true);
      
      for (const file of files) {
        try {
          const isVideo = file.type.startsWith('video/');
          let thumbnailBase64 = '';
          
          if (isVideo) {
             thumbnailBase64 = await generateVideoThumbnail(file);
          } else {
             thumbnailBase64 = await resizeImage(file, 600);
          }
          
          const fileName = `${Date.now()}_${file.name}`;
          const storageRef = ref(storage, `photos/${fileName}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          await new Promise<void>((resolve, reject) => {
             uploadTask.on('state_changed', 
                null, 
                error => reject(error),
                async () => {
                   try {
                     const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                     await addDoc(collection(db, 'photos'), {
                       url: downloadUrl,
                       thumbnailUrl: thumbnailBase64,
                       mediaType: isVideo ? 'video' : 'image',
                       createdAt: serverTimestamp(),
                       status: 'active',
                       uploaderId: auth.currentUser!.uid
                     });
                     resolve();
                   } catch (err) {
                     reject(err);
                   }
                }
             );
          });
          
        } catch (error: any) {
          console.error("Error uploading file", file.name, error);
          if (error.code === 'storage/unauthorized') {
            alert("Brak uprawnień. Upewnij się, że Firebase Storage jest włączone i ma odpowiednie Security Rules (np. allow read, write;).");
            break; // Stop uploading more if unauthorized
          }
        }
      }
      
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-8">
        {/* Header Section */}
        <header className="pt-8 px-6 flex justify-between items-baseline mb-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-1">Wydarzenie</span>
            <h1 className="text-3xl font-serif italic text-[#4A5D4E]">Eliza & Miłosz</h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-1">Data</span>
            <p className="text-sm font-medium">DZISIAJ</p>
          </div>
        </header>

        {/* Hero Section */}
        <section className="px-6 mb-10">
          <h2 className="text-5xl font-serif leading-[0.95] tracking-tight mb-4 text-[#2D2D2D]">
            Uwiecznij <br/><span className="text-[#C5A27D] italic">Wspomnienia</span>
          </h2>
          <p className="text-[#555] max-w-md mb-6 leading-relaxed text-sm">
            Twoje zdjęcia i filmy to najpiękniejszy prezent. Wrzuć je do naszej wspólnej galerii w pełnej jakości!
          </p>

          <input 
            type="file" 
            accept="image/*,video/*"
            multiple 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleUpload} 
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="group relative inline-flex items-center gap-4 bg-[#4A5D4E] text-white px-8 py-4 rounded-full hover:bg-[#3D4D40] transition-all disabled:opacity-70 disabled:scale-100 active:scale-95"
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Camera size={20} />
            )}
            <span className="text-sm font-bold tracking-widest uppercase">
              {uploading ? 'Wysyłanie...' : 'Dodaj Pliki'}
            </span>
          </button>
        </section>

        {/* Gallery Section */}
        <div className="px-6 mt-8">
          <div className="flex justify-start gap-6 items-center mb-6 border-b border-[#EAE8E2]">
             <button
                onClick={() => setActiveTab('photos')}
                className={`text-xs uppercase tracking-[0.2em] font-bold pb-3 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'photos' ? 'border-[#4A5D4E] text-[#4A5D4E]' : 'border-transparent text-[#8C8C8C] hover:text-[#4A5D4E]'}`}
             >
                <ImageIcon size={16} /> Zdjęcia
             </button>
             <button
                onClick={() => setActiveTab('videos')}
                className={`text-xs uppercase tracking-[0.2em] font-bold pb-3 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'videos' ? 'border-[#4A5D4E] text-[#4A5D4E]' : 'border-transparent text-[#8C8C8C] hover:text-[#4A5D4E]'}`}
             >
                <Film size={16} /> Filmy
             </button>
          </div>
          
          {filteredMedia.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 h-full">
              {filteredMedia.map((img, idx) => (
                <div 
                  key={img.id} 
                  className="relative group rounded-xl overflow-hidden shadow-sm bg-gray-100 aspect-square cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => setSelectedIndex(idx)}
                >
                  {img.thumbnailUrl ? (
                     <img
                       src={img.thumbnailUrl}
                       className="w-full h-full object-cover"
                       alt="Wspomnienie weselne"
                       loading="lazy"
                     />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center bg-gray-200">
                       <Film size={24} className="text-gray-400" />
                     </div>
                  )}
                  {img.mediaType === 'video' && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <Play size={32} className="text-white opacity-90 drop-shadow-md" fill="white" />
                     </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 py-16 flex flex-col items-center justify-center text-center text-[#8C8C8C] border-2 border-dashed border-[#EAE8E2] rounded-2xl bg-[#f8f8f5]">
              {activeTab === 'photos' ? <Camera size={40} className="mb-3 opacity-20" /> : <Film size={40} className="mb-3 opacity-20" />}
              <p className="text-sm">Brak elementów. Bądź pierwszą osobą,<br />która doda coś w tej kategorii!</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Fullscreen Photo/Video Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
          >
            <div className="flex justify-between items-center p-4">
              <button 
                onClick={() => setSelectedIndex(null)}
                className="text-white p-2 rounded-full bg-white/10 active:scale-95 transition-transform"
              >
                <X size={24} />
              </button>
              <button 
                onClick={() => handleDownload(selectedImage.url)}
                className="text-white flex items-center gap-2 p-2 px-4 rounded-full bg-[#4A5D4E] active:scale-95 font-bold text-sm transition-transform"
              >
                <Download size={18} />
                Pobierz
              </button>
            </div>
            
            <div className="flex-1 w-full flex items-center justify-center p-4 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {selectedImage.mediaType === 'video' ? (
                   <motion.video
                      key={selectedImage.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      src={selectedImage.url}
                      className="max-w-full max-h-full object-contain"
                      controls
                      autoPlay
                      playsInline
                   />
                ) : (
                   <motion.img
                     key={selectedImage.id}
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     transition={{ duration: 0.2 }}
                     drag="x"
                     dragConstraints={{ left: 0, right: 0 }}
                     dragElastic={0.8}
                     onDragEnd={handleDragEnd}
                     src={selectedImage.url}
                     className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
                     alt="Wspomnienie weselne"
                   />
                )}
              </AnimatePresence>
            </div>
            <div className="pb-8 pt-4 text-center text-white/50 text-xs tracking-wider uppercase">
              {selectedIndex! + 1} z {filteredMedia.length} 
              {selectedImage.mediaType !== 'video' && " • Przesuń palcem w bok"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
