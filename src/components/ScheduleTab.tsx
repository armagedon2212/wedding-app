import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

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

export default function ScheduleTab() {
  const [search, setSearch] = useState("");
  const location = useLocation();
  
  const filtered = mockGuests.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (location.hash === '#seating') {
      setTimeout(() => {
        const el = document.getElementById('seating');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location.hash]);

  const events = [
    { time: '15:00', title: 'Ceremonia Ślubna', desc: 'Kościół pw. św. Anny' },
    { time: '16:30', title: 'Życzenia i Toast', desc: 'Przed Salą Bankietową' },
    { time: '17:00', title: 'Uroczysty Obiad', desc: 'Czas na pyszne jedzenie!' },
    { time: '18:30', title: 'Pierwszy Taniec', desc: 'Zapraszamy na parkiet' },
    { time: '20:30', title: 'Tort Weselny', desc: 'Słodka niespodzianka na środku sali' },
    { time: '22:00', title: 'Zabawa z DJ-em', desc: 'Parkiet płonie w rytm największych hitów' },
    { time: '00:00', title: 'Oczepiny', desc: 'Tradycyjne polskie zabawy weselne' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 pt-10 pb-12 flex flex-col h-full overflow-y-auto">
      <div className="mb-10 text-center">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Harmonogram</span>
        <h1 className="font-serif text-4xl italic text-[#4A5D4E]">Plan Dnia</h1>
      </div>
      
      <div className="relative border-l-2 border-[#EAE8E2] ml-4 space-y-10">
        {events.map((event, i) => (
          <div key={i} className="relative pl-8">
            <div className="absolute w-3 h-3 bg-[#4A5D4E] rounded-full -left-[7.5px] top-1.5 ring-4 ring-[#FAF9F6]"></div>
            <div className="text-xs uppercase tracking-widest text-[#8C8C8C] font-bold mb-1">{event.time}</div>
            <h3 className="text-xl font-serif text-[#2D2D2D] leading-tight">{event.title}</h3>
            <p className="text-[#555] text-sm mt-1.5">{event.desc}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-12 text-center pb-12 border-b border-[#EAE8E2]">
        <p className="text-[#8C8C8C] italic font-serif text-lg">„Miłość pisać trzeba tak, by nawet ślepy widział.”</p>
      </div>

      <div id="seating" className="pt-12">
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

        <div className="space-y-3 mb-10 overflow-hidden">
          <AnimatePresence>
            {filtered.slice(0, search ? undefined : 0).map((guest, i) => (
              <motion.div 
                key={guest.name}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white px-4 py-4 rounded-2xl shadow-sm border border-[#EAE8E2] flex items-center justify-between overflow-hidden"
              >
                <span className="font-serif italic text-lg text-[#2D2D2D]">{guest.name}</span>
                <div className="bg-[#4A5D4E] text-[#FAF9F6] px-4 py-1.5 rounded-full flex flex-col items-center justify-center shrink-0 ml-4">
                  <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">Stół</span>
                  <span className="text-base font-bold leading-none mt-0.5">{guest.table}</span>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && search && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 text-[#8C8C8C] italic text-sm">
                Nie znaleziono takiego gościa. Spróbuj wpisać samo nazwisko.
              </motion.div>
            )}
            {search === "" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-2 text-[#8C8C8C] text-sm">
                Zacznij wpisywać, aby zobaczyć przypisany stół.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Decorative Hall Map */}
        <div className="mt-8 pt-8 flex flex-col items-center border-t border-[#EAE8E2]">
          <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-6 block">Plan Sali</span>
          <div className="relative w-full max-w-[280px] aspect-[4/3] border-2 border-dashed border-[#EAE8E2] rounded-3xl p-4 flex flex-col items-center justify-between bg-[#f8f8f5]">
            <div className="bg-[#4A5D4E] text-white text-[10px] uppercase font-bold tracking-widest px-6 py-2 rounded-lg">Stół Prezydialny</div>
            <div className="w-full flex justify-between px-4 mt-6">
              <div className="w-12 h-12 rounded-full border-2 border-[#C5A27D] bg-white flex justify-center items-center font-serif text-[#C5A27D] shadow-sm">1</div>
              <div className="w-12 h-12 rounded-full border-2 border-[#C5A27D] bg-white flex justify-center items-center font-serif text-[#C5A27D] shadow-sm">2</div>
            </div>
            <div className="w-full flex justify-center mt-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#C5A27D] bg-white flex justify-center items-center font-serif text-[#C5A27D] shadow-sm">3</div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none mt-8">
              <span className="font-serif text-5xl">Parkiet</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
