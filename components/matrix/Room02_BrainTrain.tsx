"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic2, Activity, CheckCircle2, BrainCircuit, ArrowRight, Info, AudioWaveform, Plus, Minus, RefreshCw, Play, Pause, Lock, Zap, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { BlueprintSection } from "../../lib/types";
import { supabase } from "../../lib/supabase";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function Room02_BrainTrain() {
  const { 
    flowDNA, setFlowDNA, setActiveRoom, audioData, 
    setGwStyle, blueprint, setBlueprint, userSession, addToast 
  } = useMatrixStore();

  const [status, setStatus] = useState<"idle" | "analyzing" | "success">(flowDNA ? "success" : "idle");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "analyzing_cadence" | "recorded">("idle");
  const [textInput, setTextInput] = useState("");
  const [detectedStyle, setDetectedStyle] = useState<{ id: string; name: string } | null>(null);
  
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [countdown, setCountdown] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- MONETIZATION: CREDIT CHECK ---
  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;
  const isCreator = userSession?.id && userSession.id === CREATOR_ID;
  const hasCredits = isCreator || (userSession?.creditsRemaining && (userSession.creditsRemaining === "UNLIMITED" || userSession.creditsRemaining > 0));

  const STYLES = {
    getnice_hybrid: "GetNice Hybrid Triplet",
    drill: "NY Drill",
    boom_bap: "Boom Bap",
    melodic_trap: "Melodic Trap",
    chopper: "Chopper (Fast)",
  };

  const isMounted = useRef(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
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
      const mediaRecorder = new MediaRecorder(stream);
      
      const audioPromise = new Promise<Blob>((resolve) => {
        const audioChunks: BlobPart[] = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => resolve(new Blob(audioChunks, { type: 'audio/webm' }));
      });

      mediaRecorder.start();
      setMicStatus("listening");
      setCountdown(10);

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

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => prev <= 1 ? 0 : prev - 1);
      }, 1000);

      await delay(10000); 
      if (!isMounted.current) return;
      mediaRecorder.stop();
      
      const audioBlob = await audioPromise;
      setRecordedAudioUrl(URL.createObjectURL(audioBlob));

      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setMicStatus("analyzing_cadence");

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'cadence.webm');
        formData.append('bpm', audioData?.bpm?.toString() || '120');

        const { data: { session } } = await supabase.auth.getSession();

	const res = await fetch('/api/dsp/cadence', {
        method: 'POST',
  	headers: {
  	  'Authorization': `Bearer ${session?.access_token}`
	},
  	body: formData // Note: Do NOT add 'Content-Type': 'multipart/form-data', the browser handles the boundary automatically for FormData
      });

        const analysisData = await res.json();
        
        if (!res.ok) throw new Error(analysisData.error || "Neural Extraction Failed");

        setDetectedStyle({ id: analysisData.styleId, name: analysisData.styleName });
        setGwStyle(analysisData.styleId);
        
        if (analysisData.transcription) {
           setTextInput((prev) => prev ? prev + "\n" + analysisData.transcription : analysisData.transcription);
           if(addToast) addToast(`Analyzed ${analysisData.totalWords} words. Cadence locked.`, "success");
        }

      } catch (aiErr: any) {
        console.error("AI Cadence Error:", aiErr);
        if(addToast) addToast(aiErr.message, "error");
        setDetectedStyle({ id: "getnice_hybrid", name: STYLES["getnice_hybrid" as keyof typeof STYLES] });
        setGwStyle("getnice_hybrid");
      }

      setMicStatus("recorded");
    } catch (err) {
      if(addToast) addToast("Mic access required for cadence analysis.", "error");
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
    if (!hasCredits) {
      if(addToast) addToast("Insufficient Credits.", "error");
      return;
    }

    if (!audioData?.url) {
      if(addToast) addToast("Missing audio track. Return to Room 01.", "error");
      return;
    }

    setIsProcessing(true);
    setStatus("analyzing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          task_type: "analyze",
          file_url: audioData.url
        })
      });

      const initData = await res.json();
      if (!res.ok) throw new Error(initData.error || "Synthesis Failed");

      const jobId = initData.jobId;
      
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/dsp?jobId=${jobId}&t=${Date.now()}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval);
            
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

            setFlowDNA({
              tag: `GetNice Hybrid [${finalStyleName}]`,
              referenceText: textInput.trim() || "Focus on survival and rhythm.",
              syllableDensity: finalStyleId === "chopper" ? 5.5 : finalStyleId === "drill" ? 4.0 : 3.5,
            });

            if (audioData?.totalBars) {
              let remaining = audioData.totalBars;
              const calc: any[] = [];
              
              // --- INCENTIVE UPGRADE LOGIC ---
              // The Mogul & The Artist get full song structure mappings. 
              // Free Loaders only get 2 blocks.
              if (userSession?.tier === "The Mogul" || userSession?.tier === "The Artist") {
                if (remaining >= 4) { calc.push({ id: "intro", type: "INTRO", bars: 4 }); remaining -= 4; }
                let idCounter = 1;
                while (remaining >= 24) {
                  calc.push({ id: `hook_${idCounter}`, type: "HOOK", bars: 8 }); remaining -= 8;
                  calc.push({ id: `verse_${idCounter}`, type: "VERSE", bars: 16 }); remaining -= 16;
                  idCounter++;
                }
                if (remaining >= 8) { calc.push({ id: `hook_${idCounter}`, type: "HOOK", bars: 8 }); remaining -= 8; }
                calc.push({ id: "outro", type: "OUTRO", bars: remaining });
              } else {
                // Tier Limiting: Free Loader strictly limited
                calc.push({ id: "hook_1", type: "HOOK", bars: 8 });
                calc.push({ id: "verse_1", type: "VERSE", bars: 16 });
              }
              
              setBlueprint(calc);
            }

            setStatus("success");
            setIsProcessing(false);
          } else if (statusData.status === 'FAILED') {
            clearInterval(pollInterval);
            if(addToast) addToast("RunPod Execution Failed.", "error");
            setStatus("idle");
            setIsProcessing(false);
          }
        } catch (pollErr) {
          console.error("Polling error", pollErr);
        }
      }, 3000);

    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
      setStatus("idle");
      setIsProcessing(false);
    }
  };

  const updateBlueprintBar = (index: number, delta: number) => {
    const newBp = [...blueprint];
    // STRICT CAP FIX: Limit ALL users to a maximum of 16 bars per block.
    // Standard hip-hop structure prevents massive payloads while securing the credit economy.
    const maxBars = 16;
    newBp[index].bars = Math.min(maxBars, Math.max(1, newBp[index].bars + delta));
    setBlueprint(newBp);
  };

  const updateBlueprintType = (index: number, newType: any) => {
    const newBp = [...blueprint];
    newBp[index].type = newType;
    setBlueprint(newBp);
  };

  const handleResetFlow = () => {
    setStatus("idle"); setMicStatus("idle"); setRecordedAudioUrl(null); setIsPlayingPreview(false);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in py-10 overflow-y-auto custom-scrollbar">
      <audio ref={previewAudioRef} src={recordedAudioUrl || ""} onEnded={() => setIsPlayingPreview(false)} className="hidden" />

      {status === "idle" && (
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-4 text-white">
              <BrainCircuit className="text-[#E60000]" size={40} /> Brain Train Matrix
            </h2>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap size={14} className={hasCredits ? "text-yellow-500" : "text-[#555]"} />
              <span className={`text-[10px] font-mono uppercase font-bold tracking-widest ${hasCredits ? 'text-white' : 'text-[#E60000]'}`}>
                {hasCredits ? "Synthesis Engine Ready" : "Credits Depleted - Lock Active"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-8">
            <div className={`bg-[#050505] border p-8 flex flex-col items-center text-center rounded-lg relative overflow-hidden transition-all duration-300 ${micStatus === 'listening' ? 'border-[#E60000]' : 'border-[#222]'}`}>
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-8 font-bold text-white">1. Audio Cadence</h3>
              <div className="relative mb-8 flex flex-col items-center justify-center w-full min-h-[96px]">
                {micStatus === "listening" ? (
                  <div className="flex flex-col items-center justify-center w-full">
                     <span className="text-3xl font-oswald font-bold text-[#E60000] mb-2">{countdown}s</span>
                     <canvas ref={canvasRef} width={200} height={60} className="w-full max-w-[200px]" />
                  </div>
                ) : (
                  <button onClick={micStatus === "recorded" ? togglePreviewPlayback : handleRecordCadence} className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all ${micStatus === 'recorded' ? 'border-green-500 text-green-500' : 'border-[#222] text-[#444] hover:text-white hover:border-white'}`}>
                    {micStatus === "recorded" ? (isPlayingPreview ? <Pause size={40} /> : <Play size={40} className="ml-2" />) : <Mic2 size={40} />}
                  </button>
                )}
              </div>
              <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">{micStatus === "recorded" ? "Cadence Captured" : "Record 10s of Mumble Flow"}</span>
            </div>

            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg hover:border-[#E60000]/50 transition-all">
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-white">2. Lyrical DNA</h3>
              <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Enter vibe or lyrical reference..." className="flex-1 bg-black border border-[#111] p-4 text-white font-mono text-xs outline-none h-40 resize-none" />
            </div>
          </div>

          <div className="relative group">
            {!hasCredits && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center border border-[#E60000]/20 rounded">
                <Lock size={24} className="text-[#E60000] mb-2" />
                <p className="text-[10px] uppercase font-bold text-white tracking-widest">Insufficient Credits</p>
              </div>
            )}
            <button
              disabled={!hasCredits || isProcessing || ((micStatus === "idle" || micStatus === "listening") && textInput.trim() === "")}
              onClick={handleSynthesize}
              className="w-full bg-[#E60000] text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] hover:bg-red-700 transition-all flex items-center justify-center gap-3"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : "Synthesize Hybrid Flow"}
              <Zap size={18} />
            </button>
          </div>
        </div>
      )}

      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Synthesizing DNA</h2>
          <p className="font-mono text-[10px] text-[#E60000] uppercase animate-pulse">Running DSP Extraction on RunPod GPU...</p>
        </div>
      )}

      {status === "success" && (
        <div className="w-full animate-in zoom-in max-w-2xl mx-auto">
          <div className="text-center mb-8 border-b border-[#222] pb-8">
            <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
            <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white">Architecture Locked</h2>
            <p className="font-mono text-[10px] text-green-500 uppercase border border-green-500/20 bg-green-500/5 py-2 inline-block px-4 mt-4 tracking-widest">
              Matrix: {flowDNA?.tag}
            </p>
          </div>

          <div className="bg-black border border-[#222] p-8 mb-8">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl text-[#E60000] font-oswald uppercase tracking-widest font-bold">DSP Structural Blueprint</h3>
               {userSession?.tier !== "The Mogul" && (
                 <span className="text-[10px] font-mono text-yellow-500 uppercase border border-yellow-500/20 px-2 py-1 tracking-widest bg-yellow-500/10">
                   Ghostwriter Est: {Math.max(1, Math.ceil(blueprint.length / 2))} CRD
                 </span>
               )}
             </div>
             
             {/* --- INCENTIVE UI TIERS --- */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className={`p-4 border text-[9px] font-mono uppercase tracking-widest ${userSession?.tier === 'Free Loader' ? 'bg-[#E60000]/10 border-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.2)]' : 'bg-black border-[#222] text-[#555]'}`}>
                  <strong className="block text-white mb-2 text-xs">Free Loader</strong>
                  Max 2 Blocks mapped.<br/>Cost: 1 CRD for lyrics.
                </div>
                <div className={`p-4 border text-[9px] font-mono uppercase tracking-widest ${userSession?.tier === 'The Artist' ? 'bg-[#E60000]/10 border-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.2)]' : 'bg-black border-[#222] text-[#555]'}`}>
                  <strong className="block text-white mb-2 text-xs">The Artist</strong>
                  Full song structure.<br/>Cost: 1 CRD per 2 blocks.
                </div>
                <div className={`p-4 border text-[9px] font-mono uppercase tracking-widest ${userSession?.tier === 'The Mogul' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-black border-[#222] text-[#555]'}`}>
                  <strong className="block text-white mb-2 text-xs">The Mogul</strong>
                  Unlimited mapping.<br/>Cost: 0 CRD (Free).
                </div>
             </div>
             
             <div className="space-y-3">
               {blueprint.map((block, index) => (
                 <div key={block.id} className="flex items-center gap-4 bg-[#0a0a0a] border border-[#222] p-3">
                   <select value={block.type} onChange={(e) => updateBlueprintType(index, e.target.value)} className="bg-black text-white font-oswald uppercase p-2 text-sm outline-none">
                     <option value="INTRO">Intro</option><option value="HOOK">Hook</option><option value="VERSE">Verse</option><option value="OUTRO">Outro</option>
                   </select>
                   <div className="ml-auto flex items-center gap-4 font-mono text-sm">
                     <button onClick={() => updateBlueprintBar(index, -1)} className="hover:text-[#E60000]"><Minus size={16} /></button>
                     <span className="w-12 text-center">{block.bars} BARS</span>
                     <button 
                       onClick={() => updateBlueprintBar(index, 1)} 
                       disabled={block.bars >= 16}
                       className="hover:text-green-500 disabled:opacity-20 disabled:hover:text-inherit disabled:cursor-not-allowed"
                     >
                       <Plus size={16} />
                     </button>
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
              <RefreshCw size={14} /> Re-Calculate DNA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}