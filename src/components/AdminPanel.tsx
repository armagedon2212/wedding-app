import React, { useState, useEffect } from 'react';
import { 
  Download, Loader2, ArrowLeft, Play, Film, Clock, Lock, Unlock, 
  Utensils, Calendar, Grid3X3, Image as ImageIcon, Save, Trash2, 
  Plus, Edit, Check, RotateCcw, AlertTriangle, LogIn, LogOut, Trash, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, storage } from '../firebase';
import { 
  collection, doc, getDoc, setDoc, query, onSnapshot, where, updateDoc 
} from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
  const [activeSubTab, setActiveSubTab] = useState<'photos' | 'lock' | 'menu' | 'schedule' | 'bingo' | 'general'>('photos');

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

  // General configuration
  const [pageTitle, setPageTitle] = useState('miloszeliza.pl');
  const [faviconUrl, setFaviconUrl] = useState('');

  // Admin list configuration
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  // Email Auth & Invite states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmailInput, setInviteEmailInput] = useState('');

  // Sprawdzanie czy mamy link z zaproszeniem w URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setLoginEmail(invite);
      setIsRegisterMode(true);
    }
  }, []);

  const checkIfAdmin = (user: any, list: string[]) => {
    if (!user || !user.email) return false;
    const emailStr = user.email.toLowerCase().trim();
    return emailStr === ADMIN_EMAIL || list.map(e => e.toLowerCase().trim()).includes(emailStr);
  };

  // Sync auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Update isAdmin when currentUser or adminEmails changes
  useEffect(() => {
    setIsAdmin(checkIfAdmin(currentUser, adminEmails));
  }, [currentUser, adminEmails]);

  // Fetch admin list independently to compute isAdmin
  useEffect(() => {
    const unsubAdmins = onSnapshot(doc(db, 'settings', 'admins'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.emails)) {
          setAdminEmails(data.emails);
        }
      }
    }, (error) => {
      console.error("Error fetching admins settings snapshot:", error);
    });
    return () => unsubAdmins();
  }, []);

  // Fetch photos only when verified admin code is active
  useEffect(() => {
    if (!isAdmin) {
      setImages([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const q = query(collection(db, 'photos'), where('status', 'in', ['active', 'offline']));
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
  }, [isAdmin]);

  // Fetch other Firestore configs only when validated
  useEffect(() => {
    if (!isAdmin) return;

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

    // 5. General settings (Title & Favicon)
    const unsubGeneral = onSnapshot(doc(db, 'settings', 'general'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.title) {
          setPageTitle(data.title);
        }
        if (data.faviconUrl) {
          setFaviconUrl(data.faviconUrl);
        }
      }
    }, (error) => {
      console.error("Error fetching general settings snapshot:", error);
    });

    return () => {
      unsubLock();
      unsubMenu();
      unsubSchedule();
      unsubBingo();
      unsubGeneral();
    };
  }, [isAdmin]);

  // Auth Handlers
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let result;
      if (isRegisterMode) {
        result = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        alert("Konto zostało pomyślnie utworzone!");
      } else {
        result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      }
      
      const isUserAdmin = checkIfAdmin(result.user, adminEmails);
      if (isUserAdmin) {
        setIsAdmin(true);
        if (!isRegisterMode) alert(`Zalogowano pomyślnie jako Administrator: ${result.user.email}!`);
      } else {
        setIsAdmin(false);
        alert(`Konto ${result.user.email} nie posiada uprawnień administratora.`);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        alert("To konto już istnieje. Przełącz się na logowanie.");
        setIsRegisterMode(false);
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        alert("Nieprawidłowy email lub hasło.");
      } else {
        alert("Błąd logowania: " + err.message);
      }
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmailInput) return;
    setIsInviting(true);
    
    try {
      // 1. Dodaj email do listy administratorów jeśli go tam nie ma
      const updatedList = [...adminEmails, inviteEmailInput];
      if (!adminEmails.includes(inviteEmailInput)) {
        await saveToFirestore('admins', { emails: updatedList });
        setAdminEmails(updatedList);
      }

      // 2. Wyślij zaproszenie (jeśli to środowisko ma backend to użyje /api/invite)
      const baseUrl = window.location.origin;
      const inviteUrl = `${baseUrl}/admin?invite=${encodeURIComponent(inviteEmailInput)}`;
      
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmailInput, inviteUrl })
      });
      
      if (!response.ok) {
        throw new Error("Nie udało się wysłać emaila z zaproszeniem. Skonfiguruj backend.");
      }
      
      alert(`Wysłano zaproszenie na: ${inviteEmailInput}`);
      setInviteEmailInput('');
    } catch (err: any) {
      console.error(err);
      // Fallback jeśli API nie działa - dodaliśmy do adminów, skopiujmy link:
      const baseUrl = window.location.origin;
      const inviteUrl = `${baseUrl}/admin?invite=${encodeURIComponent(inviteEmailInput)}`;
      prompt(`Użytkownik dodany do uprawnień, ale nie udało się wysłać e-maila automatycznie. Wyślij mu ten link ręcznie:`, inviteUrl);
      setInviteEmailInput('');
    } finally {
      setIsInviting(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Sprawdź czy to wbudowana przeglądarka (Facebook/Messenger/Instagram)
    const ua = navigator.userAgent || navigator.vendor;
    const isWebview = ua.includes('FBAN') || ua.includes('FBAV') || ua.includes('Instagram') || ua.includes('Messenger');
    
    if (isWebview) {
      alert("UWAGA: Facebook/Messenger blokuje logowanie Google ze względów bezpieczeństwa.\n\nAby się zalogować:\n1. Kliknij ikonę 3 kropek (zazwyczaj w rogu ekranu)\n2. Wybierz 'Otwórz w przeglądarce' lub 'Otwórz w Safari/Chrome'\n3. Spróbuj zalogować się ponownie.");
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const isUserAdmin = checkIfAdmin(result.user, adminEmails);
      if (isUserAdmin) {
        setIsAdmin(true);
        alert(`Zalogowano pomyślnie jako Administrator: ${result.user.email}!`);
      } else {
        setIsAdmin(false);
        alert(`Konto ${result.user.email} nie posiada uprawnień administratora.`);
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

  // Save Config to Firestore
  const saveToFirestore = async (settingId: string, data: any) => {
    setSaving(true);
    try {
      const isUserAdmin = checkIfAdmin(auth.currentUser, adminEmails);
      if (!auth.currentUser || !isUserAdmin) {
        alert("Błąd: Brak uprawnień do zapisu.");
        setSaving(false);
        return;
      }
      await setDoc(doc(db, 'settings', settingId), data);
      alert("Pomyślnie zapisano zmiany w chmurze Firestore!");
    } catch (err: any) {
      console.error(err);
      alert("Błąd zapisu: Brak uprawnień do zapisu w Firestore.");
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

  // 5. General & Admin settings functions
  const handleSaveGeneral = () => {
    saveToFirestore('general', { title: pageTitle.trim(), faviconUrl: faviconUrl.trim() });
  };

  const handleSaveAdmins = (updatedEmails: string[]) => {
    saveToFirestore('admins', { emails: updatedEmails });
  };

  const handleAddAdminEmail = () => {
    if (!newAdminEmail.trim()) return;
    const emailToAdd = newAdminEmail.trim().toLowerCase();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToAdd)) {
      alert("Proszę wpisać poprawny adres e-mail.");
      return;
    }

    if (emailToAdd === ADMIN_EMAIL) {
      alert("Główny e-mail administratora jest już na stałe uprawniony.");
      return;
    }

    if (adminEmails.map(e => e.toLowerCase().trim()).includes(emailToAdd)) {
      alert("Ten e-mail już znajduje się na liście administratorów.");
      return;
    }

    const updated = [...adminEmails, emailToAdd];
    setAdminEmails(updated);
    setNewAdminEmail('');
    handleSaveAdmins(updated);
  };

  const handleRemoveAdminEmail = (emailToRemove: string) => {
    if (!window.confirm(`Czy na pewno chcesz odebrać uprawnienia administratora dla ${emailToRemove}?`)) return;
    const updated = adminEmails.filter(e => e.toLowerCase().trim() !== emailToRemove.toLowerCase().trim());
    setAdminEmails(updated);
    handleSaveAdmins(updated);
  };

  // 6. Gallery Delete / Download
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
                  Zalogowano: {currentUser.email}
                </span>
                <button 
                  onClick={handleLogout}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full transition-colors"
                  title="Wyloguj się"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                  Zalogowano: {currentUser.email} (Brak uprawnień)
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
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setIsRegisterMode(false)}
                  className="inline-flex items-center gap-2 bg-[#4A5D4E] text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors active:scale-95"
                >
                  <LogIn size={15} /> Zaloguj
                </button>
              </div>
            )}
          </div>
        </header>

        {!isAdmin ? (
          <div className="bg-white rounded-3xl border border-[#EAE8E2] p-8 max-w-md mx-auto text-center shadow-xs space-y-6 mt-12">
            <div className="w-16 h-16 bg-[#F5F2EB] rounded-full flex items-center justify-center mx-auto text-[#C5A27D]">
              <Lock size={28} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Dostęp Zastrzeżony</h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                Tylko autoryzowane konta administratorów mają dostęp do tego panelu.
                Zaloguj się przy użyciu adresu e-mail, aby zarządzać zdjęciami, menu, harmonogramem i innymi elementami uroczystości.
              </p>
            </div>

            {currentUser ? (
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-red-800">Brak uprawnień</h4>
                    <p className="text-[11px] text-red-700/80 mt-0.5">
                      Konto <strong className="font-mono">{currentUser.email}</strong> nie znajduje się na liście administratorów. Poproś głównego administratora o dodanie Twojego adresu e-mail.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleLogout}
                    className="w-full text-center bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Wyloguj się
                  </button>
                  <button
                    onClick={() => { handleLogout(); setIsRegisterMode(false); }}
                    className="w-full text-center bg-[#4A5D4E] hover:bg-[#3D4D40] text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Inne konto
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Adres E-mail</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-[#FAF6EE] border border-[#EAE8E2] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A27D]/50 transition-all"
                    placeholder="Wpisz swój e-mail"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Hasło</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-[#FAF6EE] border border-[#EAE8E2] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A27D]/50 transition-all"
                    placeholder="Wpisz hasło"
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#4A5D4E] hover:bg-[#3D4D40] text-white py-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                >
                  <LogIn size={15} /> {isRegisterMode ? 'Utwórz konto' : 'Zaloguj się'}
                </button>
                
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterMode(!isRegisterMode)}
                    className="text-xs text-[#C5A27D] hover:text-[#4A5D4E] font-medium transition-colors"
                  >
                    {isRegisterMode ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
                  </button>
                </div>
                
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-[#EAE8E2]"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">lub</span>
                  <div className="flex-grow border-t border-[#EAE8E2]"></div>
                </div>
                
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-[#EAE8E2] text-gray-700 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                  Zaloguj przez Google
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Dynamic Navigation Rails */}
            <div className="flex overflow-x-auto gap-2 pb-3 mb-8 border-b border-[#EAE8E2] scrollbar-none">
              {[
                { id: 'photos', label: 'Galeria & ZIP', icon: <ImageIcon size={15} /> },
                { id: 'lock', label: 'Blokada zdjęć', icon: <Clock size={15} /> },
                { id: 'menu', label: 'Karta dań (Menu)', icon: <Utensils size={15} /> },
                { id: 'schedule', label: 'Harmonogram', icon: <Calendar size={15} /> },
                { id: 'bingo', label: 'Zdjęciowe Bingo', icon: <Grid3X3 size={15} /> },
                { id: 'general', label: 'Ustawienia ogólne & Admini', icon: <Settings size={15} /> }
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

          {/* TAB 6: GENERAL CONFIG & ADMINS */}
          {activeSubTab === 'general' && (
            <div className="space-y-8 divide-y divide-[#EAE8E2]">
              {/* Part 1: Page custom details */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Konfiguracja Strony</h2>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Dostosuj tytuł witryny widoczny w zakładce przeglądarki oraz jej favicon (ikonę strony).</p>
                </div>

                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Tytuł Strony (Browser Title)
                    </label>
                    <input
                      type="text"
                      className="w-full border border-[#EAE8E2] bg-white rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-serif italic"
                      placeholder="np. Eliza & Miłosz – Nasza Ślubna Pamiątka"
                      value={pageTitle}
                      onChange={(e) => setPageTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      URL Faviconu (Adres Ikony)
                    </label>
                    <input
                      type="text"
                      className="w-full border border-[#EAE8E2] bg-white rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-mono"
                      placeholder="https://example.com/favicon.ico lub ścieżka np. /favicon.ico"
                      value={faviconUrl}
                      onChange={(e) => setFaviconUrl(e.target.value)}
                    />
                    {faviconUrl && (
                      <div className="mt-3 flex items-center gap-3 bg-[#FAF9F6] p-3 rounded-2xl border border-[#EAE8E2] w-fit">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Podgląd Ikony:</span>
                        <img
                          src={faviconUrl}
                          alt="Favicon preview"
                          className="w-6 h-6 object-contain rounded bg-white shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleSaveGeneral}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 bg-[#4A5D4E] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[#3D4D40] transition-colors disabled:opacity-50"
                    >
                      <Save size={14} /> {saving ? "Zapisuję..." : "Zapisz Ustawienia Strony"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Part 2: Administrator rights */}
              <div className="space-y-6 pt-8">
                <div>
                  <h2 className="text-2xl font-serif italic text-[#4A5D4E]">Zarządzanie Administratorami</h2>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                    Możesz dodać maile innych administratorów. Osoby te będą mogły logować się przez konto Google i zapisywać zmiany we wszystkich konfiguracjach weselnych.
                  </p>
                </div>

                <div className="space-y-4 max-w-xl">
                  {/* Primary Super Admin (Immutable) */}
                  <div className="flex items-center justify-between p-4 border border-[#D5E2D5] rounded-2xl bg-[#EAEFEA]/30">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#4A5D4E]">{ADMIN_EMAIL}</span>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400 mt-0.5">Główny Właściciel Ślubu (Zawsze Aktywny)</span>
                    </div>
                    <span className="text-[10px] bg-[#4A5D4E] text-white px-2.5 py-1 rounded-full uppercase tracking-wider font-bold">Właściciel</span>
                  </div>

                  {/* Dynamic extra admins listing */}
                  <div className="space-y-2">
                    {adminEmails.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">Nie dodano jeszcze żadnych dodatkowych administratorów.</p>
                    ) : (
                      adminEmails.map((email) => (
                        <div key={email} className="flex items-center justify-between p-4 border border-[#EAE8E2] rounded-2xl bg-gray-50">
                          <span className="text-xs font-medium text-gray-700">{email}</span>
                          <button
                            onClick={() => handleRemoveAdminEmail(email)}
                            className="bg-white hover:bg-red-50 text-red-500 hover:text-red-700 border border-[#EAE8E2] p-2 rounded-xl transition-all"
                            title="Odbierz uprawnienia"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add / Invite form */}
                  <form onSubmit={handleInviteUser} className="p-4 border border-[#EAE8E2] rounded-2xl bg-[#FAF9F6] space-y-3">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Zaproś e-mailem (wyślemy link)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        className="flex-1 border border-[#EAE8E2] bg-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] focus:outline-none transition-all font-mono"
                        placeholder="np. mama@gmail.com"
                        value={inviteEmailInput}
                        onChange={(e) => setInviteEmailInput(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={isInviting}
                        className="bg-[#4A5D4E] hover:bg-[#3D4D40] disabled:bg-[#8C8C8C] text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 shrink-0"
                      >
                        {isInviting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 
                        {isInviting ? 'Wysyłanie...' : 'Wyślij Zaproszenie'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
        </>
        )}
      </div>
    </div>
  );
}
