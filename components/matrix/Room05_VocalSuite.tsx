"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, PlayCircle, Loader2, CheckCircle2, Waves, Settings2, ArrowRight, Volume2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

const VOCAL_CHAINS = [
  { id: "chain_01", name: "Atlanta Trap", desc: "Heavy Pitch Correction + Crisp Highs", color: "text-[#E60000]", pitch: 90, reverb: 40 },
  { id: "chain_02", name: "NY Drill", desc: "Dry, Aggressive Compression", color: "text-blue-500", pitch: 20, reverb: 15 },
  { id: "chain_03", name: "R&B Melodic", desc: "Lush Reverb + Stereo Delay", color: "text-purple-500", pitch: 60, reverb: 85 },
  { id: "chain_04", name: "Raw Podcast", desc: "Noise Gate + Vocal Leveler", color: "text-green-500", pitch: 0, reverb: 5 },
];

// --- DSP UTILITY: SYNTHETIC REVERB GENERATOR ---
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

// --- DSP UTILITY: WAV ENCODER ---
function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [], i, sample, offset = 0, pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for(i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  
  while(offset < buffer.length) {
      for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale
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

  // REAL-TIME AUDIO REFS
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const eqRef = useRef<BiquadFilterNode | null>(null);

  // Apply Presets
  const handleSelectChain = (chain: typeof VOCAL_CHAINS[0]) => {
    setActiveChain(chain.id);
    setPitchIntensity(chain.pitch);
    setReverbMix(chain.reverb);
  };

  // --- 1. INITIALIZE REAL-TIME AUDIO GRAPH ---
  useEffect(() => {
    if (!vocalStems.length) return;

    // We initialize on first user interaction or mount to allow DOM nodes to catch up
    const initGraph = () => {
      if (audioCtxRef.current) return;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      
      // Reverb Setup
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverb(ctx, 2.5, 2.0); // 2.5s simulated room
      
      const wetGain = ctx.createGain();
      const dryGain = ctx.createGain();
      wetGainRef.current = wetGain;
      dryGainRef.current = dryGain;

      // EQ / "Autotune" Presence Simulator
      const eq = ctx.createBiquadFilter();
      eq.type = "peaking";
      eq.frequency.value = 2500; // Presence boost
      eqRef.current = eq;

      // Routing
      masterGain.connect(dryGain);
      masterGain.connect(convolver);
      convolver.connect(wetGain);
      
      dryGain.connect(eq);
      wetGain.connect(eq);
      eq.connect(ctx.destination);

      // Connect HTML Audio Elements to Graph
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

    return () => {
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
      }
    };
  }, [vocalStems]);

  // --- 2. DYNAMICALLY UPDATE SLIDERS IN REAL-TIME ---
  useEffect(() => {
    if (wetGainRef.current && dryGainRef.current) {
      wetGainRef.current.gain.value = reverbMix / 100;
      dryGainRef.current.gain.value = 1 - (reverbMix / 100);
    }
    if (eqRef.current) {
      // Maps Pitch intensity (0-100) to EQ Q factor/gain to simulate metallic artifacts
      eqRef.current.Q.value = pitchIntensity / 10;
      eqRef.current.gain.value = pitchIntensity / 5; 
    }
  }, [reverbMix, pitchIntensity]);

  // --- 3. SYNC WITH GLOBAL PLAYER ---
  useEffect(() => {
    const handleGlobalPlay = () => {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      vocalStems.forEach(stem => {
        const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
        if (el) el.play().catch(e => console.log("Stem Play Error:", e));
      });
    };
    
    const handleGlobalPause = () => {
      vocalStems.forEach(stem => {
        const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
        if (el) el.pause();
      });
    };

    const handleGlobalSeek = (e: any) => {
      vocalStems.forEach(stem => {
        const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
        if (el && e.detail !== undefined) el.currentTime = e.detail;
      });
    };

    window.addEventListener('matrix-global-play', handleGlobalPlay);
    window.addEventListener('matrix-global-pause', handleGlobalPause);
    window.addEventListener('matrix-global-seek', handleGlobalSeek);

    return () => {
      window.removeEventListener('matrix-global-play', handleGlobalPlay);
      window.removeEventListener('matrix-global-pause', handleGlobalPause);
      window.removeEventListener('matrix-global-seek', handleGlobalSeek);
    };
  }, [vocalStems]);

  // --- 4. OFFLINE AUDIO RENDERER (The Bake) ---
  const handleApplyEngineering = async () => {
    setStatus("processing");
    
    try {
      if (!vocalStems.length) throw new Error("No vocal stems detected.");

      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffers: AudioBuffer[] = [];
      let maxDuration = 0;

      // Fetch and decode raw Blob URLs
      for (const stem of vocalStems) {
        const resp = await fetch(stem.url);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await tmpCtx.decodeAudioData(arrayBuf);
        decodedBuffers.push(audioBuf);
        if (audioBuf.duration > maxDuration) maxDuration = audioBuf.duration;
      }

      if (maxDuration === 0) maxDuration = 10; 

      // Build Offline Context to render at blazing speed
      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      
      const masterGain = offlineCtx.createGain();
      const convolver = offlineCtx.createConvolver();
      convolver.buffer = createReverb(offlineCtx, 2.5, 2.0);
      
      const wetGain = offlineCtx.createGain();
      const dryGain = offlineCtx.createGain();
      wetGain.gain.value = reverbMix / 100;
      dryGain.gain.value = 1 - (reverbMix / 100);

      const eq = offlineCtx.createBiquadFilter();
      eq.type = "peaking";
      eq.frequency.value = 2500;
      eq.Q.value = pitchIntensity / 10;
      eq.gain.value = pitchIntensity / 5;

      // Offline Routing
      masterGain.connect(dryGain);
      masterGain.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(eq);
      wetGain.connect(eq);
      eq.connect(offlineCtx.destination);

      // Play sources directly into the offline master bus
      decodedBuffers.forEach(buf => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buf;
        source.connect(masterGain);
        source.start(0);
      });

      // BAKE IT!
      const renderedBuffer = await offlineCtx.startRendering();
      
      // Convert to WAV Blob
      const wavBlob = audioBufferToWav(renderedBuffer);
      const wavUrl = URL.createObjectURL(wavBlob);

      // Replace old raw stems with the Single Mastered Stem
      vocalStems.forEach(stem => removeVocalStem(stem.id));
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

  const handleProceed = () => {
    setActiveRoom("06");
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222]">
      
      {/* Hidden Audio Elements for Real-Time Preview */}
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
              key={chain.id}
              onClick={() => handleSelectChain(chain)}
              disabled={status !== "idle"}
              className={`w-full text-left p-4 border transition-all flex flex-col gap-2 disabled:opacity-30
                ${activeChain === chain.id ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a] hover:border-[#555]'}`}
            >
              <span className={`font-oswald text-lg uppercase tracking-widest font-bold ${activeChain === chain.id ? 'text-white' : 'text-gray-400'}`}>
                {chain.name}
              </span>
              <span className="font-mono text-[9px] text-[#888] uppercase tracking-widest">
                {chain.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT COL: MACRO CONTROLS & PROCESSING */}
      <div className="flex-1 flex flex-col p-8 md:p-12 relative overflow-hidden">
        {/* Background Visualizer Graphic */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Waves size={400} />
        </div>

        <div className="relative z-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
          
          {audioReady && status === "idle" && (
             <div className="text-[10px] text-green-500 font-mono uppercase tracking-widest flex items-center gap-2 mb-6 bg-green-500/10 border border-green-500/20 px-4 py-2 self-start">
               <Volume2 size={14} /> Live Preview Active: Play Global Beat Below
             </div>
          )}

          <div className="bg-black border border-[#222] p-8 mb-8">
            <h3 className="font-oswald text-xl uppercase tracking-widest text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2">
              <Sliders size={18} /> Macro Adjustments
            </h3>
            
            <div className="space-y-8">
              {/* Pitch Correction Slider */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Presence / Autotune Shift</label>
                  <span className="text-xs font-mono text-white">{pitchIntensity}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={pitchIntensity} onChange={(e) => setPitchIntensity(Number(e.target.value))}
                  disabled={status !== "idle"}
                  className="w-full h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#E60000] disabled:opacity-30"
                />
                <div className="flex justify-between text-[8px] font-mono text-[#555] uppercase mt-1">
                  <span>Natural</span>
                  <span>Robotic</span>
                </div>
              </div>

              {/* Reverb/Space Slider */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Wet/Dry Mix (Space)</label>
                  <span className="text-xs font-mono text-white">{reverbMix}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))}
                  disabled={status !== "idle"}
                  className="w-full h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#E60000] disabled:opacity-30"
                />
                <div className="flex justify-between text-[8px] font-mono text-[#555] uppercase mt-1">
                  <span>Dry (Booth)</span>
                  <span>Wet (Arena)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION AREA */}
          <div className="mt-auto">
            {status === "idle" && (
              <button 
                onClick={handleApplyEngineering}
                className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-3"
              >
                Bake Audio & Apply Chain <PlayCircle size={20} />
              </button>
            )}

            {status === "processing" && (
              <div className="bg-[#110000] border border-[#E60000] p-6 flex flex-col items-center text-center animate-pulse">
                <Loader2 size={32} className="text-[#E60000] animate-spin mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white">Baking WAV Engine...</p>
                <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest mt-2">OfflineAudioContext encoding FX to Blob.</p>
              </div>
            )}

            {status === "success" && (
              <div className="bg-green-500/10 border border-green-500/30 p-6 flex flex-col items-center text-center animate-in zoom-in">
                <CheckCircle2 size={32} className="text-green-500 mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6">Vocals Encoded</p>
                <button 
                  onClick={handleProceed}
                  className="w-full bg-white text-black py-4 font-oswald text-md font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex justify-center items-center gap-3"
                >
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