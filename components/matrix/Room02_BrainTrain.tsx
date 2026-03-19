"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic2, Activity, CheckCircle2, BrainCircuit, ArrowRight, Info, AudioWaveform, Plus, Minus, RefreshCw, Play, Pause } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { BlueprintSection } from "../../lib/types";
import PremiumButton from "./PremiumButton";

// Utility for cleaner timing logic
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function Room02_BrainTrain() {
  const { flowDNA, setFlowDNA, setActiveRoom, audioData, setGwStyle, blueprint, setBlueprint, spendCredit, addToast } = useMatrixStore();

  const [status, setStatus] = useState<"idle" | "analyzing" | "success">(flowDNA ? "success" : "idle");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "analyzing_cadence" | "recorded">("idle");
  const [textInput, setTextInput] = useState("");
  const [detectedStyle, setDetectedStyle] = useState<{ id: string; name: string } | null>(null);

  
  // Audio Preview States
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  // UI States
  const [countdown, setCountdown] = useState(10);

  // Constants
  const STYLES = {
    getnice_hybrid: "GetNice Hybrid Triplet",
    drill: "NY Drill",
    boom_bap: "Boom Bap",
    melodic_trap: "Melodic Trap",
    chopper: "Chopper (Fast)",
  };

  const isMounted = useRef(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        mediaStreamRef.current = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(e => console.error("AudioContext close error:", e));
      }

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const handleRecordCadence = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!isMounted.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      mediaStreamRef.current = stream; 
      
      // --- SETUP MEDIA RECORDER FOR PLAYBACK ---
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
      };
      mediaRecorder.start();
      // -----------------------------------------

      setMicStatus("listening");
      setCountdown(10);

      // --- SETUP WAVEFORM VISUALIZER ---
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      
      analyser.fftSize = 2048;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawWaveform = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext("2d");
        if (!canvasCtx) return;

        animationRef.current = requestAnimationFrame(drawWaveform);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "#E60000"; 
        canvasCtx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * (canvas.height / 2);
          if (i === 0) canvasCtx.moveTo(x, y);
          else canvasCtx.lineTo(x, y);
          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      };

      drawWaveform();
      // ---------------------------------

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      await delay(10000); 
      
      if (!isMounted.current) return;
      
      mediaRecorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(e => console.error("AudioContext close error:", e));
      }
      
      setMicStatus("analyzing_cadence");

      await delay(2000);
      if (!isMounted.current) return;

      let predictedId = "getnice_hybrid";
      if (audioData?.bpm) {
        if (audioData.bpm >= 138) predictedId = "drill";
        else if (audioData.bpm >= 115 && audioData.bpm < 138) predictedId = "melodic_trap";
        else if (audioData.bpm < 100) predictedId = "boom_bap";
      }

      setDetectedStyle({ id: predictedId, name: STYLES[predictedId as keyof typeof STYLES] });
      setGwStyle(predictedId);
      setMicStatus("recorded");
      
    } catch (err) {
      console.error("Microphone Access Denied:", err);
      alert("Hardware microphone access is required to extract your vocal cadence.");
      setMicStatus("idle");
    }
  };

  const togglePreviewPlayback = () => {
    if (!previewAudioRef.current || !recordedAudioUrl) return;
    
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const handleSynthesize = async () => {
    // 🛡️ The Real Guardrail
    const hasCredits = await spendCredit(1); 
    if (!hasCredits) {
      // The store handles the toast, we just need to stop execution
      return; 
    }

    setStatus("analyzing");

    let finalStyleId = detectedStyle?.id || "getnice_hybrid";
    let finalStyleName = detectedStyle?.name || STYLES.getnice_hybrid;

    if (micStatus !== "recorded" && textInput.trim()) {
      const lines = textInput.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const avgWords = lines.reduce((acc, l) => acc + l.trim().split(/\s+/).length, 0) / lines.length;

        if (avgWords >= 12) finalStyleId = "chopper";
        else if (avgWords <= 6) finalStyleId = "melodic_trap";
        else if (audioData?.bpm && audioData.bpm >= 138) finalStyleId = "drill";
        else finalStyleId = "boom_bap";

        finalStyleName = STYLES[finalStyleId as keyof typeof STYLES];
        
        setGwStyle(finalStyleId);
        setDetectedStyle({ id: finalStyleId, name: finalStyleName });
      }
    }

    await delay(2500); 
    if (!isMounted.current) return;

    setFlowDNA({
      tag: `GetNice Hybrid [${finalStyleName}]`,
      referenceText: textInput.trim() || "Focus on the struggle, the hustle, and survival.",
      syllableDensity: finalStyleId === "chopper" ? 5.5 : finalStyleId === "drill" ? 4.0 : 3.5,
    });

    if (audioData?.totalBars) {
      let remaining = audioData.totalBars;
      const calc: any[] = [];
      
      if (remaining >= 4) { calc.push({ id: "intro", type: "INTRO", bars: 4 }); remaining -= 4; }
      if (remaining >= 4) { remaining -= 4; }

      let idCounter = 1;
      while (remaining >= 24) {
        calc.push({ id: `hook_${idCounter}`, type: "HOOK", bars: 8 }); remaining -= 8;
        calc.push({ id: `verse_${idCounter}`, type: "VERSE", bars: 16 }); remaining -= 16;
        idCounter++;
      }
      
      if (remaining >= 8) { calc.push({ id: `hook_${idCounter}`, type: "HOOK", bars: 8 }); remaining -= 8; }
      calc.push({ id: "outro", type: "OUTRO", bars: remaining + 4 });

      setBlueprint(calc);
    }

    setStatus("success");
  };

  const updateBlueprintBar = (index: number, delta: number) => {
    const newBp = [...blueprint];
    newBp[index].bars = Math.max(1, newBp[index].bars + delta);
    setBlueprint(newBp);
  };

  const updateBlueprintType = (index: number, newType: any) => {
    const newBp = [...blueprint];
    newBp[index].type = newType;
    setBlueprint(newBp);
  };

  const handleResetFlow = () => {
    setStatus("idle");
    setMicStatus("idle");
    setRecordedAudioUrl(null);
    setIsPlayingPreview(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = "";
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in duration-500 py-10 overflow-y-auto custom-scrollbar">
      
      {/* Hidden Audio Player for Cadence Preview */}
      <audio 
        ref={previewAudioRef} 
        src={recordedAudioUrl || ""} 
        onEnded={() => setIsPlayingPreview(false)} 
        className="hidden" 
      />

      {status === "idle" && (
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-4 text-white">
              <BrainCircuit className="text-[#E60000]" size={40} /> Brain Train Matrix
            </h2>
            <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">
              Inject vocal cadence or lyrical text to prime the GetNice Engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-8">
            
            {/* Column 1: Audio Cadence Capture */}
            <div
              className={`bg-[#050505] border p-8 flex flex-col items-center text-center rounded-lg group transition-all duration-300 relative overflow-hidden
              ${micStatus === "listening" ? "border-[#E60000] shadow-[0_0_20px_rgba(230,0,0,0.1)]" : micStatus === "analyzing_cadence" ? "border-yellow-500/50" : micStatus === "recorded" ? "border-green-500/30" : "border-[#222] hover:border-[#E60000]/50"}`}
            >
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-8 font-bold text-white relative z-10">1. Audio Cadence</h3>

              {micStatus === "analyzing_cadence" ? (
                <div className="flex flex-col items-center justify-center h-24 mb-8 relative z-10">
                  <AudioWaveform size={40} className="text-yellow-500 animate-bounce mb-2" />
                  <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest animate-pulse">Running Vocal DSP...</span>
                </div>
              ) : (
                <div className="relative mb-8 z-10 flex flex-col items-center justify-center w-full min-h-[96px]">
                  {micStatus === "listening" ? (
                    <div className="flex flex-col items-center justify-center w-full">
                       <span className="text-3xl font-oswald font-bold text-[#E60000] mb-2">{countdown}s</span>
                       <canvas 
                         ref={canvasRef} 
                         width={200} 
                         height={60} 
                         className="w-full max-w-[200px] h-[60px]"
                       />
                    </div>
                  ) : (
                    <button
  onClick={micStatus === "recorded" ? togglePreviewPlayback : handleRecordCadence}
  className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-300
  ${micStatus === "recorded" 
    ? (isPlayingPreview ? "bg-[#E60000] border-[#E60000] text-white animate-pulse" : "bg-green-500/10 border-green-500 text-green-500 hover:bg-green-500 hover:text-black") 
    : "bg-black border-[#222] text-[#444] group-hover:text-white group-hover:border-white"}`}
>
                      {micStatus === "recorded" 
                        ? (isPlayingPreview ? <Pause size={40} /> : <Play size={40} className="ml-2" />) 
                        : <Mic2 size={40} />}
                    </button>
                  )}
                </div>
              )}

              <div className="h-10 flex items-center justify-center w-full relative z-10">
                {micStatus === "recorded" && detectedStyle ? (
                  <div className="flex flex-col items-center animate-in zoom-in">
                    <span className="text-[8px] font-mono text-green-500 uppercase tracking-widest font-bold mb-1 border border-green-500/30 px-2 py-0.5 bg-green-500/10">Match: {detectedStyle.name}</span>
                    <span className="text-[9px] font-mono text-[#888] uppercase tracking-widest mt-2 flex items-center gap-1">Click to Audition Cadence</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">
                    {micStatus === "listening" ? "DON'T STOP: Keep Rapping..." : "Record 10s of Mumble Flow"}
                  </span>
                )}
              </div>
            </div>

            {/* Column 2: Lyrical DNA Input */}
            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg group hover:border-[#E60000]/50 transition-all duration-300">
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-white">2. Lyrical DNA</h3>
              <p className="text-[9px] font-mono text-[#555] uppercase mb-4 tracking-widest">Paste previous bars for algorithmic flow extraction</p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="I see the vision, I'm making a killing..."
                className="flex-1 bg-black border border-[#111] p-4 text-white font-mono text-xs outline-none focus:border-[#E60000] h-40 custom-scrollbar resize-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#110000] border border-[#E60000]/30 mb-8 max-w-2xl mx-auto">
            <Info className="text-[#E60000] shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-oswald text-sm text-[#E60000] uppercase tracking-widest font-bold mb-1">The GetNice Hybrid Flow</p>
              <p className="font-mono text-[10px] text-[#888] uppercase leading-relaxed">
                By synthesizing your input, the engine creates a lyrical blend of your unique cadence intertwined with the proprietary GetNice architecture.
              </p>
            </div>
          </div>

          <PremiumButton 
  cost={1} 
  onConfirm={handleSynthesize} 
  className="w-full bg-[#E60000] text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] hover:bg-red-700 shadow-[0_0_20px_rgba(230,0,0,0.2)]"
>
  Synthesize Hybrid Flow (1 CRD)
</PremiumButton>
        </div>
      )}

      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Extracting DNA</h2>
          <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest animate-pulse">Blending with GetNice Architecture...</p>
        </div>
      )}

      {status === "success" && (
        <div className="w-full animate-in zoom-in duration-500 max-w-2xl mx-auto">
          <div className="text-center mb-8 border-b border-[#222] pb-8">
            <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
            <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">DNA & Blueprint Locked</h2>
            
            {flowDNA?.tag && (
              <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest mb-4 border border-green-500/20 bg-green-500/5 py-2 inline-block px-4 mt-4">
                Architecture Matrix: {flowDNA.tag}
              </p>
            )}
          </div>

          <div className="bg-black border border-[#222] p-8 max-w-3xl mx-auto mb-8 shadow-lg">
             <div className="flex justify-between items-center mb-6 border-b border-[#111] pb-4">
               <h3 className="text-xl text-[#E60000] font-oswald uppercase tracking-widest font-bold">DSP Structural Blueprint</h3>
               <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest flex gap-6">
                 <span>Detected Key: <span className="text-white">{audioData?.key || "Unknown"}</span></span>
                 <span>Total DSP Bars: <span className="text-white">{audioData?.totalBars || 0}</span></span>
               </div>
             </div>

             <div className="space-y-3">
               {blueprint.map((block, index) => (
                 <div key={block.id} className="flex items-center gap-4 bg-[#0a0a0a] border border-[#222] p-3">
                   <span className="font-oswald text-[#555] w-6">{(index + 1).toString().padStart(2, '0')}</span>
                   
                   <select 
                     value={block.type} onChange={(e) => updateBlueprintType(index, e.target.value)}
                     className="bg-black border border-[#333] text-white font-oswald uppercase tracking-widest p-2 text-sm outline-none focus:border-[#E60000]"
                   >
                     <option value="INTRO">Intro</option><option value="HOOK">Hook</option><option value="VERSE">Verse</option><option value="BRIDGE">Bridge</option><option value="OUTRO">Outro</option>
                   </select>

                   <div className="ml-auto flex items-center gap-4">
                     <button onClick={() => updateBlueprintBar(index, -1)} className="text-[#888] hover:text-[#E60000]"><Minus size={16} /></button>
                     <span className="font-mono text-sm w-12 text-center text-white">{block.bars} <span className="text-[9px] text-[#555]">BARS</span></span>
                     <button onClick={() => updateBlueprintBar(index, 1)} className="text-[#888] hover:text-green-500"><Plus size={16} /></button>
                   </div>
                 </div>
               ))}
             </div>
             <div className="mt-4 flex justify-between font-mono text-[10px] uppercase text-[#555]">
                <span>Allocated Bars: {blueprint.reduce((a, b) => a + b.bars, 0)}</span>
                <span className={blueprint.reduce((a, b) => a + b.bars, 0) !== audioData?.totalBars ? "text-yellow-500" : "text-green-500"}>
                  {blueprint.reduce((a, b) => a + b.bars, 0) === audioData?.totalBars ? "Perfect Math Alignment" : "Math Mismatch (Will still generate)"}
                </span>
             </div>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => setActiveRoom("03")}
              className="flex items-center justify-center gap-3 w-full bg-white text-black py-5 font-oswald font-bold text-lg uppercase tracking-[0.2em] hover:bg-[#E60000] hover:text-white transition-colors"
            >
              Enter Ghostwriter Suite <ArrowRight size={20} />
            </button>
            
            <button 
              onClick={handleResetFlow}
              className="w-full border border-[#333] text-[#888] py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#111] hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} /> Re-Configure Flow DNA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}