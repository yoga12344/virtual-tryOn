
import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, RefreshCw, Zap, User, Shirt as ShirtIcon,
  Download, AlertTriangle, Terminal, Ruler, Cpu, Box, ScanLine, Layers
} from 'lucide-react';
import { analyzeTryOn, generateVirtualTryOnImage } from '../services/geminiService';
import { generateIdmVtonTryOn } from '../services/idmVtonService';
import { GeminiResult, ImageUploads, Gender, BodySize, TryOnEngine } from '../types';

const normalizeImage = (base64: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (maxDim / width) * height;
          width = maxDim;
        } else {
          width = (maxDim / height) * width;
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error("Image decoding failure."));
    img.src = base64;
  });
};

interface TryOnDemoProps {
  genderSelection: Gender;
}

const TryOnDemo: React.FC<TryOnDemoProps> = ({ genderSelection }) => {
  const [images, setImages] = useState<ImageUploads>({ person: null, shirt: null, pant: null, dress: null });
  const [selectedSize, setSelectedSize] = useState<BodySize>('M');
  const [engine, setEngine] = useState<TryOnEngine>('gemini');
  const [status, setStatus] = useState<'idle' | 'grounding' | 'synthesizing' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<GeminiResult>({
    garmentDescription: '',
    personDescription: '',
    technicalPrompt: '',
    status: 'idle',
    error: ''
  });

  const personInputRef = useRef<HTMLInputElement>(null);
  const shirtInputRef = useRef<HTMLInputElement>(null);
  const pantInputRef = useRef<HTMLInputElement>(null);
  const dressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    reset();
  }, [genderSelection]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} // ${msg}`].slice(-4));
  };

  const handleFileChange = (type: keyof ImageUploads) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const normalized = await normalizeImage(reader.result as string);
        setImages(prev => ({ ...prev, [type]: normalized }));
        addLog(`${type.toUpperCase()} asset injected into neural cache.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!images.person || (!images.shirt && !images.pant && !images.dress)) return;
    setStatus('grounding');
    setResult(prev => ({ ...prev, error: '' }));
    setLogs([]);

    try {
      if (engine === 'idm-vton') {
        // IDM-VTON: direct diffusion-based try-on (top only)
        if (!images.shirt) {
          throw new Error("IDM-VTON only supports upper-body garments (tops). Please upload a top.");
        }
        addLog(`Engine: IDM-VTON (HuggingFace Diffusion)`);
        setStatus('synthesizing');
        addLog(`Connecting to HuggingFace Space... This may take 30-90 seconds.`);

        const finalImage = await generateIdmVtonTryOn(
          images.person,
          images.shirt,
          "a garment"
        );

        if (!finalImage) throw new Error("IDM-VTON synthesis returned empty.");
        setResult(prev => ({ ...prev, resultImageUrl: finalImage, status: 'success', technicalPrompt: 'IDM-VTON diffusion synthesis' }));
        setStatus('success');
        addLog("IDM-VTON synthesis complete — high-fidelity output rendered.");
      } else {
        // Gemini: two-phase analysis + synthesis
        addLog(`Engine: Gemini Neural • Phase 1: Analyzing skeletal landmarks...`);

        const analysis = await analyzeTryOn(images.person, images.shirt, images.pant, images.dress, genderSelection, selectedSize);
        setResult(prev => ({ ...prev, ...analysis }));
        addLog(`Grounding complete. Detected ${analysis.sleeveLength} sleeve geometry.`);

        setStatus('synthesizing');
        addLog(`Phase 2: Depth synthesis (${selectedSize} Fit, Un-tucked fit locked)...`);

        const finalImage = await generateVirtualTryOnImage(
          images.person, images.shirt, images.pant, images.dress,
          analysis.technicalPrompt, selectedSize, genderSelection,
          analysis.sleeveLength
        );

        if (!finalImage) throw new Error("Synthesis output empty.");
        setResult(prev => ({ ...prev, resultImageUrl: finalImage, status: 'success' }));
        setStatus('success');
        addLog("Wealth & Depth protocol successfully executed.");
      }
    } catch (err: any) {
      setResult(prev => ({ ...prev, error: err.message || 'Processing fault.' }));
      setStatus('error');
      addLog(`${engine === 'idm-vton' ? 'IDM-VTON' : 'Neural'} engine aborted.`);
    }
  };

  const reset = () => {
    setImages({ person: null, shirt: null, pant: null, dress: null });
    setResult({ garmentDescription: '', personDescription: '', technicalPrompt: '', status: 'idle', error: '' });
    setStatus('idle');
    setLogs([]);
  };

  const accentColor = 'text-[#50C878]';
  const emeraldHex = '#50C878';

  return (
    <div className="px-6 max-w-[1400px] mx-auto pb-20">
      <div className="grid lg:grid-cols-12 gap-10 items-start">
        {/* Lab Panel */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass rounded-[3rem] p-8 border-emerald-900/20 space-y-10 shadow-2xl relative overflow-hidden">

            <div className="space-y-4">
              <label className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.4em] flex items-center gap-3">
                <ScanLine className={`w-4 h-4 ${accentColor}`} /> 01 // Target Subject
              </label>
              <div
                className="relative aspect-[3/4] rounded-[2.5rem] border border-emerald-900/30 bg-emerald-950/10 overflow-hidden cursor-pointer hover:border-[#50C878]/50 transition-all group"
                onClick={() => personInputRef.current?.click()}
              >
                {images.person ? (
                  <img src={images.person} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="Subject" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-all">
                    <div className="p-5 bg-emerald-950/50 rounded-full mb-5">
                      <Upload className={`w-8 h-8 ${accentColor}`} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#50C878]">Upload Portrait</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-8">
                  <p className="text-[8px] font-black text-[#50C878] uppercase tracking-widest">Update Source</p>
                </div>
              </div>
              <input type="file" ref={personInputRef} className="hidden" accept="image/*" onChange={handleFileChange('person')} />
            </div>

            {/* Engine Toggle */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.4em] flex items-center gap-3">
                <Layers className={`w-4 h-4 ${accentColor}`} /> 02 // Engine
              </label>
              <div className="grid grid-cols-2 gap-2 bg-emerald-950/40 p-1.5 rounded-2xl border border-emerald-900/10">
                <button
                  onClick={() => setEngine('gemini')}
                  className={`py-3 rounded-xl text-[9px] font-black tracking-wider transition-all ${engine === 'gemini' ? 'bg-[#50C878] text-[#020605] shadow-[0_0_20px_rgba(80,200,120,0.4)]' : 'text-emerald-700 hover:text-emerald-300'}`}
                >
                  ✦ GEMINI
                </button>
                <button
                  onClick={() => setEngine('idm-vton')}
                  className={`py-3 rounded-xl text-[9px] font-black tracking-wider transition-all ${engine === 'idm-vton' ? 'bg-[#50C878] text-[#020605] shadow-[0_0_20px_rgba(80,200,120,0.4)]' : 'text-emerald-700 hover:text-emerald-300'}`}
                >
                  ◆ IDM-VTON
                </button>
              </div>
              {engine === 'idm-vton' && (
                <p className="text-[8px] font-bold text-amber-500/80 uppercase tracking-widest text-center">
                  Top garments only • ~30-90s queue
                </p>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.4em] flex items-center gap-3">
                <Box className={`w-4 h-4 ${accentColor}`} /> 03 // Asset Configuration
              </label>
              <div className={`grid ${genderSelection === 'WOMEN' && engine === 'gemini' ? 'grid-cols-3' : engine === 'idm-vton' ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                <AssetSlot img={images.shirt} label="Top" onClick={() => shirtInputRef.current?.click()} accentColor={accentColor} />
                {engine === 'gemini' && genderSelection === 'WOMEN' && (
                  <AssetSlot img={images.dress} label="Dress" onClick={() => dressInputRef.current?.click()} accentColor={accentColor} />
                )}
                {engine === 'gemini' && (
                  <AssetSlot img={images.pant} label="Bottom" onClick={() => pantInputRef.current?.click()} accentColor={accentColor} />
                )}
              </div>
            </div>

            {engine === 'gemini' && (
              <div className="space-y-5">
                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.4em] flex items-center gap-3">
                  <Ruler className={`w-4 h-4 ${accentColor}`} /> 04 // Physical Alignment
                </label>
                <div className="grid grid-cols-3 gap-2 bg-emerald-950/40 p-1.5 rounded-2xl border border-emerald-900/10">
                  {(['S', 'M', 'L'] as BodySize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`py-4 rounded-xl text-[10px] font-black transition-all ${selectedSize === size ? 'bg-[#50C878] text-[#020605] shadow-[0_0_20px_rgba(80,200,120,0.4)]' : 'text-emerald-700 hover:text-emerald-300'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between px-2 text-[8px] font-black text-emerald-900 uppercase tracking-widest">
                  <span>Slim Fit</span>
                  <span>Standard</span>
                  <span>Relaxed</span>
                </div>
              </div>
            )}

            <button
              disabled={!images.person || (engine === 'idm-vton' ? !images.shirt : (!images.shirt && !images.pant && !images.dress)) || status === 'grounding' || status === 'synthesizing'}
              onClick={handleProcess}
              className="w-full py-8 rounded-[2rem] bg-[#50C878] hover:bg-[#62e08c] transition-all font-black text-xs uppercase tracking-[0.5em] flex items-center justify-center gap-5 shadow-2xl active:scale-95 text-[#020605]"
            >
              {status === 'grounding' || status === 'synthesizing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
              {status === 'grounding' ? 'Analyzing Depth' : status === 'synthesizing' ? 'Synthesizing...' : engine === 'idm-vton' ? 'Run IDM-VTON' : 'Apply Neural Draping'}
            </button>

            {logs.length > 0 && (
              <div className="mt-6 p-5 bg-emerald-950/60 rounded-[1.5rem] border border-emerald-900/10 font-mono text-[9px] space-y-2">
                {logs.map((log, i) => (
                  <p key={i} className="text-emerald-800">
                    <span className={accentColor}>{" > "}</span> {log}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Viewport Panel */}
        <div className="lg:col-span-8 flex flex-col h-full min-h-[750px]">
          <div className="flex-1 rounded-[3.5rem] bg-emerald-950/10 border border-emerald-900/10 overflow-hidden relative shadow-[inset_0_0_100px_rgba(0,0,0,0.4)] flex items-center justify-center">
            {status === 'idle' ? (
              <div className="text-center space-y-8 opacity-20">
                <Cpu className={`w-12 h-12 mx-auto ${accentColor}`} />
                <p className={`text-[11px] font-black uppercase tracking-[1em] ${accentColor}`}>Awaiting Neural Signal</p>
              </div>
            ) : status === 'error' ? (
              <div className="text-center space-y-8 p-16">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <p className="text-emerald-700 text-sm font-medium max-w-xs mx-auto leading-relaxed">{result.error}</p>
                <button onClick={reset} className="px-12 py-5 rounded-full bg-emerald-900/20 border border-emerald-500/10 font-black text-[10px] uppercase tracking-widest text-emerald-100 hover:bg-emerald-800 transition-colors">Re-initialize</button>
              </div>
            ) : (status === 'grounding' || status === 'synthesizing') ? (
              <div className="flex flex-col items-center gap-14">
                <div className="relative">
                  <div className="w-32 h-32 border-4 border-emerald-950 border-t-[#50C878] rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className={`w-8 h-8 ${accentColor} animate-pulse`} />
                  </div>
                </div>
                <div className="text-center space-y-5">
                  <span className={`text-[14px] font-black uppercase tracking-[1.2em] ${accentColor} animate-pulse block`}>
                    {status === 'grounding' ? 'Grounding Landmarks' : `Deep Synthesis ${selectedSize}`}
                  </span>
                  <p className="text-[10px] text-emerald-900 uppercase tracking-widest font-bold">Un-tucked protocol applied</p>
                </div>
              </div>
            ) : result.resultImageUrl ? (
              <div className="relative w-full h-full flex items-center justify-center p-12 animate-in fade-in zoom-in duration-1000">
                <img
                  src={result.resultImageUrl}
                  className="max-h-[85vh] object-contain rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] border border-emerald-900/20"
                  alt="Neural Output"
                />

                <div className="absolute top-10 right-10 flex gap-4">
                  <button onClick={reset} className="px-8 py-5 rounded-[1.5rem] bg-[#020605]/80 border border-emerald-900/20 text-[10px] font-black uppercase tracking-widest backdrop-blur-3xl transition-all text-emerald-600 hover:text-[#50C878] hover:border-[#50C878]/30">
                    Clear Studio
                  </button>
                  <a href={result.resultImageUrl} download="wealth_depth_tryon.png" className="px-8 py-5 rounded-[1.5rem] bg-[#50C878] text-[#020605] font-black text-[10px] uppercase tracking-widest flex items-center gap-4 shadow-2xl hover:scale-105 transition-transform">
                    <Download className="w-5 h-5" /> Export Result
                  </a>
                </div>

                <div className="absolute bottom-10 left-10 flex flex-col gap-4">
                  <div className="glass p-8 rounded-[2rem] border-emerald-900/10 max-w-md space-y-6">
                    <div className="flex items-center gap-4 border-b border-emerald-900/10 pb-4">
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Terminal className={`w-4 h-4 ${accentColor}`} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-800">Wealth & Depth Telemetry</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="px-4 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-800/20 text-[9px] font-black uppercase text-[#50C878]">
                          {selectedSize} RELAXED FIT
                        </div>
                        <div className="px-4 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-800/20 text-[9px] font-black uppercase text-emerald-700">
                          {result.sleeveLength} GEOMETRY
                        </div>
                      </div>
                      <div className="bg-black/20 p-4 rounded-xl">
                        <p className="text-[9px] font-black text-emerald-900 uppercase tracking-widest mb-2">{" >> "} SYNTHESIS_LOG</p>
                        <p className="text-[11px] text-emerald-200 font-medium italic leading-relaxed">{result.technicalPrompt}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <input type="file" ref={shirtInputRef} className="hidden" onChange={handleFileChange('shirt')} />
      <input type="file" ref={pantInputRef} className="hidden" onChange={handleFileChange('pant')} />
      <input type="file" ref={dressInputRef} className="hidden" onChange={handleFileChange('dress')} />
    </div>
  );
};

const AssetSlot = ({ img, label, onClick, accentColor }: { img: string | null, label: string, onClick: () => void, accentColor: string }) => (
  <div
    onClick={onClick}
    className="aspect-square rounded-[1.8rem] border border-emerald-900/20 bg-emerald-950/20 overflow-hidden cursor-pointer group hover:border-[#50C878]/40 transition-all flex flex-col items-center justify-center relative shadow-inner"
  >
    {img ? (
      <img src={img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt={label} />
    ) : (
      <div className="opacity-20 group-hover:opacity-100 flex flex-col items-center transition-all">
        <Upload className={`w-7 h-7 mb-3 ${accentColor}`} />
        <span className="text-[9px] font-black uppercase tracking-widest text-[#50C878]">{label}</span>
      </div>
    )}
    <div className="absolute inset-x-0 bottom-0 py-2 bg-black/40 backdrop-blur-md translate-y-full group-hover:translate-y-0 transition-transform flex justify-center">
      <span className="text-[7px] font-black text-[#50C878] uppercase">Update</span>
    </div>
  </div>
);

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.5 9L21.5 11.5L14.5 14L12 21L9.5 14L2.5 11.5L9.5 9L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default TryOnDemo;
