import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Image, Calendar, Utensils, Music, Grid3X3, Map } from 'lucide-react';
import GalleryTab from './components/GalleryTab';
import ScheduleTab from './components/ScheduleTab';
import MenuTab from './components/MenuTab';
import SuggestTab from './components/SuggestTab';
import BingoTab from './components/BingoTab';
import DjView from './components/DjView';
import AdminPhotos from './components/AdminPhotos';
import WelcomeScreen from './components/WelcomeScreen';
import { initAuth } from './firebase';

function MainApp({ initialTab = 'gallery' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab === 'seating' ? 'schedule' : initialTab);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialTab === 'seating') {
      navigate('/#seating', { replace: true });
    }
  }, [initialTab, navigate]);

  const tabs = [
    { id: 'gallery', label: 'Galeria', icon: <Image size={24} strokeWidth={1.5} />, component: <GalleryTab /> },
    { id: 'schedule', label: 'Plan', icon: <Calendar size={24} strokeWidth={1.5} />, component: <ScheduleTab /> },
    { id: 'menu', label: 'Menu', icon: <Utensils size={24} strokeWidth={1.5} />, component: <MenuTab /> },
    { id: 'suggest', label: 'Zaproponuj', icon: <Music size={24} strokeWidth={1.5} />, component: <SuggestTab /> },
    { id: 'bingo', label: 'Bingo', icon: <Grid3X3 size={24} strokeWidth={1.5} />, component: <BingoTab /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] font-sans text-[#2D2D2D] pb-[80px] overflow-x-hidden">
      <main className="max-w-lg mx-auto h-full">
        {tabs.find(t => t.id === activeTab)?.component}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EEE] z-50 pb-safe">
        <div className="max-w-lg mx-auto flex justify-between items-center px-4 py-4 w-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  navigate('/', { replace: true });
                }}
                className={`flex flex-col items-center gap-1.5 transition-colors px-3 ${
                  isActive ? 'text-[#4A5D4E]' : 'text-[#AAA] hover:text-[#4A5D4E]'
                }`}
              >
                <div className="flex items-center justify-center">
                  {tab.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function WelcomeRouter() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(() => {
    return localStorage.getItem('wedding_welcome_seen') !== 'true' && location.hash !== '#seating';
  });
  const [initialTab, setInitialTab] = useState(location.hash === '#seating' ? 'seating' : 'gallery');

  const handleEnter = (tabId: string = 'gallery') => {
    localStorage.setItem('wedding_welcome_seen', 'true');
    setInitialTab(tabId);
    setShowWelcome(false);
  };

  if (showWelcome) {
    return <WelcomeScreen onEnter={handleEnter} />;
  }

  return <MainApp initialTab={initialTab} />;
}

export default function App() {
  useEffect(() => {
    initAuth().catch(console.error);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WelcomeRouter />} />
        <Route path="/dj" element={<DjView />} />
        <Route path="/admin/photos" element={<AdminPhotos />} />
      </Routes>
    </BrowserRouter>
  );
}
