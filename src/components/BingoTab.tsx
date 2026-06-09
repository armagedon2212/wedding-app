import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const DEFAULT_BINGO: string[] = [
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

export default function BingoTab() {
  const [fields, setFields] = useState<string[]>(DEFAULT_BINGO);
  const [marked, setMarked] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('wedding_photo_bingo');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('wedding_photo_bingo', JSON.stringify(marked));
  }, [marked]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'bingo'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.prompts)) {
          // Fill exact 9 tiles
          const loaded = [...data.prompts];
          while (loaded.length < 9) {
            loaded.push(`Pole ${loaded.length + 1}`);
          }
          setFields(loaded.slice(0, 9));
        }
      }
    }, (error) => {
      console.error("Error fetching bingo settings:", error);
    });
    return () => unsub();
  }, []);

  const toggleMark = (index: number) => {
    setMarked(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 pt-10 h-full flex flex-col justify-center pb-8">
      <div className="text-center mb-8">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Wyzwanie fotograficzne</span>
        <h1 className="font-serif text-4xl italic text-[#4A5D4E] mb-4">Zdjęciowe Bingo</h1>
        <p className="text-[#555] text-sm max-w-xs mx-auto leading-relaxed">
          Uwiecznij te momenty na zdjęciu i pochwal się nimi w naszej galerii. Zaznacz pole, gdy tylko zrobisz dane zdjęcie!
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto w-full">
        {fields.map((field, i) => (
          <button
            key={i}
            onClick={() => toggleMark(i)}
            className={`aspect-square p-2 border flex items-center justify-center text-center transition-all duration-300 transform rounded-2xl ${
              marked[i] 
                ? 'bg-[#4A5D4E] border-[#4A5D4E] text-white shadow-inner scale-95' 
                : 'bg-white border-[#EAE8E2] text-[#555] shadow-sm hover:border-[#CDCAC4]'
            }`}
          >
            <span className={`text-[10px] sm:text-[11px] leading-tight ${marked[i] ? 'font-medium' : 'font-semibold'}`}>
              {field}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 text-center bg-white p-4 rounded-xl border border-[#EAE8E2] max-w-xs mx-auto w-full shadow-sm">
        <p className="text-[10px] font-bold text-[#8C8C8C] uppercase tracking-widest mb-1">
          Ukończono
        </p>
        <p className="text-2xl font-serif italic text-[#4A5D4E]">
          {Object.values(marked).filter(Boolean).length} / 9
        </p>
      </div>
    </motion.div>
  );
}
