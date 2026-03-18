"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, PlayCircle, Loader2, CheckCircle2, Waves, Settings2, ArrowRight, Volume2, ListMusic } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

const FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const VOCAL_CHAINS = [
  { id: "getnice_eq", name: "GetNice EQ", desc: "Signature Introspective, Vocal-Forward", color: "text-[#E60000]", comp: { ratio: 2, attack: 0.030, release: 0.125, knee: 40, threshold: -24 }, eq: [2, 1, -1, -2, 0, 1.5, 2, 1, 2, 1.5], presence: 30, reverb: 25 },
  { id: "foundation_eq", name: "Foundation EQ", desc: "Boom Bap / Golden Age Gritty Punch", color: "text-yellow-500", comp: { ratio: 4, attack: 0.012, release: 0.045, knee: 0, threshold: -28 }, eq: [3, 3, 0, 0, 0, 0, 0, -1, -2, -4], presence: 10, reverb: 15 },
  { id: "gangsta_eq", name: "Gangsta EQ", desc: "Trap / Southern 808 Heavy", color: "text-purple-500", comp: { ratio: 3, attack: 0.035, release: 0.100, knee: 0, threshold: -26 }, eq: [4, 0, 0, -3, 0, 0, 0, 0, 1.5, 3], presence: 60, reverb: 30 },
  { id: "modern_eq", name: "Modern EQ", desc: "Drill / Hyper-Controlled & Scooped", color: "text-blue-500", comp: { ratio: 5, attack: 0.003, release: 0.050, knee: 0, threshold: -30 }, eq: [0, 2, 0, 0, -2, 0, 0, 2, 0, 0], presence: 40, reverb: 45 },
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

function makeDistortionCurve(amount: number) {
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels,
      length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length),
      view = new DataView(bufferArray),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
  }

  function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
  }

  setUint32(0x46464952);
  setUint32(length - 8);
  setUint32(0x45564157);
  setUint32(0x20746d66);
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length - pos - 4);

  for(i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

  while(offset < buffer.length) {
      for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
          view.setInt16(pos, sample, true);
          pos += 2;
      }
      offset++;
  }

  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room05_VocalSuite() {
  const { vocalStems, addVocalStem, removeVocalStem, setActiveRoom, addToast } = useMatrixStore();
  
  const [activeChain, setActiveChain] = useState(VOCAL_CHAINS[0].id);
  const [presenceIntensity, setPresenceIntensity] = useState(VOCAL_CHAINS[0].presence);
  const [reverbMix, setReverbMix] = useState(VOCAL_CHAINS[0].reverb);
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [audioReady, setAudioReady] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const eqBandsRef = useRef<BiquadFilterNode[]>([]);
  const compRef = useRef<DynamicsCompressorNode | null>(null);
  const saturationRef = useRef<WaveShaperNode | null>(null);

  useEffect(() => {
    if (!vocalStems.length) return;

    const initGraph = () => {
      if (audioCtxRef.current) return; 

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();

      const convolver = ctx.createConvolver();
      convolver.buffer = createReverb(ctx, 2.5, 2.0); 

      const wetGain = ctx.createGain();
      const dryGain = ctx.createGain();
      wetGainRef.current = wetGain;
      dryGainRef.current = dryGain;

      eqBandsRef.current = FREQUENCIES.map((freq, i) => {
        const band = ctx.createBiquadFilter();
        band.type = i === 0 ? "lowshelf" : i === FREQUENCIES.length - 1 ? "highshelf" : "peaking";
        band.frequency.value = freq;
        return band;
      });

      const compressor = ctx.createDynamicsCompressor();
      compRef.current = compressor;

      const saturation = ctx.createWaveShaper();
      saturation.curve = makeDistortionCurve(presenceIntensity / 2);
      saturation.oversample = '4x';
      saturationRef.current = saturation;

      masterGain.connect(dryGain);
      
      let prevNode: AudioNode = dryGain;
      eqBandsRef.current.forEach(band => {
        prevNode.connect(band);
        prevNode = band;
      });
      
      prevNode.connect(compressor);
      compressor.connect(saturation);
      saturation.connect(ctx.destination);

      masterGain.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(ctx.destination);

      vocalStems.forEach(stem => {
        const el = document.getElementById(`audio-stem-${stem.id}`) as HTMLAudioElement;
        if (el && !(el as any)._routed) {
          try {
            const source = ctx.createMediaElementSource(el);
            source.connect(masterGain);
            (el as any)._routed = true;
          } catch(e) {}
        }
      });

      setAudioReady(true);
    };

    initGraph();

    return () => {
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
    };
  }, [vocalStems]);

  useEffect(() => {
    if (wetGainRef.current && dryGainRef.current) {
      wetGainRef.current.gain.value = reverbMix / 100;
      dryGainRef.current.gain.value = 1 - (reverbMix / 100);
    }

    const preset = VOCAL_CHAINS.find(c => c.id === activeChain) || VOCAL_CHAINS[0];
    
    if (eqBandsRef.current.length === 10) {
      eqBandsRef.current.forEach((band, i) => {
        band.gain.value = preset.eq[i];
      });
    }

    if (compRef.current) {
      compRef.current.ratio.value = preset.comp.ratio;
      compRef.current.attack.value = preset.comp.attack;
      compRef.current.release.value = preset.comp.release;
      compRef.current.knee.value = preset.comp.knee;
      compRef.current.threshold.value = preset.comp.threshold;
    }

    if (saturationRef.current) {
      saturationRef.current.curve = makeDistortionCurve(presenceIntensity / 2);
    }
  }, [reverbMix, presenceIntensity, activeChain]);

  const handleApplyEngineering = async () => {
    setStatus("processing");
    try {
      if (!vocalStems.length) throw new Error("No vocal stems detected.");

      const tmpCtx = new AudioContext();
      
      const decodedBuffers: AudioBuffer[] = [];
      const activeStemIds: string[] = []; 
      
      let maxDuration = 0;
      for (const stem of vocalStems) {
        const resp = await fetch(stem.url);
        const audioBuf = await tmpCtx.decodeAudioData(await resp.arrayBuffer());
        decodedBuffers.push(audioBuf);
        activeStemIds.push(stem.id);
        if (audioBuf.duration > maxDuration) {
          maxDuration = audioBuf.duration;
        }
      }

      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const masterGain = offlineCtx.createGain();
      
      const convolver = offlineCtx.createConvolver();
      convolver.buffer = createReverb(offlineCtx, 2.5, 2.0);
      
      const wetGain = offlineCtx.createGain();
      const dryGain = offlineCtx.createGain();
      wetGain.gain.value = reverbMix / 100;
      dryGain.gain.value = 1 - (reverbMix / 100);

      const preset = VOCAL_CHAINS.find(c => c.id === activeChain) || VOCAL_CHAINS[0];

      const offlineComp = offlineCtx.createDynamicsCompressor();
      offlineComp.ratio.value = preset.comp.ratio;
      offlineComp.attack.value = preset.comp.attack;
      offlineComp.release.value = preset.comp.release;
      offlineComp.knee.value = preset.comp.knee;
      offlineComp.threshold.value = preset.comp.threshold;

      const offlineSaturation = offlineCtx.createWaveShaper();
      offlineSaturation.curve = makeDistortionCurve(presenceIntensity / 2);

      masterGain.connect(dryGain);
      
      let prevOfflineNode: AudioNode = dryGain;
      FREQUENCIES.forEach((freq, i) => {
        const band = offlineCtx.createBiquadFilter();
        band.type = i === 0 ? "lowshelf" : i === FREQUENCIES.length - 1 ? "highshelf" : "peaking";
        band.frequency.value = freq;
        band.gain.value = preset.eq[i];
        prevOfflineNode.connect(band);
        prevOfflineNode = band;
      });

      prevOfflineNode.connect(offlineComp);
      offlineComp.connect(offlineSaturation);
      offlineSaturation.connect(offlineCtx.destination);

      masterGain.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(offlineCtx.destination);

      decodedBuffers.forEach(buf => {
        const source = offlineCtx.createBufferSource();
        source.buffer = buf;
        source.connect(masterGain);
        source.start(0);
      });

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const wavUrl = URL.createObjectURL(wavBlob);

      activeStemIds.forEach(id => removeVocalStem(id));
      
      // FIXED BUILD ERROR: Added offsetBars: 0
      addVocalStem({ id: `MIXED_STEM_${Date.now()}`, type: "Lead", url: wavUrl, blob: wavBlob, volume: 0, offsetBars: 0 });

      if(addToast) addToast("Proprietary DSP applied successfully.", "success");
      setStatus("success");

    } catch (err: any) {
      setStatus("idle");
      if(addToast) addToast(err.message, "error");
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222]">
      {vocalStems.map(s => (
        <audio key={s.id} id={`audio-stem-${s.id}`} src={s.url} crossOrigin="anonymous" className="hidden" />
      ))}
      
      <div className="w-full md:w-1/3 border-r border-[#222] flex flex-col bg-black">
        <div className="p-6 border-b border-[#222] bg-[#050505]">
          <h2 className="font-oswald text-2xl uppercase font-bold text-white flex items-center gap-3">
            <Settings2 size={24} className="text-[#E60000]" /> Engineering
          </h2>
          <p className="font-mono text-[9px] text-[#555] uppercase mt-2 tracking-[0.2em]">Select Neural Chain</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {VOCAL_CHAINS.map(c => (
            <button 
              key={c.id} 
              onClick={() => { setActiveChain(c.id); setPresenceIntensity(c.presence); setReverbMix(c.reverb); }} 
              className={`w-full text-left p-4 border transition-all relative overflow-hidden group ${activeChain === c.id ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a] hover:border-[#555]'}`}
            >
              {activeChain === c.id && <div className="absolute top-0 left-0 w-1 h-full bg-[#E60000]" />}
              <span className={`font-oswald text-lg uppercase font-bold block ${activeChain === c.id ? 'text-white' : 'text-gray-400'}`}>{c.name}</span>
              <span className="font-mono text-[9px] text-[#888] uppercase block mt-1 leading-relaxed">{c.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-12 relative overflow-hidden bg-black">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Waves size={400} />
        </div>

        <div className="relative z-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
          
          <div className="bg-black/40 backdrop-blur-sm border border-[#222] p-8 mb-8">
            <h3 className="font-oswald text-lg uppercase text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2">
              <Sliders size={16} /> Macro Adjustments
            </h3>

            <div className="space-y-10">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Presence // Harmonic Saturation</label>
                  <span className="text-xs font-mono text-white bg-[#111] px-2 py-1 border border-[#222]">{presenceIntensity}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={presenceIntensity} onChange={(e) => setPresenceIntensity(Number(e.target.value))} 
                  className="w-full h-1.5 bg-[#111] appearance-none cursor-pointer rounded-full accent-[#E60000] border border-[#222]" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Vocal Space // Reverb Mix</label>
                  <span className="text-xs font-mono text-white bg-[#111] px-2 py-1 border border-[#222]">{reverbMix}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))} 
                  className="w-full h-1.5 bg-[#111] appearance-none cursor-pointer rounded-full accent-[#E60000] border border-[#222]" 
                />
              </div>
            </div>
          </div>

          <div className="mt-auto">
            {status === "idle" && (
              <button 
                onClick={handleApplyEngineering} 
                disabled={vocalStems.length === 0}
                className="w-full bg-[#E60000] disabled:opacity-20 text-white py-6 font-oswald text-xl font-bold uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-[0_0_30px_rgba(230,0,0,0.2)] flex justify-center items-center gap-3"
              >
                Bake Audio & Apply Chain <PlayCircle size={20} />
              </button>
            )}

            {status === "processing" && (
              <div className="bg-[#110000] border border-[#E60000] p-6 flex flex-col items-center text-center animate-pulse">
                <Loader2 size={32} className="text-[#E60000] animate-spin mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white">Baking OfflineAudioContext...</p>
                <p className="text-[10px] font-mono text-[#E60000] mt-2 tracking-widest">Applying Proprietary DSP Arrays</p>
              </div>
            )}

            {status === "success" && (
              <div className="bg-green-500/10 border border-green-500/30 p-6 flex flex-col items-center text-center animate-in zoom-in">
                <CheckCircle2 size={32} className="text-green-500 mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6">Vocals Encoded</p>
                <button 
                  onClick={() => setActiveRoom("06")} 
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