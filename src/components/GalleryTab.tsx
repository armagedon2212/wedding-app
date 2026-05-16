import { useRef, useState, useEffect } from 'react';
import { Camera, Download, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, query, onSnapshot, serverTimestamp, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface PhotoData {
  id: string;
  url: string;
  thumbnailUrl: string;
}

export default function GalleryTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PhotoData[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'photos'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhotoData[];
      
      // Sort in JS instead of Firestore to avoid composite index requirement
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
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
          (error) => console.error(error), 
          async () => {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            await addDoc(collection(db, 'photos'), {
              url: downloadUrl,
              thumbnailUrl: thumbnailBase64,
              createdAt: serverTimestamp(),
              status: 'active',
              uploaderId: auth.currentUser!.uid
            });
            setUploading(false);
          }
        );

      } catch (error) {
        console.error("Error uploading", error);
        setUploading(false);
      }
    }
  };

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
          folder?.file(`zdjecie_${i+1}.jpg`, blob);
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
          {images.length > 0 && (
            <button 
              onClick={downloadAll}
              disabled={downloading}
              className="text-[10px] uppercase font-bold text-[#C5A27D] flex items-center gap-1 active:scale-95"
            >
              {downloading ? "Pakowanie..." : "Pobierz wszystko w ZIP"}
              {!downloading && <Download size={14} />}
            </button>
          )}
        </div>
        
        {images.length > 0 ? (
          <div className="columns-2 gap-4 space-y-4 h-full">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-2xl overflow-hidden shadow-xl border border-[#EEE] break-inside-avoid mb-4">
                <motion.img
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={img.thumbnailUrl}
                  className="w-full object-cover min-h-[120px]"
                  alt="Wspomnienie weselne"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <a href={img.url} download target="_blank" rel="noopener noreferrer" className="bg-white/90 p-2 rounded-full text-stone-900 active:scale-95">
                     <Download size={18} />
                   </a>
                </div>
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
  );
}
