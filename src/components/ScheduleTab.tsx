import { motion } from 'motion/react';

export default function ScheduleTab() {
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
      
      <div className="mt-12 text-center pb-12">
        <p className="text-[#8C8C8C] italic font-serif text-lg">„Miłość pisać trzeba tak, by nawet ślepy widział.”</p>
      </div>
    </motion.div>
  );
}
