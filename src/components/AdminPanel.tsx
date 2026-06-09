import React, { useState, useEffect } from 'react';
import { 
  Download, Loader2, ArrowLeft, Play, Film, Clock, Lock, Unlock, 
  Utensils, Calendar, Grid3X3, Image as ImageIcon, Save, Trash2, 
  Plus, Edit, Check, RotateCcw, AlertTriangle, LogIn, LogOut, Trash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, storage } from '../firebase';
import { 
  collection, doc, getDoc, setDoc, query, onSnapshot, where, updateDoc 
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Define fallbacks so they can easily reset
const DEFAULT_MENU = [
  { category: "Przystawka", title: "Tatar z łososia norweskiego", description: "z kaparami, czerwoną cebulą i oliwą truflową" },
  { category: "Zupa", title: "Tradycyjny rosół z kury zielononóżki", description: "z domowym makaronem domowej roboty" },
  { category: "Danie Główne", title: "Polędwiczki wieprzowe w sosie kurkowym", description: "podawane z puree ziemniaczanym i bukietem świeżych sałat" },
  { category: "Deser", title: "Panna Cotta z musem miętowym", description: "wzbogacona owocami leśnymi i kruszonką bazyliową" }
];

const DEFAULT_SCHEDULE = [
  { time: '15:00', title: 'Ceremonia Ślubna', desc: 'Kościół pw. św. Anny' },
  { time: '16:30', title: 'Życzenia i Toast', desc: 'Przed Salą Bankietową' },
  { time: '17:00', title: 'Uroczysty Obiad', desc: 'Czas na pyszne jedzenie!' },
  { time: '18:30', title: 'Pierwszy Taniec', desc: 'Zapraszamy na parkiet' },
  { time: '20:30', title: 'Tort Weselny', desc: 'Słodka niespodzianka na środku sali' },
  { time: '22:00', title: 'Zabawa z DJ-em', desc: 'Parkiet płonie w rytm największych hitów' },
  { time: '00:00', title: 'Oczepiny', desc: 'Tradycyjne polskie zabawy weselne' }
];

const DEFAULT_BINGO = [
  "Zrób selfie z Panem Młodym",
  "Uchwyć uśmiech Pani Młodej",
  "Sfotografuj kogoś kto płacze ze wzruszenia",
  "Złap na zdjęciu toasty i wznoszone kieliszki",
  "Uwiecznij pierwszy taniec",
  "Zrób zdjęcie najgorszemu tancerzowi",
  "Sfotografuj pocałunek kogoś innego niż Młodzi",
  "Selfie z kimś, kogo dzisiaj poznałeś",
  "Uchwyć moment krojenia tortu"
];

interface PhotoData {
  id: string;
  url: string;
  thumbnailUrl: string;
  mediaType?: 'image' | 'video';
  uploaderId?: string;
  createdAt?: any;
}

const ADMIN_EMAIL = "lewkowicz.olaf2@gmail.com";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'photos' | 'lock' | 'menu' | 'schedule' | 'bingo'>('photos');

  // Loaders
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // States for configs
  const [images, setImages] = useState<PhotoData[]>([]);
  
  // Lock screen configuration
  const [unlockDateInput, setUnlockDateInput] = useState('2026-07-04');
  const [unlockTimeInput, setUnlockTimeInput] = useState('12:00');

  // Menu configuration
  const [menuList, setMenuList] = useState<typeof DEFAULT_MENU>(DEFAULT_MENU);
  
  // Schedule configuration
  const [scheduleList, setScheduleList] = useState<typeof DEFAULT_SCHEDULE>(DEFAULT_SCHEDULE);
  
  // Bingo configuration
  const [bingoPrompts, setBingoPrompts] = useState<string[]>(DEFAULT_BINGO);

  // Sync auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user && user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        setIsAdmin(user?.email === ADMIN_EMAIL); // double check
      }
    });
    return () => unsub();
  }, []);

  // Fetch photos
  useEffect(() => {
    const q = query(collection(db, 'photos'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhotoData[];
      
      fetched.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setImages(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching photos snapshot:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch current Firestore configs
  useEffect(() => {
    // 1. Lock settings
    const unsubLock = onSnapshot(doc(db, 'settings', 'lock'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.data().unlockTime;
        if (typeof val === 'number') {
          const date = new Date(val);
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          setUnlockDateInput(`${yyyy}-${mm}-${dd}`);
          const hh = String(date.getHours()).padStart(2, '0');
          const min = String(date.getMinutes()).padStart(2, '0');
          setUnlockTimeInput(`${hh}:${min}`);
        }
      }
    }, (error) => {
      console.error("Error fetching lock settings snapshot:", error);
    });

    // 2. Menu settings
    const unsubMenu = onSnapshot(doc(db, 'settings', 'menu'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.sections)) {
          setMenuList(data.sections);
        }
      }
    }, (error) => {
      console.error("Error fetching menu settings snapshot:", error);
    });

    // 3. Schedule settings
    const unsubSchedule = onSnapshot(doc(db, 'settings', 'schedule'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.events)) {
          setScheduleList(data.events);
        }
      }
    }, (error) => {
      console.error("Error fetching schedule settings snapshot:", error);
    });

    // 4. Bingo settings
    const unsubBingo = onSnapshot(doc(db, 'settings', 'bingo'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.prompts)) {
          setBingoPrompts(data.prompts);
        }
      }
    }, (error) => {
      console.error("Error fetching bingo settings snapshot:", error);
    });

    return () => {
      unsubLock();
      unsubMenu();
      unsubSchedule();
      unsubBingo();
    };
  }, []);

  // Auth Handlers
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        alert("Zalogowano pomyślnie jako główny Administrator!");
      } else {
        setIsAdmin(false);
        triggerMockPopup("Konto zalogowane, ale nie posiada uprawnień Admina w bazie.\nMożesz testować i symulować zmiany w tym oknie!");
      }
    } catch (err: any) {
      console.error(err);
      alert("Błąd logowania: " + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false);
      alert("Wylogowano z panelu.");
    } catch (err: any) {
      console.error(err);
    }
  };

  // Helper trigger informative popup messages
  const triggerMockPopup = (msg: string) => {
    alert(msg);
  };

  // Save Config to Firestore (with standard failover info)
  const saveToFirestore = async (settingId: string, data: any) => {
    setSaving(true);
    try {
      if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        // Simulated local saving in state
        alert("Symulacja zapisu: Zmiany zostały zastosowane lokalnie w przeglądarce!\nZaloguj się kontem lewkowicz.olaf2@gmail.com, aby zapisać trwale w chmurze.");
        setSaving(false);
        return;
      }
      await setDoc(doc(db, 'settings', settingId), data);
      alert("Pomyślnie zapisano zmiany w chmurze Firestore!");
    } catch (err: any) {
      console.error(err);
      alert(`Błąd zapisu: Brak uprawnień do zapisu w Firestore.\nUpewnij się, że jesteś zalogowany jako ${ADMIN_EMAIL}.`);
    } finally {
      setSaving(false);
    }
  };

  // 1. Lock screen save
  const handleSaveLock = () => {
    const dateTimeStr = `${unlockDateInput}T${unlockTimeInput}:00`;
    const targetTimestamp = new Date(dateTimeStr).getTime();
    if (isNaN(targetTimestamp)) {
      alert("Niepoprawna data lub godzina.");
      return;
    }
    saveToFirestore('lock', { unlockTime: targetTimestamp });
  };

  const handleQuickLock = (lockNow: boolean) => {
    const targetTimestamp = lockNow 
      ? Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year from now
      : Date.now() - 1000; // 1 second ago (unlocked)
    
    const date = new Date(targetTimestamp);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    setUnlockDateInput(`${yyyy}-${mm}-${dd}`);
    setUnlockTimeInput(`${hh}:${min}`);

    saveToFirestore('lock', { unlockTime: targetTimestamp });
  };

  // 2. Menu functions
  const handleUpdateMenuItem = (index: number, field: string, value: string) => {
    const updated = [...menuList];
    updated[index] = { ...updated[index], [field]: value };
    setMenuList(updated);
  };

  const handleAddMenuItem = () => {
    setMenuList([...menuList, { category: "Nowa Kategoria", title: "Nazwa potrawy", description: "Opis potrawy, dodatki..." }]);
  };

  const handleRemoveMenuItem = (index: number) => {
    const updated = menuList.filter((_, i) => i !== index);
    setMenuList(updated);
  };

  const handleSaveMenu = () => {
    saveToFirestore('menu', { sections: menuList });
  };

  const handleResetMenu = () => {
    if (window.confirm("Przywrócić standardowe menu? Nie zapomnij zapisać zmian.")) {
      setMenuList(DEFAULT_MENU);
    }
  };

  // 3. Schedule functions
  const handleUpdateScheduleItem = (index: number, field: string, value: string) => {
    const updated = [...scheduleList];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleList(updated);
  };

  const handleAddScheduleItem = () => {
    setScheduleList([...scheduleList, { time: "20:00", title: "Nowe wydarzenie", desc: "Krótki opis" }]);
  };

  const handleRemoveScheduleItem = (index: number) => {
    const updated = scheduleList.filter((_, i) => i !== index);
    setScheduleList(updated);
  };

  const handleSaveSchedule = () => {
    // Sort events by time HH:MM
    const sorted = [...scheduleList].sort((a, b) => a.time.localeCompare(b.time));
    setScheduleList(sorted);
    saveToFirestore('schedule', { events: sorted });
  };

  const handleResetSchedule = () => {
    if (window.confirm("Przywrócić standardowy harmonogram? Nie zapomnij zapisać zmian.")) {
      setScheduleList(DEFAULT_SCHEDULE);
    }
  };

  // 4. Bingo functions
  const handleUpdateBingoPrompt = (index: number, value: string) => {
    const updated = [...bingoPrompts];
    updated[index] = value;
    setBingoPrompts(updated);
  };

  const handleSaveBingo = () => {
    if (bingoPrompts.some(p => !p.trim())) {
      alert("Wszystkie 9 pól bingo muszą być uzupełnione tekstami.");
      return;
    }
    saveToFirestore('bingo', { prompts: bingoPrompts });
  };

  const handleResetBingo = () => {
    if (window.confirm("Przywrócić domyślne wyzwania Bingo? Nie zapomnij zapisać zmian.")) {
      setBingoPrompts(DEFAULT_BINGO);
    }
  };

  // 5. Gallery Delete / Download
  const deletePhoto = async (id: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zdjęcie permanentnie z galerii gości?")) return;
    try {
      await updateDoc(doc(db, 'photos', id), { status: 'deleted' });
      alert("Zdjęcie usunięte pomyślnie.");
    } catch (err: any) {
      console.error(err);
      alert("Błąd podczas usuwania: " + err.message);
    }
  };

  const downloadAll = async () => {
    if (images.length === 0) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("Weselne_Zdjecia");
      
      for (let i = 0; i < images.length; i++) {
        try {
          const response = await fetch(images[i].url);
          const blob = await response.blob();
          const ext = images[i].mediaType === 'video' ? 'mp4' : 'jpg';
          folder?.file(`wspomnienie_${i+1}.${ext}`, blob);
        } catch (e) {
          console.error("Skipped item", e);
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "weselne_zdjecia.zip");
    } catch (e) {
      console.error(e);
      alert("Błąd pobierania ZIP.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-12">
      {/* Upper Navigation Bar */}
      <nav className="bg-white border-b border-[#EAE8E2] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C8C8C] hover:text-[#4A5D4E] transition-all uppercase tracking-wider">
            <ArrowLeft size={16} /> Powrót
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
              Link dla DJ-a:
            </span>
            <Link to="/dj" className="text-xs bg-[#FAF6EE] text-[#4A5D4E] font-mono px-2 py-0.5 rounded-md border border-[#EAE8E2] hover:bg-[#F3E7D5] transition-colors">
              /dj
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        
        {/* Header Block */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#8C8C8C] mb-1 block">Moduł Konfiguracyjny</span>
            <h1 className="text-4xl font-serif italic text-[#4A5D4E]">Panel Weselny Pary Młodej</h1>
          </div>

          <div className="flex items-center gap-2">
            {currentUser && isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#4A5D4E] bg-[#EAEFEA] px-3 py-1.5 rounded-full border border-[#D5E2D5]">
                  Zalogowano: {ADMIN_EMAIL}
                </span>
                <button 
                  onClick={handleLogout}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full transition-colors"
                  title="Wyloguj się"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-2 bg-[#4A5D4E] text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors active:scale-95"
              >
                <LogIn size={15} /> Logowanie Google ({ADMIN_EMAIL})
              </button>
            )}
          </div>
        </header>

        {/* Warning card for non-admin state */}
        {!isAdmin && (
          <div className="bg-[#FAF6EE] border border-[#F3E7D5] rounded-3xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FAF0D9] flex items-center justify-center shrink-0">
              <AlertTriangle className="text-[#C5A27D]" size={20} />
            </div>
            <div>
              <h3 className="font-serif italic text-lg text-[#8C6F4F]">Tryb symulacji / Brak autoryzacji</h3>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                Aby trwale zapisać zmiany w bazie danych Firestore, zaloguj się kontem Google: <strong className="font-mono text-[#4A5D4E]">{ADMIN_EMAIL}</strong>. Bez tego, możesz testować działanie panelu, ale zmiany będą zapisywane tylko lokalnie.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Navigation Rails */}
        <div className="flex overflow-x-auto gap-2 pb-3 mb-8 border-b border-[#EAE8E2] scrollbar-none">
          {[
            { id: 'photos', label: 'Galeria & ZIP', icon: <ImageIcon size={15} /> },
            { id: 'lock', label: 'Blokada zdjęć', icon: <Clock size={15} /> },
            { id: 'menu', label: 'Karta dań (Menu)', icon: <Utensils size={15} /> },
            { id: 'schedule', label: 'Harmonogram', icon: <Calendar size={15} /> },
            { id: 'bingo', label: 'Zdjęciowe Bingo', icon: <Grid3X3 size={15} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                activeSubTab === tab.id 
                  ? 'bg-[#4A5D4E] text-white' 
                  : 'bg-white border border-[#EAE8E2] text-[#8C8C8C] hover:border-[#4A5D4E] hover:text-[#4A5D4E]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Workspace content fields */}
        <div className="bg-white rounded-3xl border border-[#EAE8E2] p-5 sm:p-8 shadow-xs">
          
          {/* TAB 1: PHOTOS */}
          {activeSubTab === 'photos' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Zarządzanie Zdjęciami</h2>
                  <p className="text-xs text-gray-500 mt-1">Udostępnione momenty przez gości weselnych ({images.length} plików).</p>
                </div>
                <button 
                  onClick={downloadAll}
                  disabled={downloading || images.length === 0}
                  className="inline-flex items-center gap-2 bg-[#C5A27D] hover:bg-[#b0906f] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> ZIP w toku...
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Ściągnij ZIP ({images.length})
                    </>
                  )}
                </button>
              </div>

              {loading ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="animate-spin text-[#C5A27D]" size={32} />
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-2xl overflow-hidden shadow-xs bg-gray-50 aspect-square border border-[#F0EFEA]">
                      {img.thumbnailUrl ? (
                        <img
                          src={img.thumbnailUrl}
                          className="w-full h-full object-cover"
                          alt="Podgląd"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <Film size={20} className="text-gray-400" />
                        </div>
                      )}
                      
                      {img.mediaType === 'video' && (
                        <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center bg-black/10">
                          <Play size={20} className="text-white opacity-80 drop-shadow-md" fill="white" />
                        </div>
                      )}

                      {/* Trash action button */}
                      <button 
                        onClick={() => deletePhoto(img.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/95 text-red-500 hover:text-red-700 hover:scale-110 active:scale-95 transition-all shadow-md"
                        title="Usuń zdjęcie"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center border border-dashed border-[#EAE8E2] rounded-2xl bg-[#fbfbfa]">
                  <p className="text-xs text-[#8C8C8C] italic">Nikt jeszcze nie przesłał zdjęć do galerii.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCK PRE-RELEASE TIMER */}
          {activeSubTab === 'lock' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Czas odblokowania galerii</h2>
                <p className="text-xs text-gray-500 mt-1">Określ, od kiedy zdjęcia przesłane przez gości stają się widoczne dla wszystkich uczestników (do tego czasu inni widzą je rozmyte).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-2">Dzień</label>
                  <input 
                    type="date" 
                    value={unlockDateInput} 
                    onChange={e => setUnlockDateInput(e.target.value)}
                    className="w-full border border-[#EAE8E2] rounded-xl px-4 py-2.5 text-sm bg-[#FAFBFB] focus:border-[#4A5D4E] focus:outline-none focus:ring-1 focus:ring-[#4A5D4E] transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-2">Godzina</label>
                  <input 
                    type="time" 
                    value={unlockTimeInput} 
                    onChange={e => setUnlockTimeInput(e.target.value)}
                    className="w-full border border-[#EAE8E2] rounded-xl px-4 py-2.5 text-sm bg-[#FAFBFB] focus:border-[#4A5D4E] focus:outline-none focus:ring-1 focus:ring-[#4A5D4E] transition-all font-mono font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button 
                  onClick={handleSaveLock}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[#4A5D4E] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Zapisuję..." : "Zapisz Czas Blokady"}
                </button>
                <button 
                  onClick={() => handleQuickLock(true)}
                  className="inline-flex items-center gap-1.5 border border-[#EAE8E2] bg-white text-gray-600 hover:text-red-500 hover:border-red-100 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <Lock size={13} className="text-[#C5A27D]" /> Zablokuj teraz (1 rok)
                </button>
                <button 
                  onClick={() => handleQuickLock(false)}
                  className="inline-flex items-center gap-1.5 border border-[#EAE8E2] bg-white text-gray-600 hover:text-[#4A5D4E] hover:border-gray-300 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <Unlock size={13} className="text-[#4A5D4E]" /> Odblokuj teraz
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MENU */}
          {activeSubTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Karta Dań (Menu)</h2>
                  <p className="text-xs text-gray-500 mt-1">Zmieniaj kategorie oraz teksty potraw ślubnych wyświetlane w restauracji weselnej.</p>
                </div>
                <button 
                  onClick={handleResetMenu}
                  className="inline-flex items-center gap-1 bg-gray-50 border border-[#EAE8E2] hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  <RotateCcw size={12} /> Przywróć domyślne
                </button>
              </div>

              <div className="space-y-4">
                {menuList.map((item, idx) => (
                  <div key={idx} className="p-4 border border-[#F0EFEA] rounded-2xl bg-gray-50 relative space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] bg-[#FAF3E8] text-[#C5A27D] px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                        Pozycja #{idx + 1}
                      </span>
                      <button 
                        onClick={() => handleRemoveMenuItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md transition-colors"
                        title="Usuń pozycję"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-1">Sekcja / Kategoria</label>
                        <input 
                          type="text" 
                          value={item.category} 
                          onChange={e => handleUpdateMenuItem(idx, 'category', e.target.value)}
                          className="w-full border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-bold"
                          placeholder="np. Rosół"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-1">Tytuł potrawy (Główne)</label>
                        <input 
                          type="text" 
                          value={item.title} 
                          onChange={e => handleUpdateMenuItem(idx, 'title', e.target.value)}
                          className="w-full border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-serif italic"
                          placeholder="np. Polędwiczki wieprzowe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-1">Opis / Dodatki / Alergeny</label>
                      <input 
                        type="text" 
                        value={item.description} 
                        onChange={e => handleUpdateMenuItem(idx, 'description', e.target.value)}
                        className="w-full border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all"
                        placeholder="np. frytki i mix sałat"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button 
                  onClick={handleAddMenuItem}
                  className="inline-flex items-center gap-1.5 border border-[#4A5D4E] text-[#4A5D4E] hover:bg-[#4A5D4E]/5 px-4 h-9 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <Plus size={14} /> Dodaj kolejną potrawę
                </button>
                <button 
                  onClick={handleSaveMenu}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-[#4A5D4E] text-white px-5 h-9 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Zapisuję..." : "Zapisz Karcie Dań"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEDULE */}
          {activeSubTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Plan wydarzenia (Harmonogram)</h2>
                  <p className="text-xs text-gray-500 mt-1">Dodawaj wydarzenia i zmieniaj plan dnia wyświetlany gościom. Zostaną ułożone chronologicznie.</p>
                </div>
                <button 
                  onClick={handleResetSchedule}
                  className="inline-flex items-center gap-1 bg-gray-50 border border-[#EAE8E2] hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  <RotateCcw size={12} /> Przywróć domyślne
                </button>
              </div>

              <div className="space-y-4">
                {scheduleList.map((item, idx) => (
                  <div key={idx} className="p-4 border border-[#F0EFEA] rounded-2xl bg-gray-50 relative space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] bg-[#EAEFEA] text-[#4A5D4E] px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                        Wpis #{idx + 1}
                      </span>
                      <button 
                        onClick={() => handleRemoveScheduleItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-md transition-colors"
                        title="Usuń pozycję"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-1">Godzina</label>
                        <input 
                          type="text" 
                          value={item.time} 
                          onChange={e => handleUpdateScheduleItem(idx, 'time', e.target.value)}
                          className="w-full border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-mono font-bold"
                          placeholder="np. 15:00"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[9px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-1">Nazwa wydarzenia</label>
                        <input 
                          type="text" 
                          value={item.title} 
                          onChange={e => handleUpdateScheduleItem(idx, 'title', e.target.value)}
                          className="w-full border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-serif italic font-medium"
                          placeholder="np. Pierwszy taniec"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase tracking-wider font-bold text-[#8C8C8C] mb-1">Opis / miejsce</label>
                      <input 
                        type="text" 
                        value={item.desc} 
                        onChange={e => handleUpdateScheduleItem(idx, 'desc', e.target.value)}
                        className="w-full border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all"
                        placeholder="np. Zapraszamy wszystkich na parkiet główny!"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button 
                  onClick={handleAddScheduleItem}
                  className="inline-flex items-center gap-1.5 border border-[#4A5D4E] text-[#4A5D4E] hover:bg-[#4A5D4E]/5 px-4 h-9 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                >
                  <Plus size={14} /> Dodaj nowe wydarzenie
                </button>
                <button 
                  onClick={handleSaveSchedule}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-[#4A5D4E] text-white px-5 h-9 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Zapisuję..." : "Zapisz i Posortuj Harmonogram"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: BINGO CHALLENGES */}
          {activeSubTab === 'bingo' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Teksty Zdjęciowego Bingo</h2>
                  <p className="text-xs text-gray-500 mt-1">Zmień teksty dla 9 wyzwań w grze Bingo. Każde pole odpowiada jednemu kafelkowi w siatce 3x3.</p>
                </div>
                <button 
                  onClick={handleResetBingo}
                  className="inline-flex items-center gap-1 bg-gray-50 border border-[#EAE8E2] hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  <RotateCcw size={12} /> Przywróć domyślne
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {bingoPrompts.map((field, idx) => (
                  <div key={idx} className="p-3.5 border border-[#F0EFEA] rounded-2xl bg-gray-50 space-y-2">
                    <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                      Kafel #{idx + 1}
                    </span>
                    <textarea
                      rows={2}
                      value={field}
                      onChange={e => handleUpdateBingoPrompt(idx, e.target.value)}
                      className="w-full border border-[#EAE8E2] bg-white rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all resize-none font-medium leading-normal"
                      placeholder={`Zadanie dla pola ${idx + 1}...`}
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleSaveBingo}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-[#4A5D4E] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? "Zapisuję..." : "Zapisz Wyzwania Bingo"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
