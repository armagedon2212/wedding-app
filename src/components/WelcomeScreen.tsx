import { motion } from 'motion/react';
import { Heart, Map, Sparkles } from 'lucide-react';

interface Props {
  onEnter: (tabId?: string) => void;
}

export default function WelcomeScreen({ onEnter }: Props) {
  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, #d4c5b9 0%, transparent 40%)' }}></div>
      <div className="absolute bottom-0 right-0 w-full h-full opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 90% 80%, #d4c5b9 0%, transparent 40%)' }}></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-sm bg-white rounded-t-[120px] rounded-b-2xl shadow-2xl p-8 relative z-10 text-center border border-[#EAE8E2]"
      >
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-[#4A5D4E] rounded-full flex items-center justify-center text-[#FAF9F6] shadow-lg">
          <Heart size={20} fill="currentColor" />
        </div>

        <div className="mt-8 mb-6">
          <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-[#8C8C8C] mb-2 block">Witamy z całego serca</span>
          <h1 className="font-serif text-4xl italic text-[#4A5D4E] mb-4">Eliza & Miłosz</h1>
        </div>
        
        <p className="text-[#555] text-sm leading-relaxed mb-10">
          Cieszymy się ogromnie, że jesteście z nami w tym wyjątkowym dniu. Stworzyliśmy tę aplikację, aby ułatwić Wam zabawę i wspólnie uwiecznić najpiękniejsze momenty!
        </p>

        <div className="space-y-4">
          <button
            onClick={() => onEnter('gallery')}
            className="group relative w-full inline-flex items-center justify-center gap-3 bg-[#4A5D4E] text-white px-6 py-4 rounded-full hover:bg-[#3D4D40] transition-all shadow-md active:scale-95"
          >
            <Sparkles size={18} />
            <span className="text-xs font-bold tracking-widest uppercase">Dołącz do świętowania</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
