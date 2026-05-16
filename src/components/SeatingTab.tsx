import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';

interface Guest {
  name: string;
  table: string | number;
}

const mockGuests: Guest[] = [
  { name: "Anna Kowalska", table: 1 },
  { name: "Jan Kowalski", table: 1 },
  { name: "Babcia Zosia", table: 2 },
  { name: "Wujek Kazio", table: 2 },
  { name: "Piotr Nowak", table: 3 },
  { name: "Marta Nowak", table: 3 },
];

export default function SeatingTab() {
  const [search, setSearch] = useState("");
  
  const filtered = mockGuests.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 pt-10 pb-12 h-full flex flex-col">
      <div className="text-center mb-8">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Mapa stołów</span>
        <h1 className="font-serif text-4xl italic text-[#4A5D4E] mb-4">Znajdź swoje miejsce</h1>
        <p className="text-[#555] text-sm max-w-xs mx-auto leading-relaxed">
          Wpisz swoje imię i nazwisko, aby sprawdzić, na którym stole na Ciebie czekamy.
        </p>
      </div>

      <div className="bg-white p-6 rounded-[24px] shadow-sm border border-[#EAE8E2] mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8C8C]" size={18} />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FAF9F6] border border-[#EAE8E2] rounded-xl pl-12 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-[#4A5D4E] focus:border-transparent transition-all"
            placeholder="Wpisz imię i nazwisko..."
          />
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        <AnimatePresence>
          {filtered.map((guest, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-[#EAE8E2] flex items-center justify-between"
            >
              <span className="font-serif italic text-lg text-[#2D2D2D]">{guest.name}</span>
              <div className="bg-[#4A5D4E] text-[#FAF9F6] px-4 py-1.5 rounded-full flex flex-col items-center justify-center">
                <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Stół</span>
                <span className="text-base font-bold leading-none">{guest.table}</span>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && search && (
            <div className="text-center py-8 text-[#8C8C8C] italic text-sm">
              Nie znaleziono takiego gościa. Spróbuj wpisać samo nazwisko.
            </div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Decorative Hall Map */}
      <div className="mt-8 border-t border-[#EAE8E2] pt-8 flex flex-col items-center">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-6 block">Plan Sali</span>
        <div className="relative w-full max-w-[280px] aspect-[4/3] border-2 border-dashed border-[#EAE8E2] rounded-3xl p-4 flex flex-col items-center justify-between bg-[#f8f8f5]">
           <div className="bg-[#4A5D4E] text-white text-[10px] uppercase font-bold tracking-widest px-6 py-2 rounded-lg">Stół Prezydialny</div>
           <div className="w-full flex justify-between px-4">
             <div className="w-12 h-12 rounded-full border-2 border-[#C5A27D] flex justify-center items-center font-serif text-[#C5A27D]">1</div>
             <div className="w-12 h-12 rounded-full border-2 border-[#C5A27D] flex justify-center items-center font-serif text-[#C5A27D]">2</div>
           </div>
           <div className="w-full flex justify-center">
             <div className="w-12 h-12 rounded-full border-2 border-[#C5A27D] flex justify-center items-center font-serif text-[#C5A27D]">3</div>
           </div>
           <div className="absolute inset-0 flex items-center justify-center opacity-5 pb-4 pointer-events-none">
             <span className="font-serif text-5xl">Parkiet</span>
           </div>
        </div>
      </div>
    </motion.div>
  );
}
