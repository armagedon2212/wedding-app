import React, { useRef, useState, useEffect } from 'react';
import { Camera, Download, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface PhotoData {
  id: string;
  url: string;
  thumbnailUrl: string;
}

export default function GalleryTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PhotoData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `zdjecie_weselne_${Date.now()}.jpg`;
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
    } else if (info.offset.x < -50 && selectedIndex < images.length - 1) {
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
        const img = new Image();
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!auth.currentUser) {
      alert("Autoryzacja nie powiodła się. Włącz Logowanie Anonimowe (Anonymous) w ustawieniach Authentication w Firebase, aby dodać zdjęcie.");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      
      try {
        // Create thumbnail
        const thumbnailBase64 = await resizeImage(file, 600);
        
        // Upload original
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `photos/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        uploadTask.on('state_changed', 
          null, 
          (error) => {
            console.error("Storage Error:", error);
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (error.code === 'storage/unauthorized') {
              alert("Brak uprawnień. Upewnij się, że Firebase Storage jest włączone i ma odpowiednie Security Rules (np. allow read, write;).");
            } else {
              alert(`Błąd podczas przesyłania zdjęcia: ${error.message}`);
            }
          }, 
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              
              await addDoc(collection(db, 'photos'), {
                url: downloadUrl,
                thumbnailUrl: thumbnailBase64,
                createdAt: serverTimestamp(),
                status: 'active',
                uploaderId: auth.currentUser!.uid
              });
            } catch (firestoreError: any) {
              console.error("Firestore Error:", firestoreError);
              alert("Zdjęcie dodano do Storage, ale wystąpił błąd podczas zapisywania w bazie danych.");
            } finally {
              setUploading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }
        );

      } catch (error: any) {
        console.error("Error uploading", error);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert(`Wystąpił nieoczekiwany błąd: ${error.message || error}`);
      }
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
            Twoje zdjęcia to najpiękniejszy prezent. Wrzuć je do naszej wspólnej galerii w pełnej jakości!
          </p>

          <input 
            type="file" 
            accept="image/*" 
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
              {uploading ? 'Dodawanie...' : 'Dodaj Zdjęcie'}
            </span>
          </button>
        </section>

        {/* Gallery Section */}
        <div className="px-6 mt-8">
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-xs uppercase tracking-[0.4em] font-bold border-b-2 border-[#4A5D4E] pb-1">Galeria Live</h3>
          </div>
          
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 h-full">
              {images.map((img) => (
                <div 
                  key={img.id} 
                  className="relative group rounded-xl overflow-hidden shadow-sm bg-gray-100 aspect-square cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => setSelectedIndex(images.findIndex(i => i.id === img.id))}
                >
                  <img
                    src={img.thumbnailUrl}
                    className="w-full h-full object-cover"
                    alt="Wspomnienie weselne"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 py-16 flex flex-col items-center justify-center text-center text-[#8C8C8C] border-2 border-dashed border-[#EAE8E2] rounded-2xl bg-[#f8f8f5]">
              <Camera size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Brak zdjęć. Bądź pierwszą osobą,<br />która uwieczni ten moment!</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Fullscreen Photo Modal */}
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
                className="text-white p-2 rounded-full bg-white/10 active:scale-95"
              >
                <X size={24} />
              </button>
              <button 
                onClick={() => handleDownload(selectedImage.url)}
                className="text-white flex items-center gap-2 p-2 px-4 rounded-full bg-[#4A5D4E] active:scale-95 font-bold text-sm"
              >
                <Download size={18} />
                Pobierz
              </button>
            </div>
            
            <div className="flex-1 w-full flex items-center justify-center p-4 overflow-hidden relative">
              <AnimatePresence mode="wait">
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
              </AnimatePresence>
            </div>
            <div className="pb-8 pt-4 text-center text-white/50 text-xs tracking-wider uppercase">
              {selectedIndex! + 1} z {images.length} • Przesuń w bok
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
