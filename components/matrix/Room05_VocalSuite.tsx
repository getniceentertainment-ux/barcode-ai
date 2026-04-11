"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, PlayCircle, Loader2, CheckCircle2, Waves, Settings2, ArrowRight, Volume2, ListMusic, Play, Pause, Lock, DollarSign, Trash2, VolumeX, Scissors } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

type TrackType = "Lead" | "Adlib" | "Double" | "Guide";

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
  const left = impulse.getChannelData(0); const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) { const n = 1 - i / length; left[i] = (Math.random() * 2 - 1) * Math.pow(n, decay); right[i] = (Math.random() * 2 - 1) * Math.pow(n, decay); }
  return impulse;
}

function makeDistortionCurve(amount: number) {
  const k = amount, n_samples = 44100, curve = new Float32Array(n_samples), deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) { const x = (i * 2) / n_samples - 1; curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x)); }
  return curve;
}

function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44, bufferArray = new ArrayBuffer(length), view = new DataView(bufferArray), pos = 0;
  const setUint16 = (d: number) => { view.setUint16(pos, d, true); pos += 2; };
  const setUint32 = (d: number) => { view.setUint32(pos, d, true); pos += 4; };
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
  const channels = []; for(let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  for(let offset = 0; offset < buffer.length; offset++) { for(let i = 0; i < numOfChan; i++) { let s = Math.max(-1, Math.min(1, channels[i][offset])); s = (0.5 + s < 0 ? s * 32768 : s * 32767) | 0; view.setInt16(pos, s, true); pos += 2; }}
  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room05_VocalSuite() {
  const { audioData, vocalStems, engineeredVocal, setEngineeredVocal, setActiveRoom, addToast, userSession, mixParams, updateMixParams, toggleStemMute, updateStemVolume, removeVocalStem } = useMatrixStore();
  
  const [activeChain, setActiveChain] = useState(mixParams?.activeChain || VOCAL_CHAINS[0].id);
  const [presenceIntensity, setPresenceIntensity] = useState(mixParams?.presenceIntensity ?? VOCAL_CHAINS[0].presence);
  const [reverbMix, setReverbMix] = useState(mixParams?.reverbMix ?? VOCAL_CHAINS[0].reverb);
  const [eqGains, setEqGains] = useState<number[]>(mixParams?.eqGains?.length ? [...mixParams.eqGains] : [...VOCAL_CHAINS[0].eq]);
  
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasToken, setHasToken] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const wetGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const eqBandsRef = useRef<BiquadFilterNode[]>([]);
  const compRef = useRef<DynamicsCompressorNode | null>(null);
  const saturationRef = useRef<WaveShaperNode | null>(null);

  // 🚨 NEW REFS: Pure Mathematical AudioBuffer playback engine (NO HTML5 AUDIO LATENCY)
  const beatBufferRef = useRef<AudioBuffer | null>(null);
  const stemBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const stemGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  
  const playbackStartCtxTimeRef = useRef<number>(0);
  const playbackStartOffsetRef = useRef<number>(0);
  const animationRef = useRef<number>();

  const isNonMogul = userSession?.tier !== "The Mogul";

  useEffect(() => {
    if (engineeredVocal) {
      setStatus("success");
      setHasToken(true); 
    }
  }, [engineeredVocal]);

  useEffect(() => {
    const checkTokenStatus = async () => {
      if (engineeredVocal) {
        setHasToken(true);
        return;
      }
      if (userSession?.tier === "The Mogul") {
        setHasToken(true);
        return;
      }
      if (userSession?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('has_engineering_token')
          .eq('id', userSession.id)
          .single();
        
        if (data?.has_engineering_token) setHasToken(true);
      }
    };
    checkTokenStatus();
  }, [userSession, engineeredVocal]);

  useEffect(() => {
    updateMixParams({ activeChain, presenceIntensity, reverbMix, eqGains });
  }, [activeChain, presenceIntensity, reverbMix, eqGains, updateMixParams]);

  const handlePurchaseToken = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Routing to Secure Checkout...", "info");
    try {
      const res = await fetch('/api/stripe/engineering-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      if(addToast) addToast("Checkout failed.", "error");
    }
  };

  const handleChainSelect = (chainId: string) => {
    setActiveChain(chainId);
    const preset = VOCAL_CHAINS.find(c => c.id === chainId) || VOCAL_CHAINS[0];
    setEqGains([...preset.eq]);
    setPresenceIntensity(preset.presence);
    setReverbMix(preset.reverb);
  };

  // --- 1. RIGID AUDIO GRAPH INIT ---
  useEffect(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass(); 
      audioCtxRef.current = ctx;
      
      const masterGain = ctx.createGain(); 
      const convolver = ctx.createConvolver(); 
      convolver.buffer = createReverb(ctx, 2.5, 2.0);
      const wetGain = ctx.createGain(); 
      const dryGain = ctx.createGain(); 
      wetGainRef.current = wetGain; dryGainRef.current = dryGain;

      eqBandsRef.current = FREQUENCIES.map((freq, i) => { 
        const band = ctx.createBiquadFilter(); 
        band.type = i === 0 ? "lowshelf" : i === FREQUENCIES.length - 1 ? "highshelf" : "peaking"; 
        band.frequency.value = freq; return band; 
      });
      const compressor = ctx.createDynamicsCompressor(); compRef.current = compressor;
      const saturation = ctx.createWaveShaper(); saturation.curve = makeDistortionCurve(presenceIntensity / 2); saturation.oversample = '4x'; saturationRef.current = saturation;
      
      masterGain.connect(dryGain); 
      let prevNode: AudioNode = dryGain; 
      eqBandsRef.current.forEach(band => { prevNode.connect(band); prevNode = band; }); 
      prevNode.connect(compressor); compressor.connect(saturation); saturation.connect(ctx.destination);
      masterGain.connect(convolver); convolver.connect(wetGain); wetGain.connect(ctx.destination);
      
      (ctx as any)._masterGain = masterGain;
    }
  }, []); 

  // --- 2. MEMORY BUFFER LOADING (Bypasses Blob URL bugs & Latency) ---
  useEffect(() => {
    let isMounted = true;
    
    // Load Beat Buffer
    const loadBeatBuffer = async () => {
      if (!audioCtxRef.current || !audioData) return;
      try {
        let beatBlob = (audioData as any)?.blob;
        if (!beatBlob && audioData.url) {
           const r = await fetch(audioData.url);
           if (r.ok) beatBlob = await r.blob();
        }
        if (!beatBlob) return;
        const arrayBuf = await beatBlob.arrayBuffer();
        const audioBuf = await new Promise<AudioBuffer>((res, rej) => audioCtxRef.current!.decodeAudioData(arrayBuf, res, rej));
        if (isMounted) {
          beatBufferRef.current = audioBuf;
          setDuration(audioBuf.duration);
        }
      } catch(e) { console.warn("Failed loading beat to buffer", e); }
    };
    loadBeatBuffer();

    // Load Vocal Buffers
    const loadVocalBuffers = async () => {
      if (!audioCtxRef.current) return;
      for (const stem of vocalStems) {
        if (!stemBuffersRef.current.has(stem.id)) {
          try {
            let arrayBuf: ArrayBuffer;
            if (stem.blob) { arrayBuf = await stem.blob.arrayBuffer(); } 
            else {
               const controller = new AbortController();
               const timeoutId = setTimeout(() => controller.abort(), 10000); 
               const resp = await fetch(stem.url, { signal: controller.signal });
               clearTimeout(timeoutId);
               if (!resp.ok) continue;
               const contentType = resp.headers.get('content-type') || '';
               if (contentType.includes('text/html') || contentType.includes('application/json')) continue;
               arrayBuf = await resp.arrayBuffer();
            }
            if (!isMounted) return;
            const audioBuf = await new Promise<AudioBuffer>((resolve, reject) => {
               audioCtxRef.current!.decodeAudioData(arrayBuf, resolve, reject);
            });
            if (isMounted) stemBuffersRef.current.set(stem.id, audioBuf);
          } catch (e: any) { 
            if (e.name !== 'AbortError') console.warn(`Soft-fail decoding stem ${stem.id}:`, e); 
          }
        }
      }
    };
    loadVocalBuffers();
    
    return () => { isMounted = false; };
  }, [vocalStems, audioData]);

  // Clean up AudioContext strictly on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
      if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close();
    }
  }, []);

  // --- MIX BUS REAL-TIME UPDATES ---
  useEffect(() => {
    if (wetGainRef.current && dryGainRef.current) { wetGainRef.current.gain.value = reverbMix / 100; dryGainRef.current.gain.value = 1 - (reverbMix / 100); }
    if (eqBandsRef.current.length === 10) eqBandsRef.current.forEach((band, i) => { band.gain.value = eqGains[i]; });
    const preset = VOCAL_CHAINS.find(c => c.id === activeChain) || VOCAL_CHAINS[0];
    if (compRef.current) { compRef.current.ratio.value = preset.comp.ratio; compRef.current.attack.value = preset.comp.attack; compRef.current.release.value = preset.comp.release; compRef.current.knee.value = preset.comp.knee; compRef.current.threshold.value = preset.comp.threshold; }
    if (saturationRef.current) saturationRef.current.curve = makeDistortionCurve(presenceIntensity / 2);
  }, [reverbMix, presenceIntensity, eqGains, activeChain]);

  // 🚨 REAL-TIME MUTE/VOLUME LISTENER
  useEffect(() => {
    vocalStems.forEach(stem => {
       const gainNode = stemGainNodesRef.current.get(stem.id);
       if (gainNode) {
          gainNode.gain.value = stem.isMuted ? 0 : (stem.volume ?? 1);
       }
    });
  }, [vocalStems]);

  // --- 3. HIGH FIDELITY BUFFER SCHEDULER & MATH ALIGNMENT ---
  const tick = () => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - playbackStartCtxTimeRef.current;
      setCurrentTime(playbackStartOffsetRef.current + elapsed);
      animationRef.current = requestAnimationFrame(tick);
  };

  const startAllBuffers = (playheadTime: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx || !(ctx as any)._masterGain) return;
    
    const scheduleTime = ctx.currentTime + 0.05;

    // 🚨 EXACT ROOM 4 MATH RESTORED: Prevents gradual floating-point drift
    const trackDuration = audioData?.duration || duration || 128;
    const actualBeatBars = audioData?.totalBars || Math.round((trackDuration / 60) * (audioData?.bpm || 120) / 4);
    const preciseBpm = trackDuration > 0 ? ((actualBeatBars * 4) / trackDuration) * 60 : (audioData?.bpm || 120);
    const secondsPerBar = trackDuration > 0 ? (trackDuration / actualBeatBars) : (60 / preciseBpm) * 4;

    // Purge old sources
    activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
    activeSourcesRef.current = [];
    stemGainNodesRef.current.clear();

    // Schedule Beat
    if (beatBufferRef.current) {
        const beatSource = ctx.createBufferSource();
        beatSource.buffer = beatBufferRef.current;
        beatSource.connect(ctx.destination); 
        if (playheadTime < beatBufferRef.current.duration) {
            beatSource.start(scheduleTime, playheadTime);
            activeSourcesRef.current.push(beatSource);
        }
        beatSource.onended = () => {
            if (activeSourcesRef.current.includes(beatSource)) {
                setIsPreviewPlaying(false);
                if (animationRef.current) cancelAnimationFrame(animationRef.current);
            }
        };
    }

    // Schedule Vocals
    vocalStems.forEach(stem => {
       if (stem.isMuted) return; 
       
       const buffer = stemBuffersRef.current.get(stem.id);
       if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          
          const gainNode = ctx.createGain();
          gainNode.gain.value = stem.volume ?? 1;
          stemGainNodesRef.current.set(stem.id, gainNode); 

          source.connect(gainNode);
          gainNode.connect((ctx as any)._masterGain); 

          const offsetSecs = (stem.offsetBars || 0) * secondsPerBar;
          if (playheadTime < offsetSecs) {
             source.start(scheduleTime + (offsetSecs - playheadTime));
          } else {
             const bufOffset = playheadTime - offsetSecs;
             if (bufOffset < buffer.duration) {
                source.start(scheduleTime, bufOffset);
             }
          }
          activeSourcesRef.current.push(source);
       }
    });
  };

  const togglePreviewPlayback = async () => {
    if (!audioCtxRef.current) return;
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    
    const willPlay = !isPreviewPlaying; 
    setIsPreviewPlaying(willPlay);
    
    if (willPlay) {
      playbackStartCtxTimeRef.current = audioCtxRef.current.currentTime + 0.05;
      playbackStartOffsetRef.current = currentTime; 
      startAllBuffers(currentTime);
      animationRef.current = requestAnimationFrame(tick);
    } else {
      activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
      activeSourcesRef.current = [];
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  const handleApplyEngineering = async () => {
    if (isNonMogul && !hasToken) {
      if(addToast) addToast("Vocal Suite is Locked. Engineering Token required.", "error");
      return;
    }

    setIsPreviewPlaying(false);
    activeSourcesRef.current.forEach(s => { try { s.stop(); s.disconnect(); } catch(e){} });
    activeSourcesRef.current = [];
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    setStatus("processing");
    try {
      if (isNonMogul && userSession?.id) {
        const { error } = await supabase.from('profiles').update({ has_engineering_token: false }).eq('id', userSession.id);
        if (error) throw error;
        setHasToken(false); 
      }

      const tmpCtx = new window.AudioContext(); const decodedBuffers: AudioBuffer[] = []; let maxDuration = 0;
      for (const stem of vocalStems) { const resp = await fetch(stem.url); const audioBuf = await tmpCtx.decodeAudioData(await resp.arrayBuffer()); decodedBuffers.push(audioBuf); if (audioBuf.duration > maxDuration) maxDuration = audioBuf.duration; }
      
      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const masterGain = offlineCtx.createGain(); const convolver = offlineCtx.createConvolver(); convolver.buffer = createReverb(offlineCtx, 2.5, 2.0);
      const wetGain = offlineCtx.createGain(); const dryGain = offlineCtx.createGain(); 
      wetGain.gain.value = reverbMix / 100; dryGain.gain.value = 1 - (reverbMix / 100);
      
      const preset = VOCAL_CHAINS.find(c => c.id === activeChain) || VOCAL_CHAINS[0];
      const offlineComp = offlineCtx.createDynamicsCompressor(); offlineComp.ratio.value = preset.comp.ratio; offlineComp.attack.value = preset.comp.attack; offlineComp.release.value = preset.comp.release; offlineComp.knee.value = preset.comp.knee; offlineComp.threshold.value = preset.comp.threshold;
      const offlineSaturation = offlineCtx.createWaveShaper(); offlineSaturation.curve = makeDistortionCurve(presenceIntensity / 2);
      
      masterGain.connect(dryGain); let prevOfflineNode: AudioNode = dryGain; 
      FREQUENCIES.forEach((freq, i) => { const band = offlineCtx.createBiquadFilter(); band.type = i === 0 ? "lowshelf" : i === FREQUENCIES.length - 1 ? "highshelf" : "peaking"; band.frequency.value = freq; band.gain.value = eqGains[i]; prevOfflineNode.connect(band); prevOfflineNode = band; });
      prevOfflineNode.connect(offlineComp); offlineComp.connect(offlineSaturation); offlineSaturation.connect(offlineCtx.destination);
      masterGain.connect(convolver); convolver.connect(wetGain); wetGain.connect(offlineCtx.destination);
      
      // 🚨 ALIGN EXACT MATH FOR RENDER
      const trackDuration = audioData?.duration || duration || 128;
      const actualBeatBars = audioData?.totalBars || Math.round((trackDuration / 60) * (audioData?.bpm || 120) / 4);
      const preciseBpm = trackDuration > 0 ? ((actualBeatBars * 4) / trackDuration) * 60 : (audioData?.bpm || 120);
      const secondsPerBar = trackDuration > 0 ? (trackDuration / actualBeatBars) : (60 / preciseBpm) * 4;

      decodedBuffers.forEach((buf, i) => { 
        if (vocalStems[i].isMuted) return;

        const source = offlineCtx.createBufferSource(); 
        source.buffer = buf; 
        
        const stemGain = offlineCtx.createGain();
        stemGain.gain.value = vocalStems[i].volume ?? 1;
        
        source.connect(stemGain);
        stemGain.connect(masterGain); 
        
        const startTime = (vocalStems[i].offsetBars || 0) * secondsPerBar;
        source.start(startTime); 
      });
      
      const renderedBuffer = await offlineCtx.startRendering();
      
      // THE NON-DESTRUCTIVE SAVE
      setEngineeredVocal({ 
        id: `MIXED_STEM_${Date.now()}`, 
        type: "Lead", 
        url: URL.createObjectURL(audioBufferToWav(renderedBuffer)), 
        blob: audioBufferToWav(renderedBuffer), 
        volume: 1, 
        offsetBars: 0 
      });

      setStatus("success");
      if(addToast) addToast("Vocals Engineered & Saved to Memory.", "success");
    } catch (err: any) { 
      setStatus("idle"); 
      if(addToast) addToast(err.message, "error"); 
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222] relative overflow-hidden">
      
      {/* 1. GATED UI OVERLAY */}
      {isNonMogul && !hasToken && status !== "success" && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-[#050505] border border-[#E60000] p-10 text-center rounded-lg shadow-[0_0_50px_rgba(230,0,0,0.3)] animate-in zoom-in duration-300">
            <Lock size={64} className="text-[#E60000] mx-auto mb-6" />
            <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">Suite Gated</h2>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
              The Vocal Suite requires an <strong className="text-white">Engineering Token</strong> for access.
            </p>
            <button 
              onClick={handlePurchaseToken}
              className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3"
            >
              Unlock Suite ($4.99) <DollarSign size={20} />
            </button>
            <button 
              onClick={() => setActiveRoom("04")}
              className="mt-6 text-[10px] text-[#555] uppercase font-mono hover:text-white transition-colors"
            >
              ← Return to Booth
            </button>
          </div>
        </div>
      )}
      
      {/* SIDEBAR PRESETS */}
      <div className="w-full md:w-1/3 border-r border-[#222] flex flex-col bg-black">
        <div className="p-6 border-b border-[#222]">
          <h2 className="font-oswald text-2xl uppercase font-bold text-white flex items-center gap-3">
            <Settings2 size={24} className="text-[#E60000]" /> Engineering
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {VOCAL_CHAINS.map(c => (
            <button key={c.id} onClick={() => handleChainSelect(c.id)} className={`w-full text-left p-4 border transition-all ${activeChain === c.id ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a] hover:border-[#555]'}`}>
              <span className={`font-oswald text-lg uppercase font-bold ${activeChain === c.id ? 'text-white' : 'text-gray-400'}`}>{c.name}</span>
              <span className="font-mono text-[9px] text-[#888] block mt-1">{c.desc}</span>
            </button>
          ))}
        </div>
        
        {/* ROOM 4 TIMELINE SLIDERS ADDED FOR QUICK ACCESS */}
        <div className="border-t border-[#222] bg-[#050505] p-4">
           <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><ListMusic size={14}/> Stem Console</h3>
           <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
             {vocalStems.map(s => (
                <div key={s.id} className="bg-black border border-[#111] p-3 rounded-sm flex items-center justify-between gap-3">
                   <div className="flex flex-col">
                     <span className="font-mono text-[9px] text-white uppercase">{s.type}</span>
                     <span className="font-mono text-[8px] text-[#555]">{s.id.substring(5, 12)}</span>
                   </div>
                   <div className="flex-1 flex items-center gap-2">
                     <input type="range" min="0" max="2" step="0.05" value={s.volume ?? 1} onChange={(e) => updateStemVolume(s.id, parseFloat(e.target.value))} className="w-full accent-[#E60000] h-1 bg-[#222] rounded-full appearance-none cursor-pointer" />
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => toggleStemMute(s.id)} className={`transition-colors ${s.isMuted ? 'text-[#E60000]' : 'text-[#888] hover:text-white'}`}>{s.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}</button>
                     <button onClick={() => removeVocalStem(s.id)} className="text-[#333] hover:text-red-600 transition-colors"><Trash2 size={12}/></button>
                   </div>
                </div>
             ))}
           </div>
        </div>
      </div>

      {/* MAIN RACK */}
      <div className="flex-1 flex flex-col p-6 lg:p-12 relative overflow-y-auto custom-scrollbar bg-black">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none"><Waves size={400} /></div>
        <div className="relative z-10 max-w-2xl mx-auto w-full flex-1 flex flex-col gap-6">
          
          <div className="bg-[#111] border border-[#222] p-6 rounded-sm flex flex-col gap-5 shadow-lg">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={togglePreviewPlayback} disabled={vocalStems.length === 0 || status !== "idle"} className={`w-14 h-14 flex items-center justify-center rounded-full transition-all disabled:opacity-50 ${isPreviewPlaying ? 'bg-[#E60000] text-white animate-pulse shadow-[0_0_20px_rgba(230,0,0,0.4)]' : 'bg-white text-black hover:bg-[#E60000] hover:text-white'}`}>
                    {isPreviewPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                  </button>
                  <div><p className="font-oswald text-lg text-white uppercase tracking-widest font-bold flex items-center gap-2"><ListMusic size={16} className="text-[#E60000]"/> Synced Audition</p><p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-1">Instrumental + Active Vocal Chain</p></div>
                </div>
                <div className="text-right"><span className="font-mono text-sm font-bold text-[#E60000] bg-black px-3 py-1 border border-[#333]">{Math.floor(currentTime/60)}:{Math.floor(currentTime%60).toString().padStart(2,'0')}</span></div>
             </div>
             
             {/* 🚨 SCRUBBER SYNC FIX */}
             <div className="w-full flex items-center gap-3">
               <input 
                 type="range" min="0" max={duration || 100} step="0.1" value={currentTime} 
                 onChange={(e) => { 
                   const nt = parseFloat(e.target.value); 
                   setCurrentTime(nt); 
                   if(isPreviewPlaying) { 
                       playbackStartCtxTimeRef.current = audioCtxRef.current!.currentTime + 0.05;
                       playbackStartOffsetRef.current = nt;
                       startAllBuffers(nt); 
                   }
                 }} 
                 className="flex-1 accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" 
               />
             </div>
          </div>

          <div className="bg-black/80 backdrop-blur-sm border border-[#222] p-6 lg:p-8 rounded-sm">
            <h3 className="font-oswald text-lg uppercase text-white mb-6 border-b border-[#222] pb-3 flex items-center justify-between"><span className="flex items-center gap-2"><Sliders size={16} className="text-[#E60000]" /> Parametric EQ</span><span className="text-[10px] font-mono text-[#E60000] tracking-widest">±12dB</span></h3>
            <div className="flex justify-between items-end h-48 gap-1 sm:gap-2 mb-2">
              {FREQUENCIES.map((freq, i) => (
                <div key={freq} className="flex flex-col items-center flex-1 group">
                  <span className="text-[9px] font-mono text-[#E60000] mb-3 opacity-0 group-hover:opacity-100 transition-opacity">{eqGains[i] > 0 ? '+' : ''}{eqGains[i].toFixed(1)}</span>
                  <input type="range" min="-12" max="12" step="0.5" value={eqGains[i]} onChange={(e) => { const ng = [...eqGains]; ng[i] = parseFloat(e.target.value); setEqGains(ng); }} className="w-2 h-32 appearance-none bg-[#222] outline-none accent-[#E60000] hover:bg-[#333] transition-colors rounded-full cursor-pointer" style={{ WebkitAppearance: 'slider-vertical' }} />
                  <span className="text-[8px] font-mono text-[#888] mt-4 font-bold">{freq >= 1000 ? `${freq/1000}k` : freq}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/80 backdrop-blur-sm border border-[#222] p-6 lg:p-8 rounded-sm mb-8">
            <div className="space-y-8">
              <div><div className="flex justify-between items-center mb-3"><label className="text-[10px] font-mono uppercase text-[#888] font-bold">Presence / Saturation</label><span className="text-xs font-mono text-white">{presenceIntensity}%</span></div><input type="range" min="0" max="100" value={presenceIntensity} onChange={(e) => setPresenceIntensity(Number(e.target.value))} className="w-full accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" /></div>
              <div><div className="flex justify-between items-center mb-3"><label className="text-[10px] font-mono uppercase text-[#888] font-bold">Vocal Space (Reverb Size)</label><span className="text-xs font-mono text-white">{reverbMix}%</span></div><input type="range" min="0" max="100" value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))} className="w-full accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" /></div>
            </div>
          </div>

          <div className="mt-auto shrink-0">
            {status === "idle" && (
              <button onClick={handleApplyEngineering} disabled={vocalStems.length === 0} className="w-full bg-[#E60000] text-white py-6 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(230,0,0,0.2)]">Bake & Apply Chain <PlayCircle size={20} /></button>
            )}
            {status === "processing" && (
              <div className="bg-[#110000] border-2 border-[#E60000] p-10 flex flex-col items-center animate-pulse rounded-sm"><Loader2 size={32} className="text-[#E60000] animate-spin mb-4" /><p className="font-oswald text-xl uppercase font-bold text-white tracking-widest">Rendering Matrix...</p></div>
            )}
            {status === "success" && (
              <div className="bg-green-950/20 border-2 border-green-500/50 p-10 flex flex-col items-center animate-in zoom-in rounded-sm shadow-[0_0_50px_rgba(34,197,94,0.1)]"><CheckCircle2 size={32} className="text-green-500 mb-4" /><p className="font-oswald text-xl uppercase font-bold text-white mb-6 tracking-widest">Vocals Engineered</p><button onClick={() => setActiveRoom("06")} className="w-full bg-white text-black py-4 font-oswald text-md font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex justify-center items-center gap-3">Proceed to Mastering <ArrowRight size={18} /></button></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}