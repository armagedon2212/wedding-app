import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface MenuSection {
  category: string;
  title: string;
  description: string;
}

const DEFAULT_MENU: MenuSection[] = [
  {
    category: "Przystawka",
    title: "Tatar z łososia norweskiego",
    description: "z kaparami, czerwoną cebulą i oliwą truflową"
  },
  {
    category: "Zupa",
    title: "Tradycyjny rosół z kury zielononóżki",
    description: "z domowym makaronem domowej roboty"
  },
  {
    category: "Danie Główne",
    title: "Polędwiczki wieprzowe w sosie kurkowym",
    description: "podawane z puree ziemniaczanym i bukietem świeżych sałat"
  },
  {
    category: "Deser",
    title: "Panna Cotta z musem miętowym",
    description: "wzbogacona owocami leśnymi i kruszonką bazyliową"
  }
];

export default function MenuTab() {
  const [menuSections, setMenuSections] = useState<MenuSection[]>(DEFAULT_MENU);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'menu'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.sections)) {
          setMenuSections(data.sections);
        }
      }
    }, (error) => {
      console.error("Error fetching menu settings:", error);
    });
    return () => unsub();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 pt-10 pb-12">
      <div className="mb-8 text-center">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Menu</span>
        <h1 className="font-serif text-4xl italic text-[#4A5D4E]">Karta Dań</h1>
      </div>
      
      <div className="bg-white rounded-[28px] sm:rounded-[32px] shadow-sm border border-[#EAE8E2] p-4 sm:p-8 relative">
        {/* Dekoracyjne menu borders */}
        <div className="absolute top-1.5 left-1.5 right-1.5 bottom-1.5 sm:top-2 sm:left-2 sm:right-2 sm:bottom-2 border border-[#EAE8E2] rounded-[20px] sm:rounded-[24px] pointer-events-none"></div>

        <div className="flex flex-col gap-8 sm:gap-10 relative z-10 py-6 sm:py-4">
          {menuSections.map((section, idx) => (
            <div key={idx}>
              <section className="text-center px-2">
                <h2 className="text-[8px] sm:text-[10px] uppercase tracking-[0.4em] font-bold text-[#C5A27D] mb-1.5 sm:mb-2">{section.category}</h2>
                <p className="text-[#2D2D2D] font-serif italic text-lg sm:text-xl leading-tight">{section.title}</p>
                <p className="text-[#555] text-xs sm:text-sm mt-1 sm:mt-1.5 max-w-xs mx-auto">{section.description}</p>
              </section>
              {idx < menuSections.length - 1 && (
                <div className="w-8 h-[1px] bg-[#EAE8E2] mx-auto mt-8 sm:mt-10"></div>
              )}
            </div>
          ))}

          {menuSections.length === 0 && (
            <p className="text-center text-[#8C8C8C] font-serif italic">Brak dań w karcie.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
