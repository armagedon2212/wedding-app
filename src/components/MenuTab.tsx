import { motion } from 'motion/react';

export default function MenuTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 pt-10">
      <div className="mb-10 text-center">
        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Menu</span>
        <h1 className="font-serif text-4xl italic text-[#4A5D4E]">Karta Dań</h1>
      </div>
      
      <div className="bg-white rounded-[32px] shadow-sm border border-[#EAE8E2] p-8 space-y-10 relative overflow-hidden">
        {/* Dekoracyjne menu borders */}
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-[#EAE8E2] rounded-[24px]"></div>

        <section className="text-center relative z-10">
          <h2 className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#C5A27D] mb-2">Przystawka</h2>
          <p className="text-[#2D2D2D] font-serif italic text-xl">Tatar z łososia norweskiego</p>
          <p className="text-[#555] text-sm mt-1.5">z kaparami, czerwoną cebulą i oliwą truflową</p>
        </section>
        
        <div className="w-8 h-[1px] bg-[#EAE8E2] mx-auto"></div>

        <section className="text-center relative z-10">
          <h2 className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#C5A27D] mb-2">Zupa</h2>
          <p className="text-[#2D2D2D] font-serif italic text-xl">Tradycyjny rosół z kury zielononóżki</p>
          <p className="text-[#555] text-sm mt-1.5">z domowym makaronem domowej roboty</p>
        </section>

        <div className="w-8 h-[1px] bg-[#EAE8E2] mx-auto"></div>

        <section className="text-center relative z-10">
          <h2 className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#C5A27D] mb-2">Danie Główne</h2>
          <p className="text-[#2D2D2D] font-serif italic text-xl">Polędwiczki wieprzowe w sosie kurkowym</p>
          <p className="text-[#555] text-sm mt-1.5">podawane z puree ziemniaczanym i bukietem świeżych sałat</p>
        </section>
        
        <div className="w-8 h-[1px] bg-[#EAE8E2] mx-auto"></div>

        <section className="text-center relative z-10">
          <h2 className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#C5A27D] mb-2">Deser</h2>
          <p className="text-[#2D2D2D] font-serif italic text-xl">Panna Cotta z musem miętowym</p>
          <p className="text-[#555] text-sm mt-1.5">wzbogacona owocami leśnymi i kruszonką bazyliową</p>
        </section>
      </div>
    </motion.div>
  );
}
