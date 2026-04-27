
import React, { useState } from 'react';
import TryOnDemo from './components/TryOnDemo';
import { Gender } from './types';
import { Zap, ChevronRight, LayoutGrid, Sparkles } from 'lucide-react';

function App() {
  const [currentGender, setCurrentGender] = useState<Gender>('MEN');
  const [showStudio, setShowStudio] = useState(false);

  // Wealth & Depth Palette Implementation
  const wealthPalette = {
    emerald: '#50C878',
    forest: '#004B3B',
    depth: '#0B3D2E',
    void: '#020605'
  };

  if (!showStudio) {
    return (
      <div className="min-h-screen bg-[#020605] text-white flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
        {/* Cinematic Ambient Depth */}
        <div className="fixed top-[-10%] left-[-10%] w-[80vw] h-[80vh] bg-[#004B3B]/20 rounded-full blur-[160px] pointer-events-none animate-float-luxury-1" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[80vw] h-[80vh] bg-[#0B3D2E]/30 rounded-full blur-[180px] pointer-events-none animate-float-luxury-2" />

        <div className="max-w-5xl flex flex-col items-center space-y-16 relative z-10">
          <div className="flex flex-col items-center space-y-4">
             <div className="px-4 py-2 bg-emerald-950/40 border border-emerald-500/20 rounded-full flex items-center gap-3 animate-bounce">
                <Sparkles className="w-4 h-4 text-[#50C878]" />
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-[#50C878]">Neural Try-On v3.0</span>
             </div>
             <h1 className="text-8xl md:text-[160px] font-black tracking-tighter leading-none select-none">
              <span className="opacity-40">THE</span><br/>
              <span className="gradient-text">LUXURY.</span>
            </h1>
          </div>
          
          <div className="space-y-6 max-w-xl">
            <p className="text-[#50C878] text-2xl font-light tracking-wide uppercase">
              Wealth of Detail. Depth of Synthesis.
            </p>
            <p className="text-emerald-900/60 text-lg leading-relaxed">
              Experience photorealistic garment draping powered by Gemini. 
              Precision skeletal grounding meets high-fidelity textile rendering.
            </p>
          </div>

          <div className="pt-8 w-full flex justify-center">
            <button 
              onClick={() => setShowStudio(true)}
              className="group relative flex items-center justify-center gap-4 px-16 py-8 bg-[#50C878] hover:bg-[#62e08c] text-[#020605] rounded-full font-black text-sm uppercase tracking-[0.4em] transition-all shadow-[0_0_50px_rgba(80,200,120,0.3)] hover:scale-105 active:scale-95"
            >
              <LayoutGrid className="w-5 h-5" />
              Enter Neural Studio
            </button>
          </div>
        </div>

        <div className="fixed bottom-12 opacity-40 text-[9px] font-black tracking-[0.8em] uppercase text-emerald-800">
          WEALTH & DEPTH PROTOCOL • ENCRYPTED CONNECTION
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020605] text-white selection:bg-[#50C878]/30 font-sans relative overflow-hidden">
      {/* Wealth & Depth Ambient Layering */}
      <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-b from-[#0B3D2E]/20 via-transparent to-transparent pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[600px] h-[600px] bg-[#004B3B]/10 rounded-full blur-[140px] pointer-events-none animate-float-luxury-1" />
      <div className="fixed bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-[#50C878]/5 rounded-full blur-[120px] pointer-events-none animate-float-luxury-2" />

      <header className="pt-12 pb-12 flex flex-col items-center relative z-10">
        <button 
          onClick={() => setShowStudio(false)}
          className="absolute left-6 md:left-12 top-14 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-800 hover:text-[#50C878] transition-colors group"
        >
          <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> Exit Studio
        </button>

        <div className="text-center space-y-2">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase flex items-center gap-4 justify-center">
            <span className="opacity-20 text-emerald-600">03</span>
            <span className="gradient-text">NEURAL STUDIO</span>
          </h2>
          <p className="text-emerald-900/40 text-[9px] font-bold tracking-[0.6em] uppercase">
            Skeletal Integrity Verified • Wealth & Depth Protocol Active
          </p>
        </div>

        <div className="mt-12 flex bg-emerald-950/30 p-1 rounded-2xl border border-emerald-900/20 backdrop-blur-3xl shadow-2xl">
          <button 
            onClick={() => setCurrentGender('MEN')}
            className={`px-12 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${currentGender === 'MEN' ? 'text-[#020605] bg-[#50C878] shadow-xl' : 'text-emerald-700 hover:text-emerald-400'}`}
          >
            MENSWEAR
          </button>
          <button 
            onClick={() => setCurrentGender('WOMEN')}
            className={`px-12 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all ${currentGender === 'WOMEN' ? 'text-[#020605] bg-[#50C878] shadow-xl' : 'text-emerald-700 hover:text-emerald-400'}`}
          >
            WOMENSWEAR
          </button>
        </div>
      </header>

      <main className="pb-32 relative z-10">
        <TryOnDemo genderSelection={currentGender} />
      </main>

      <footer className="py-12 border-t border-emerald-900/10 text-center opacity-30">
        <p className="text-[9px] font-bold uppercase tracking-[1em] text-emerald-800">
          Architecture by Gemini • Wealth & Depth Series
        </p>
      </footer>
    </div>
  );
}

export default App;
