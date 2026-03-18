"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, PlayCircle, Loader2, CheckCircle2, Waves, Settings2, ArrowRight, Volume2, ListMusic, Headphones, Trash2, Activity } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

const FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const VOCAL_CHAINS = [
  { id: "getnice_eq", name: "GetNice EQ", desc: "Signature Introspective, Vocal-Forward", color: "text-[#E60000]", comp: { ratio: 2, attack: 0.030, release: 0.125, knee: 40, threshold: -24 }, eq: [2, 1, -1, -2, 0, 1.5, 2, 1, 2, 1.5], presence: 30, reverb: 25 },
  { id: "foundation_eq", name: "Foundation EQ", desc: "Boom Bap / Golden Age Gritty Punch", color: "text-yellow-500", comp: { ratio: 4, attack: 0.012, release: 0.045, knee: 0, threshold: -28 }, eq: [3, 3, 0, 0, 0, 0, 0, -1, -2, -4], presence: 10, reverb: 15 },
  { id: "gangsta_eq", name: "Gangsta EQ", desc: "Trap / Southern 808 Heavy", color: "text-purple-500", comp: { ratio: 3, attack: 0.035, release: 0.100, knee: 0, threshold: -26 }, eq: [4, 0, 0, -3, 0, 0, 0, 0, 1.5, 3], presence: 60, reverb: 30 },
  { id: "modern_eq", name: "Modern EQ", desc: "Drill / Hyper-Controlled & Scooped", color: "text-blue-500", comp: { ratio: 5, attack: 0.003, release: 0.050, knee: 0, threshold: -30 }, eq: [0, 2, 0, 0, -2, 0, 0, 2, 0, 0], presence: 40, reverb: 45 },
];

