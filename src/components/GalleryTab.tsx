import React, { useRef, useState, useEffect } from 'react';
import { Camera, Download, Loader2, X, Play, Image as ImageIcon, Film, Trash2, Lock, Sparkles, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, serverTimestamp, where, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface PhotoData {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediaType?: 'image' | 'video';
  uploaderId?: string;
}

// Wedding unlocks on Saturday, July 4th at 12:00 PM
const WEDDING_UNLOCK_TIME = new Date('2026-07-04T12:00:00').getTime();

// Custom Animated Counter component for that smooth pop-roll scale animation on upload!
function AnimatedCounter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center justify-center font-mono font-bold text-xl text-[#4A5D4E]">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: 6, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -6, opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 350, damping: 18 }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="text-[#8C8C8C] text-sm ml-1.5 font-medium">/ 25</span>
    </span>
  );
}

export default function GalleryTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PhotoData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'photos'|'videos'>('photos');
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  
  // Real-time checks for the release countdown
  const [isUnlocked, setIsUnlocked] = useState(Date.now() >= WEDDING_UNLOCK_TIME);
  const [countdownText, setCountdownText] = useState('');
  const [showLockDetails, setShowLockDetails] = useState(false);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Countdown timer loop
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (now >= WEDDING_UNLOCK_TIME) {
        setIsUnlocked(true);
        setCountdownText('');
        return;
      }
      setIsUnlocked(false);
      const diff = WEDDING_UNLOCK_TIME - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      setCountdownText(parts.join(' '));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Filter out which media is rendered depending on photos/videos tab
  const filteredMedia = images.filter(img => 
    activeTab === 'photos' 
      ? (!img.mediaType || img.mediaType === 'image') 
      : img.mediaType === 'video'
  );

  // In order to only slider-zoom into accessible (own or unlocked) media:
  const zoomableMedia = filteredMedia.filter(img => 
    isUnlocked || currentUser?.uid === img.uploaderId
  );

  // Determine current active detail image based on accessible index
  const selectedImage = selectedIndex !== null ? zoomableMedia[selectedIndex] : null;

  // Count user's own uploads
  const ownPhotos = images.filter(img => img.uploaderId === currentUser?.uid);
  const ownCount = ownPhotos.length;

  const handleDownload = async (url: string) => {
    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write("<div style='font-family: sans-serif; padding: 20px;'>Przygotowywanie pliku do pobrania...</div>");
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Błąd sieci / CORS');
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
      
      if (newTab) newTab.close(); 
    } catch (e) {
      console.error("Direct download failed", e);
      if (newTab) {
        newTab.location.href = url;
      } else {
        alert("Proszę odblokować wyskakujące okienka (pop-up), aby pobrać plik.");
      }
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    if (selectedIndex === null) return;
    if (info.offset.x > 50 && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (info.offset.x < -50 && selectedIndex < zoomableMedia.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleDelete = async (photo: PhotoData) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten element?")) return;
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        status: 'deleted'
      });
      if (selectedImage?.id === photo.id) {
        setSelectedIndex(null);
      }
    } catch (e) {
      console.error(e);
      alert("Błąd podczas usuwania. Upewnij się, że jesteś autorem tego pliku.");
    }
  };

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
      
      const fallbackTimeout = setTimeout(() => {
        clearTimeout(fallbackTimeout);
        resolve(''); 
      }, 3000);

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, video.duration / 2 || 0);
      };
      
      video.onseeked = () => {
        clearTimeout(fallbackTimeout);
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
        clearTimeout(fallbackTimeout);
        URL.revokeObjectURL(video.src);
        resolve(''); 
      };

      video.src = URL.createObjectURL(file);
      video.load();
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) {
      alert("Autoryzacja nie powiodła się. Włącz Logowanie Anonimowe (Anonymous) w ustawieniach Authentication w Firebase, aby dodać pliki.");
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      
      // Calculate remaining slots against 25 limit
      const remainingSlots = 25 - ownCount;
      if (remainingSlots <= 0) {
        alert("Osiągnąłeś już maksymalny limit 25 dodanych zdjęć i filmów. Dziękujemy za uwiecznienie pięknych chwil!");
        return;
      }

      let filesToUpload = files;
      if (files.length > remainingSlots) {
        alert(`Wybrałeś ${files.length} plików, ale Twój pozostały limit to ${remainingSlots}. Prześlemy tylko pierwsze ${remainingSlots} plików.`);
        filesToUpload = files.slice(0, remainingSlots);
      }

      setUploading(true);
      
      for (const file of filesToUpload) {
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
                       uploaderId: currentUser.uid
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
            break; 
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
        <header className="pt-8 px-6 flex justify-between items-baseline mb-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-1">Wydarzenie</span>
            <h1 className="text-3xl font-serif italic text-[#4A5D4E]">Eliza & Miłosz</h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-1">Data</span>
            <p className="text-sm font-medium text-[#4A5D4E]">3 LIPCA</p>
          </div>
        </header>

        {/* Upload limit tracker box */}
        <section className="px-6 mb-8">
          <div className="bg-white rounded-3xl p-5 border border-[#EAE8E2] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-[#8C8C8C]">
                Twój licznik wspomnień
              </span>
              <AnimatedCounter value={ownCount} />
            </div>
            
            {/* Soft-green progress bar with animated layout */}
            <div className="relative h-2.5 w-full bg-[#FAF9F6] rounded-full overflow-hidden border border-[#eaeaea] mb-4">
              <motion.div 
                className="h-full bg-linear-to-r from-[#C5A27D] to-[#4A5D4E]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (ownCount / 25) * 100)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>

            <div className="flex justify-between items-start gap-4">
              <p className="text-[#666] text-xs leading-relaxed max-w-[200px]">
                {ownCount >= 25 
                  ? "Dziękujemy! Osiągnąłeś pełny limit 25 udostępnionych ujęć."
                  : `Możesz dodać jeszcze ${25 - ownCount} zdjęć lub filmów weselnych.`
                }
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
                disabled={uploading || ownCount >= 25}
                className="shrink-0 group relative inline-flex items-center gap-2 bg-[#4A5D4E] disabled:bg-gray-200 text-white disabled:text-gray-400 px-4 py-2.5 rounded-full hover:bg-[#3D4D40] transition-all disabled:scale-100 disabled:opacity-80 active:scale-95 text-xs font-bold tracking-wider uppercase shadow-xs cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Camera size={14} />
                )}
                <span>{uploading ? 'Wysyłam...' : 'Dodaj'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Lock Notification Banner */}
        {!isUnlocked && (
          <section className="px-6 mb-6">
            <div 
              onClick={() => setShowLockDetails(true)}
              className="bg-[#FAF6EE] text-[#A67C52] border border-[#F3E7D5] rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs font-medium cursor-pointer hover:bg-[#F6EFE3] active:scale-[0.99] transition-all shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <Lock size={15} className="shrink-0 text-[#C5A27D]" />
                <span>Zdjęcia innych gości są rozmyte i czekają na wielką premierę!</span>
              </div>
              <div className="flex items-center gap-1 font-mono font-bold shrink-0 bg-white/70 px-2.5 py-1 rounded-lg text-[10px] text-[#8A633D] border border-white">
                <Clock size={11} />
                {countdownText || 'Wkrótce'}
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Header & Tab Section */}
        <div className="px-6 mt-4">
          <h2 className="text-4xl font-serif leading-[0.95] tracking-tight mb-6 text-[#2D2D2D]">
            Wspólna <span className="text-[#C5A27D] italic">Galeria</span>
          </h2>

          <div className="flex justify-start gap-6 items-center mb-6 border-b border-[#EAE8E2]">
             <button
                onClick={() => setActiveTab('photos')}
                className={`text-xs uppercase tracking-[0.2em] font-bold pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${activeTab === 'photos' ? 'border-[#4A5D4E] text-[#4A5D4E]' : 'border-transparent text-[#8C8C8C] hover:text-[#4A5D4E]'}`}
             >
                <ImageIcon size={16} /> Zdjęcia
             </button>
             <button
                onClick={() => setActiveTab('videos')}
                className={`text-xs uppercase tracking-[0.2em] font-bold pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${activeTab === 'videos' ? 'border-[#4A5D4E] text-[#4A5D4E]' : 'border-transparent text-[#8C8C8C] hover:text-[#4A5D4E]'}`}
             >
                <Film size={16} /> Filmy
             </button>
          </div>
          
          {filteredMedia.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 h-full">
              {filteredMedia.map((img) => {
                const isOwner = currentUser?.uid === img.uploaderId;
                const isLocked = !isOwner && !isUnlocked;
                
                return (
                  <div 
                    key={img.id} 
                    className="relative group rounded-xl overflow-hidden shadow-xs bg-gray-100 aspect-square cursor-pointer active:scale-[0.98] transition-transform select-none"
                    onClick={() => {
                      if (isLocked) {
                        setShowLockDetails(true);
                      } else {
                        // Find the index of this item in the zoomable media array
                        const zoomIdx = zoomableMedia.findIndex(z => z.id === img.id);
                        if (zoomIdx !== -1) {
                          setSelectedIndex(zoomIdx);
                        }
                      }
                    }}
                  >
                    {/* Blurred thumbnail if from another user during the 24h cooldown */}
                    {img.thumbnailUrl ? (
                       <img
                         src={img.thumbnailUrl}
                         className={`w-full h-full object-cover transition-all duration-300 ${isLocked ? 'blur-md opacity-50 scale-105 pointer-events-none' : ''}`}
                         alt="Wspomnienie weselne"
                         loading="lazy"
                       />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center bg-gray-200">
                         <Film size={24} className="text-gray-400" />
                       </div>
                    )}

                    {img.mediaType === 'video' && !isLocked && (
                       <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <Play size={32} className="text-white opacity-90 drop-shadow-md" fill="white" />
                       </div>
                    )}
                    
                    {/* Glass lock overlay for locked pictures */}
                    {isLocked ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 backdrop-blur-[0.5px]">
                        <div className="bg-white/80 p-2.5 rounded-full shadow-xs border border-white/40 text-[#C5A27D]">
                          <Lock size={15} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-[#8A633D] mt-2 bg-[#FAF6EE]/90 border border-[#F3E7D5] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock size={10} />
                          {countdownText || 'Wkrótce'}
                        </span>
                      </div>
                    ) : isOwner ? (
                      <>
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-[#4A5D4E]/85 backdrop-blur-xs rounded text-[9px] uppercase font-bold tracking-wider text-white">
                          Twój plik
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(img);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 py-16 flex flex-col items-center justify-center text-center text-[#8C8C8C] border-2 border-dashed border-[#EAE8E2] rounded-3xl bg-[#f8f8f5]">
              {activeTab === 'photos' ? <Camera size={40} className="mb-3 opacity-20" /> : <Film size={40} className="mb-3 opacity-20" />}
              <p className="text-sm">Brak elementów. Bądź pierwszą osobą,<br />która doda coś w tej kategorii!</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Lock Information Dialog */}
      <AnimatePresence>
        {showLockDetails && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-6"
            onClick={() => setShowLockDetails(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-6 text-center border border-[#EAE8E2] shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowLockDetails(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 bg-gray-100 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 bg-[#FAF6EE] border border-[#F3E7D5] text-[#C5A27D] rounded-full flex items-center justify-center mx-auto mb-4 mt-2">
                <Lock size={24} />
              </div>

              <h3 className="font-serif text-2xl text-[#2D2D2D] mb-3">Magiczna Niespodzianka</h3>
              
              <p className="text-[#666] text-sm leading-relaxed mb-6">
                Chcemy, aby pierwsze godziny po ślubie były dla Was i dla nas czasem pełnym bliskości i odpoczynku. Zdjęcia i filmy innych gości ujrzą światło dzienne i zostaną w pełni odblokowane dla wszystkich już 4 lipca o godzinie 12:00!
              </p>

              <div className="bg-[#FAF9F6] border border-[#EAE8E2] rounded-2xl p-4 mb-6">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8C8C8C] block mb-1">
                  Wielkie Odblokowanie Nastąpi
                </span>
                <p className="text-sm font-semibold text-[#4A5D4E] mb-2 font-serif italic">
                  Sobota, 4 lipca, godz. 12:00
                </p>
                {countdownText && (
                  <div className="inline-flex items-center gap-2 bg-[#FAF6EE] text-[#A67C52] border border-[#F3E7D5] font-mono font-bold text-xs px-3 py-1 rounded-full text-[11px]">
                    <Clock size={12} />
                    Pozostało: {countdownText}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowLockDetails(false)}
                className="w-full bg-[#4A5D4E] text-white py-3.5 rounded-full font-bold uppercase tracking-wider text-xs hover:bg-[#3D4D40] transition-colors active:scale-95 cursor-pointer shadow-xs"
              >
                Czekam z niecierpliwością!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Photo/Video Modal (Swiper-Lightbox) */}
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
              <div className="flex items-center gap-2">
                {currentUser?.uid === selectedImage.uploaderId && (
                  <button 
                    onClick={() => handleDelete(selectedImage)}
                    className="text-white flex items-center justify-center p-2 rounded-full bg-red-500/85 hover:bg-red-500 active:scale-95 transition-transform cursor-pointer"
                    title="Usuń"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button 
                  onClick={() => handleDownload(selectedImage.url)}
                  className="text-white flex items-center gap-2 p-2 px-4 rounded-full bg-[#4A5D4E] active:scale-95 font-bold text-sm transition-transform cursor-pointer"
                >
                  <Download size={18} />
                  Pobierz
                </button>
              </div>
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
              {selectedIndex! + 1} z {zoomableMedia.length} 
              {selectedImage.mediaType !== 'video' && " • Przesuń palcem w bok"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
