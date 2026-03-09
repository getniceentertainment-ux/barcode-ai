"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, PlayCircle, Loader2, CheckCircle2, Waves, Settings2, ArrowRight, Volume2, ListMusic } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

const VOCAL_CHAINS = [
  { id: "chain_01", name: "Atlanta Trap", desc: "Heavy Pitch Correction + Crisp Highs", color: "text-[#E60000]", pitch: 90, reverb: 40 },
  { id: "chain_02", name: "NY Drill", desc: "Dry, Aggressive Compression", color: "text-blue-500", pitch: 20, reverb: 15 },
  { id: "chain_03", name: "R&B Melodic", desc: "Lush Reverb + Stereo Delay", color: "text-purple-500", pitch: 60, reverb: 85 },
  { id: "chain_04", name: "Raw Podcast", desc: "Noise Gate + Vocal Leveler", color: "text-green-500", pitch: 0, reverb: 5 },
];

function createReverb(audioCtx: BaseAudioContext, duration: number, decay: number) {
  const length = audioCtx.sampleRate * duration;
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const n = 1 - i / length;
    left[i] = (Math.random() * 2 - 1) * Math.pow(n, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(n, decay);
  }
  return impulse;
}

function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [], i, sample, offset = 0, pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);

  for(i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  while(offset < buffer.length) {
      for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
          view.setInt16(pos, sample, true); pos += 2;
      }
      offset++;
  }
  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room05_VocalSuite() {
  const { vocalStems, addVocalStem, removeVocalStem, setActiveRoom, addToast } = useMatrixStore();
  
  const [activeChain, setActiveChain] = useState(VOCAL_CHAINS[0].id);
  const [pitchIntensity, setPitchIntensity] = useState(VOCAL_CHAINS[0].pitch);
  const [reverbMix, setReverbMix] = useState(VOCAL_CHAINS[0].reverb);
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [audioReady, setAudioReady] = useState(false);

  // MUTE & SOLO LOGIC
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());
  const [soloStems, setSoloStems] = useState<Set<string>>(new Set());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const eqRef = useRef<BiquadFilterNode | null>(null);

  const handleSelectChain = (chain: typeof VOCAL_CHAINS[0]) => {
    setActiveChain(chain.id);
    setPitchIntensity(chain.pitch);
    setReverbMix(chain.reverb);
  };

  useEffect(() => {
    if (!vocalStems.length) return;
    const initGraph = () => {
      if (audioCtxRef.current) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverb(ctx, 2.5, 2.0);
      
      const wetGain = ctx.createGain();
      const dryGain = ctx.createGain();
      wetGainRef.current = wetGain; dryGainRef.current = dryGain;

      const eq = ctx.createBiquadFilter();
      eq.type = "peaking"; eq.frequency.value = 2500;
      eqRef.current = eq;

      masterGain.connect(dryGain); masterGain.connect(convolver); convolver.connect(wetGain);
      dryGain.connect(eq); wetGain.connect(eq); eq.connect(ctx.destination);

      vocalStems.forEach(stem => {
        const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
        if (el && !el.dataset.connected) {
          const source = ctx.createMediaElementSource(el);
          source.connect(masterGain);
          el.dataset.connected = "true";
        }
      });
      setAudioReady(true);
    };
    initGraph();
    return () => { if (audioCtxRef.current?.state !== 'closed') { audioCtxRef.current?.close(); audioCtxRef.current = null; }};
  }, [vocalStems]);

  useEffect(() => {
    if (wetGainRef.current && dryGainRef.current) {
      wetGainRef.current.gain.value = reverbMix / 100;
      dryGainRef.current.gain.value = 1 - (reverbMix / 100);
    }
    if (eqRef.current) {
      eqRef.current.Q.value = pitchIntensity / 10;
      eqRef.current.gain.value = pitchIntensity / 5; 
    }
  }, [reverbMix, pitchIntensity]);

  // --- PRO-DAW STEM MUTE/SOLO ENFORCEMENT ---
  useEffect(() => {
    vocalStems.forEach(stem => {
      const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
      if (el) {
        const isMuted = mutedStems.has(stem.id) || (soloStems.size > 0 && !soloStems.has(stem.id));
        el.muted = isMuted; // Completely silences the MediaElementSource feeding the DSP graph
      }
    });
  }, [mutedStems, soloStems, vocalStems]);

  // --- PRO-DAW SYNC ENGINE ---
  useEffect(() => {
    const handleSysPlay = () => {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      vocalStems.forEach(stem => document.getElementById(`audio-stem-${stem.id}`)?.play());
    };
    const handleSysPause = () => vocalStems.forEach(stem => (document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement)?.pause());
    const handleSysSeek = (e: any) => vocalStems.forEach(stem => {
      const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
      if (el) el.currentTime = e.detail;
    });
    const handleSysTimeUpdate = (e: any) => {
      vocalStems.forEach(stem => {
        const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
        if (el && Math.abs(el.currentTime - e.detail) > 0.15) el.currentTime = e.detail; // Anti-Drift
      });
    };

    window.addEventListener('matrix-global-sys-play', handleSysPlay);
    window.addEventListener('matrix-global-sys-pause', handleSysPause);
    window.addEventListener('matrix-global-sys-seek', handleSysSeek);
    window.addEventListener('matrix-global-timeupdate', handleSysTimeUpdate);

    return () => {
      window.removeEventListener('matrix-global-sys-play', handleSysPlay);
      window.removeEventListener('matrix-global-sys-pause', handleSysPause);
      window.removeEventListener('matrix-global-sys-seek', handleSysSeek);
      window.removeEventListener('matrix-global-timeupdate', handleSysTimeUpdate);
    };
  }, [vocalStems]);

  const toggleMute = (id: string) => {
    setMutedStems(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSolo = (id: string) => {
    setSoloStems(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleApplyEngineering = async () => {
    setStatus("processing");
    try {
      if (!vocalStems.length) throw new Error("No vocal stems detected.");

      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffers: AudioBuffer[] = [];
      const activeStemIds: string[] = []; // Keep track of which ones are actually playing
      let maxDuration = 0;

      for (const stem of vocalStems) {
        // AI DSP LOGIC: Do not decode or bake Muted tracks!
        const isMuted = mutedStems.has(stem.id) || (soloStems.size > 0 && !soloStems.has(stem.id));
        if (!isMuted) {
          const resp = await fetch(stem.url);
          const arrayBuf = await resp.arrayBuffer();
          const audioBuf = await tmpCtx.decodeAudioData(arrayBuf);
          decodedBuffers.push(audioBuf);
          activeStemIds.push(stem.id);
          if (audioBuf.duration > maxDuration) maxDuration = audioBuf.duration;
        }
      }

      if (decodedBuffers.length === 0) throw new Error("All stems are muted. Cannot bake silence.");
      if (maxDuration === 0) maxDuration = 10; 

      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const masterGain = offlineCtx.createGain();
      const convolver = offlineCtx.createConvolver();
      convolver.buffer = createReverb(offlineCtx, 2.5, 2.0);
      
      const wetGain = offlineCtx.createGain(); const dryGain = offlineCtx.createGain();
      wetGain.gain.value = reverbMix / 100; dryGain.gain.value = 1 - (reverbMix / 100);

      const eq = offlineCtx.createBiquadFilter();
      eq.type = "peaking"; eq.frequency.value = 2500; eq.Q.value = pitchIntensity / 10; eq.gain.value = pitchIntensity / 5;

      masterGain.connect(dryGain); masterGain.connect(convolver); convolver.connect(wetGain);
      dryGain.connect(eq); wetGain.connect(eq); eq.connect(offlineCtx.destination);

      decodedBuffers.forEach(buf => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buf;
        source.connect(masterGain);
        source.start(0);
      });

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const wavUrl = URL.createObjectURL(wavBlob);

      // Clear ONLY the stems we baked (allows you to keep muted adlibs safely on the side)
      activeStemIds.forEach(id => removeVocalStem(id));
      
      addVocalStem({
        id: `MIXED_STEM_${Date.now()}`,
        type: "Lead",
        url: wavUrl,
        blob: wavBlob,
        volume: 0
      });

      if(addToast) addToast("Vocal Chain encoded successfully. Ready for mastering.", "success");
      setStatus("success");

    } catch (err: any) {
      console.error("DSP Render Error:", err);
      if(addToast) addToast("Error rendering audio: " + err.message, "error");
      setStatus("idle");
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222]">
      
      {vocalStems.map(stem => (
        <audio key={stem.id} id={`audio-stem-${stem.id}`} src={stem.url} crossOrigin="anonymous" preload="auto" className="hidden" />
      ))}

      {/* LEFT COL: AI VOCAL CHAINS */}
      <div className="w-full md:w-1/3 border-r border-[#222] flex flex-col bg-black z-10">
        <div className="p-6 border-b border-[#222]">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <Settings2 size={24} className="text-[#E60000]" /> Engineering
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            Real-Time Web Audio DSP Mix Bus
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <p className="text-[10px] text-[#888] font-mono uppercase tracking-widest mb-4 ml-2">Select Mix Preset</p>
          {VOCAL_CHAINS.map(chain => (
            <button
              key={chain.id} onClick={() => handleSelectChain(chain)} disabled={status !== "idle"}
              className={`w-full text-left p-4 border transition-all flex flex-col gap-2 disabled:opacity-30
                ${activeChain === chain.id ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a] hover:border-[#555]'}`}
            >
              <span className={`font-oswald text-lg uppercase tracking-widest font-bold ${activeChain === chain.id ? 'text-white' : 'text-gray-400'}`}>{chain.name}</span>
              <span className="font-mono text-[9px] text-[#888] uppercase tracking-widest">{chain.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT COL: MACRO CONTROLS & PROCESSING */}
      <div className="flex-1 flex flex-col p-8 md:p-12 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none"><Waves size={400} /></div>

        <div className="relative z-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
          {audioReady && status === "idle" && (
             <div className="text-[10px] text-green-500 font-mono uppercase tracking-widest flex items-center gap-2 mb-6 bg-green-500/10 border border-green-500/20 px-4 py-2 self-start">
               <Volume2 size={14} /> Live Preview Active: Play Global Beat Below
             </div>
          )}

          {/* STEM CONTROL MATRIX */}
          {vocalStems.length > 0 && status === "idle" && (
            <div className="bg-black border border-[#222] p-6 mb-8 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <h3 className="font-oswald text-lg uppercase tracking-widest text-[#E60000] mb-4 border-b border-[#222] pb-3 flex items-center gap-2">
                <ListMusic size={16} /> Stem Control Matrix
              </h3>
              <div className="space-y-2">
                {vocalStems.map(stem => {
                  const isMuted = mutedStems.has(stem.id);
                  const isSolo = soloStems.has(stem.id);
                  return (
                    <div key={stem.id} className={`flex justify-between items-center bg-[#0a0a0a] p-3 border transition-colors ${isMuted && soloStems.size === 0 ? 'border-[#330000] opacity-50' : 'border-[#222]'}`}>
                      <div className="flex items-center gap-3">
                         <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 ${stem.type === 'Lead' ? 'bg-[#E60000] text-white' : 'bg-[#222] text-[#888]'}`}>{stem.type}</span>
                         <span className="font-mono text-[10px] text-white uppercase tracking-widest">{stem.id.substring(5, 18)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={() => toggleMute(stem.id)} className={`w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-bold transition-all ${isMuted ? 'bg-red-950 text-red-500 border border-red-500' : 'bg-[#111] text-[#555] hover:text-white border border-[#333]'}`}>M</button>
                         <button onClick={() => toggleSolo(stem.id)} className={`w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-bold transition-all ${isSolo ? 'bg-yellow-950 text-yellow-500 border border-yellow-500' : 'bg-[#111] text-[#555] hover:text-white border border-[#333]'}`}>S</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-black border border-[#222] p-8 mb-8">
            <h3 className="font-oswald text-lg uppercase tracking-widest text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2">
              <Sliders size={16} /> Macro Adjustments
            </h3>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Presence / Autotune Shift</label>
                  <span className="text-xs font-mono text-white">{pitchIntensity}%</span>
                </div>
                <input type="range" min="0" max="100" value={pitchIntensity} onChange={(e) => setPitchIntensity(Number(e.target.value))} disabled={status !== "idle"} className="w-full h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#E60000] disabled:opacity-30" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Wet/Dry Mix (Space)</label>
                  <span className="text-xs font-mono text-white">{reverbMix}%</span>
                </div>
                <input type="range" min="0" max="100" value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))} disabled={status !== "idle"} className="w-full h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#E60000] disabled:opacity-30" />
              </div>
            </div>
          </div>

          {/* ACTION AREA */}
          <div className="mt-auto">
            {status === "idle" && (
              <button onClick={handleApplyEngineering} className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-3">
                Bake Audio & Apply Chain <PlayCircle size={20} />
              </button>
            )}
            {status === "processing" && (
              <div className="bg-[#110000] border border-[#E60000] p-6 flex flex-col items-center text-center animate-pulse">
                <Loader2 size={32} className="text-[#E60000] animate-spin mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white">Baking WAV Engine...</p>
              </div>
            )}
            {status === "success" && (
              <div className="bg-green-500/10 border border-green-500/30 p-6 flex flex-col items-center text-center animate-in zoom-in">
                <CheckCircle2 size={32} className="text-green-500 mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6">Vocals Encoded</p>
                <button onClick={() => setActiveRoom("06")} className="w-full bg-white text-black py-4 font-oswald text-md font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex justify-center items-center gap-3">
                  Proceed to Mastering <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}