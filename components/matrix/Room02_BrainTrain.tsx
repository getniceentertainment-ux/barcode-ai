"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic2, Activity, CheckCircle2, BrainCircuit, ArrowRight, Info, AudioWaveform } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

// Utility for cleaner timing logic
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function Room02_BrainTrain() {
  const { setFlowDNA, setActiveRoom, audioData, setGwStyle } = useMatrixStore();

  // Primary States
  const [status, setStatus] = useState<"idle" | "analyzing" | "success">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "analyzing_cadence" | "recorded">("idle");
  const [textInput, setTextInput] = useState("");
  const [detectedStyle, setDetectedStyle] = useState<{ id: string; name: string } | null>(null);
  
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

  // Logic Cleansing: Refs for cleanup to prevent memory leaks/ghost state updates
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Web Audio API Refs for Waveform Visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Cleanup function on component unmount
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleRecordCadence = async () => {
    try {
      // 1. Hardware Request
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        // Clear canvas with transparent background
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "#E60000"; // Red to match the theme
        canvasCtx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * (canvas.height / 2);

          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      };

      // Start the visualizer loop
      drawWaveform();
      // ---------------------------------

      // 2. Start Visual Countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 3. Active Listening Phase (10 Seconds)
      await delay(10000); 
      
      // Safety: Stop the microphone hardware and visualizer immediately
      stream.getTracks().forEach((track) => track.stop());
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      
      setMicStatus("analyzing_cadence");

      // 4. DSP Analytics Phase (2 Seconds)
      await delay(2000);

      let predictedId = "getnice_hybrid";
      
      // Heuristic: Check store for BPM data if available
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

  const handleSynthesize = async () => {
    setStatus("analyzing");

    let finalStyleId = detectedStyle?.id || "getnice_hybrid";
    let finalStyleName = detectedStyle?.name || STYLES.getnice_hybrid;

    // TEXT DSP ANALYZER: Refined word-density logic
    if (micStatus !== "recorded" && textInput.trim()) {
      const lines = textInput.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const avgWords = lines.reduce((acc, l) => acc + l.trim().split(/\s+/).length, 0) / lines.length;

        if (avgWords >= 12) finalStyleId = "chopper";
        else if (avgWords <= 6) finalStyleId = "melodic_trap";
        else if (audioData?.bpm && audioData.bpm >= 138) finalStyleId = "drill";
        else finalStyleId = "boom_bap";

        finalStyleName = STYLES[finalStyleId as keyof typeof STYLES];
        
        // Update store and local state with text-derived style
        setGwStyle(finalStyleId);
        setDetectedStyle({ id: finalStyleId, name: finalStyleName });
      }
    }

    // Artificial "Deep Analysis" Buffer for UX
    await delay(2500); 

    setFlowDNA({
      tag: `GetNice Hybrid [${finalStyleName}]`,
      referenceText: textInput.trim() || "Focus on the struggle, the hustle, and survival.",
      syllableDensity: finalStyleId === "chopper" ? 5.5 : finalStyleId === "drill" ? 4.0 : 3.5,
    });

    setStatus("success");
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in duration-500 py-10">
      
      {status === "idle" && (
        <div className="w-full">
          {/* Header */}
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
              ${micStatus === "listening" ? "border-[#E60000] shadow-[0_0_20px_rgba(230,0,0,0.1)]" : micStatus === "analyzing_cadence" ? "border-yellow-500/50" : "border-[#222] hover:border-[#E60000]/50"}`}
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
                      onClick={handleRecordCadence}
                      disabled={micStatus !== "idle"}
                      className={`w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all duration-300
                      ${micStatus === "recorded" ? "bg-green-500/10 border-green-500 text-green-500" : "bg-black border-[#222] text-[#444] group-hover:text-white group-hover:border-white"}`}
                    >
                      {micStatus === "recorded" ? <CheckCircle2 size={40} /> : <Mic2 size={40} />}
                    </button>
                  )}
                </div>
              )}

              <div className="h-10 flex items-center justify-center w-full relative z-10">
                {micStatus === "recorded" && detectedStyle ? (
                  <div className="bg-green-500/10 border border-green-500/30 px-4 py-2 flex flex-col w-full animate-in zoom-in">
                    <span className="text-[8px] font-mono text-green-500 uppercase tracking-widest font-bold">Vocal Match Detected</span>
                    <span className="text-xs font-oswald text-white uppercase tracking-widest">{detectedStyle.name}</span>
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

          {/* Integration Info Box */}
          <div className="flex items-start gap-3 p-4 bg-[#110000] border border-[#E60000]/30 mb-8 max-w-2xl mx-auto">
            <Info className="text-[#E60000] shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-oswald text-sm text-[#E60000] uppercase tracking-widest font-bold mb-1">The GetNice Hybrid Flow</p>
              <p className="font-mono text-[10px] text-[#888] uppercase leading-relaxed">
                By synthesizing your input, the engine creates a lyrical blend of your unique cadence intertwined with the proprietary GetNice architecture.
              </p>
            </div>
          </div>

          <button
            disabled={(micStatus === "idle" || micStatus === "listening") && textInput.trim() === ""}
            onClick={handleSynthesize}
            className="w-full bg-[#E60000] disabled:opacity-20 disabled:cursor-not-allowed text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] rounded transition-all hover:bg-red-700"
          >
            Synthesize Hybrid Flow
          </button>
        </div>
      )}

      {/* Analyzing Phase View */}
      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Extracting DNA</h2>
          <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest animate-pulse">Blending with GetNice Architecture...</p>
        </div>
      )}

      {/* Result Phase View */}
      {status === "success" && (
        <div className="w-full animate-in zoom-in duration-500 max-w-2xl mx-auto">
          <div className="text-center mb-10 bg-[#050505] border border-[#222] p-12 rounded-lg">
            <CheckCircle2 size={64} className="text-green-500 mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
            <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">Hybrid Flow Locked</h2>
            {detectedStyle && (
              <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest mb-4 border border-green-500/20 bg-green-500/5 py-2 inline-block px-4">
                Architecture Matrix: {detectedStyle.name}
              </p>
            )}
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest leading-relaxed">
              Your flow DNA has been successfully blended with the GetNice lyrical structure. The Ghostwriter is now primed.
            </p>
          </div>
          <button
            onClick={() => setActiveRoom("03")}
            className="flex items-center justify-center gap-3 w-full bg-white text-black py-5 font-oswald font-bold text-lg uppercase tracking-[0.2em] hover:bg-[#E60000] hover:text-white transition-colors"
          >
            Enter Ghostwriter Suite <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}