function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44, bufferArray = new ArrayBuffer(length), view = new DataView(bufferArray), pos = 0;
  const setUint32 = (d: number) => { view.setUint32(pos, d, true); pos += 4; };
  const setUint16 = (d: number) => { view.setUint16(pos, d, true); pos += 2; };
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
  const channels = []; for(let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  for(let offset = 0; offset < buffer.length; offset++) { for(let i = 0; i < numOfChan; i++) { let s = Math.max(-1, Math.min(1, channels[i][offset])); s = (0.5 + s < 0 ? s * 32768 : s * 32767) | 0; view.setInt16(pos, s, true); pos += 2; }}
  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room05_VocalSuite() {
  const { vocalStems, addVocalStem, removeVocalStem, setActiveRoom, addToast } = useMatrixStore();
  const [activeChain, setActiveChain] = useState(VOCAL_CHAINS[0].id);
  const [presenceIntensity, setPresenceIntensity] = useState(VOCAL_CHAINS[0].presence);
  const [reverbMix, setReverbMix] = useState(VOCAL_CHAINS[0].reverb);
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());

  const audioCtxRef = useRef<AudioContext | null>(null);

  const handleApplyEngineering = async () => {
    setStatus("processing");
    try {
      const tmpCtx = new AudioContext(); const decodedBuffers: AudioBuffer[] = []; const activeStemIds: string[] = []; let maxDuration = 0;
      for (const stem of vocalStems) { if (!mutedStems.has(stem.id)) { const resp = await fetch(stem.url); const audioBuf = await tmpCtx.decodeAudioData(await resp.arrayBuffer()); decodedBuffers.push(audioBuf); activeStemIds.push(stem.id); if (audioBuf.duration > maxDuration) maxDuration = audioBuf.duration; }}
      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const renderedBuffer = await offlineCtx.startRendering();
      activeStemIds.forEach(id => removeVocalStem(id));
      addVocalStem({ id: `MIXED_${Date.now()}`, type: "Lead", url: URL.createObjectURL(audioBufferToWav(renderedBuffer)), volume: 0, offsetBars: 0 });
      setStatus("success");
    } catch (err: any) { setStatus("idle"); if(addToast) addToast(err.message, "error"); }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] border border-[#222]">
      {vocalStems.map(s => <audio key={s.id} id={`audio-stem-${s.id}`} src={s.url} crossOrigin="anonymous" className="hidden" />)}
      <div className="w-full md:w-1/3 border-r border-[#222] flex flex-col bg-black">
        <div className="p-6 border-b border-[#222] bg-[#050505]"><h2 className="font-oswald text-2xl uppercase font-bold text-white flex items-center gap-3"><Settings2 size={24} className="text-[#E60000]" /> Engineering</h2></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {VOCAL_CHAINS.map(c => (
            <button key={c.id} onClick={() => { setActiveChain(c.id); setPresenceIntensity(c.presence); setReverbMix(c.reverb); }} className={`w-full text-left p-4 border transition-all ${activeChain === c.id ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a]'}`}>
              <span className={`font-oswald text-lg uppercase font-bold ${activeChain === c.id ? 'text-white' : 'text-gray-400'}`}>{c.name}</span>
              <span className="font-mono text-[9px] text-[#888] block mt-1">{c.desc}</span>
            </button>
          ))}
        </div>
        <div className="h-64 bg-[#020202] border-t border-[#222] p-4 overflow-y-auto custom-scrollbar">
           <h3 className="text-[10px] font-bold text-[#555] uppercase mb-4 flex items-center gap-2"><ListMusic size={12} /> Vocal Matrix</h3>
           {vocalStems.map(s => (
             <div key={s.id} className="flex items-center gap-2 bg-[#0a0a0a] p-2 border border-[#111] mb-1 group">
               <Headphones size={12} className={mutedStems.has(s.id) ? 'text-[#333]' : 'text-green-500'} />
               <span className="font-mono text-[9px] text-white truncate flex-1 uppercase">{s.id.substring(0, 10)}</span>
               <button onClick={() => setMutedStems(prev => { const n = new Set(prev); if(n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} className={`w-6 h-6 flex items-center justify-center text-[8px] font-bold border ${mutedStems.has(s.id) ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#444]'}`}>M</button>
             </div>
           ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col p-12 relative overflow-hidden bg-black">
        <div className="relative z-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
          <div className="bg-black/40 backdrop-blur-sm border border-[#222] p-8 mb-8">
            <h3 className="font-oswald text-lg uppercase text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2"><Sliders size={16} /> Macro Adjustments</h3>
            <div className="space-y-10">
              <div><label className="text-[10px] font-mono uppercase text-[#888]">Presence</label><input type="range" min="0" max="100" value={presenceIntensity} onChange={(e) => setPresenceIntensity(Number(e.target.value))} className="w-full accent-[#E60000]" /></div>
              <div><label className="text-[10px] font-mono uppercase text-[#888]">Reverb</label><input type="range" min="0" max="100" value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))} className="w-full accent-[#E60000]" /></div>
            </div>
          </div>
          <div className="mt-auto">
            {status === "idle" && <button onClick={handleApplyEngineering} disabled={vocalStems.length === 0} className="w-full bg-[#E60000] text-white py-6 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-3">Bake & Apply Chain <PlayCircle size={20} /></button>}
            {status === "processing" && <div className="bg-[#110000] border-2 border-[#E60000] p-10 flex flex-col items-center animate-pulse"><Loader2 size={32} className="text-[#E60000] animate-spin mb-4" /><p className="font-oswald text-xl uppercase font-bold text-white">Rendering Matrix...</p></div>}
            {status === "success" && <div className="bg-green-950/20 border-2 border-green-500/50 p-10 flex flex-col items-center animate-in zoom-in"><button onClick={() => setActiveRoom("06")} className="w-full bg-white text-black py-4 font-oswald text-md font-bold uppercase transition-all flex justify-center items-center gap-3">Proceed to Mastering <ArrowRight size={18} /></button></div>}
          </div>
        </div>
      </div>
    </div>
  );
}