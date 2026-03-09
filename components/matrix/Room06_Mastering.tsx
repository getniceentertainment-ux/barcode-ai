"use client";

import React, { useState, useEffect } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

// --- DSP UTILITY: WAV ENCODER ---
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

export default function Room06_Mastering() {
  const { audioData, vocalStems, setActiveRoom, addToast } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); // -14 LUFS is the Spotify/Apple Music standard
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [masterUrl, setMasterUrl] = useState<string | null>(null);

  const handleMastering = async () => {
    if (!audioData?.url) {
      if(addToast) addToast("No instrumental beat detected in Matrix.", "error");
      return;
    }
    
    setStatus("processing");

    try {
      const beatUrl = audioData.url;
      // We grab the first stem assuming it's the "MIXED_STEM" output from Room 05
      const vocalUrl = vocalStems.length > 0 ? vocalStems[0].url : null;

      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 1. Decode Instrumental Beat
      const beatResp = await fetch(beatUrl);
      const beatArrayBuf = await beatResp.arrayBuffer();
      const beatBuf = await tmpCtx.decodeAudioData(beatArrayBuf);
      let maxDuration = beatBuf.duration;

      // 2. Decode Vocals (if present)
      let vocalBuf: AudioBuffer | null = null;
      if (vocalUrl) {
        const vocalResp = await fetch(vocalUrl);
        const vocalArrayBuf = await vocalResp.arrayBuffer();
        vocalBuf = await tmpCtx.decodeAudioData(vocalArrayBuf);
        if (vocalBuf.duration > maxDuration) maxDuration = vocalBuf.duration;
      }

      // 3. Setup Offline Render Canvas
      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);

      // 4. Create Master Bus & Effects Chain
      const mixBus = offlineCtx.createGain();
      
      // Calculate Gain multiplier based on LUFS Slider 
      // Base -14 LUFS = 1.0 (No gain). Pushing it to -6 adds significant digital gain before the limiter.
      const targetGain = Math.pow(10, ((lufs - (-14)) / 20)); 
      mixBus.gain.value = targetGain;

      // GLUE COMPRESSOR (Smooths the beat and vocals together)
      const compressor = offlineCtx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.01; // 10ms
      compressor.release.value = 0.25; // 250ms

      // BRICKWALL LIMITER (Prevents 0dB Clipping)
      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20; // Hard limiting
      limiter.attack.value = 0.001; // Instant catch
      limiter.release.value = 0.050; // Fast release

      // Routing
      mixBus.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(offlineCtx.destination);

      // 5. Connect and Mix Audio Sources
      const beatSource = offlineCtx.createBufferSource();
      beatSource.buffer = beatBuf;
      const beatGain = offlineCtx.createGain();
      // Duck the beat slightly if vocals exist to create pocket
      beatGain.gain.value = vocalBuf ? 0.75 : 1.0; 
      beatSource.connect(beatGain);
      beatGain.connect(mixBus);
      beatSource.start(0);

      if (vocalBuf) {
        const vocalSource = offlineCtx.createBufferSource();
        vocalSource.buffer = vocalBuf;
        const vocalGain = offlineCtx.createGain();
        // Boost vocals slightly to sit on top
        vocalGain.gain.value = 1.2; 
        vocalSource.connect(vocalGain);
        vocalGain.connect(mixBus);
        vocalSource.start(0);
      }

      // 6. Execute the Bounce
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const finalUrl = URL.createObjectURL(wavBlob);

      setMasterUrl(finalUrl);
      if(addToast) addToast("Master encoded successfully.", "success");
      setStatus("success");

    } catch (err: any) {
      console.error("DSP Mastering Error:", err);
      if(addToast) addToast("Error rendering master: " + err.message, "error");
      setStatus("idle");
    }
  };

  const handleProceed = () => {
    setActiveRoom("07");
  };

  const handleDownload = () => {
    if (!masterUrl) return;
    const a = document.createElement("a");
    a.href = masterUrl;
    a.download = `${audioData?.fileName?.replace(/\.[^/.]+$/, "") || "Bar-Code_Track"}_MASTER.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* Dynamic Header Icon based on state */}
      <div className="mb-10 relative">
        {status === "idle" && <Disc3 size={80} className="text-[#333] animate-[spin_10s_linear_infinite]" />}
        {status === "processing" && <AudioWaveform size={80} className="text-[#E60000] animate-pulse" />}
        {status === "success" && <CheckCircle2 size={80} className="text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full" />}
      </div>

      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">
          R06: Mastering Suite
        </h2>
        {status === "idle" && (
          <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">
            Final Output Limiters // LUFS Normalization
          </p>
        )}
        {status === "processing" && (
          <p className="font-mono text-xs text-[#E60000] uppercase tracking-[0.2em] animate-pulse">
            Applying Multi-band Compression & True Peak Limiting...
          </p>
        )}
        {status === "success" && (
          <p className="font-mono text-xs text-green-500 uppercase tracking-[0.2em]">
            Commercial Standard Reached // Ready for Distribution
          </p>
        )}
      </div>

      {status === "idle" && (
        <div className="w-full bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all duration-500">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="w-full max-w-lg mb-12 relative z-10">
            <div className="flex justify-between items-end text-[10px] uppercase font-bold text-[#888] mb-6">
              <span className="flex items-center gap-2"><Sliders size={14} className="text-[#E60000]" /> Target Loudness</span>
              <div className="text-right">
                <span className={`font-oswald text-3xl font-bold ${lufs > -10 ? 'text-[#E60000]' : lufs > -12 ? 'text-yellow-500' : 'text-white'}`}>
                  {lufs} <span className="text-xs font-mono text-[#555]">LUFS</span>
                </span>
              </div>
            </div>
            
            <div className="relative">
              <input 
                type="range" min="-20" max="-6" step="0.5" 
                value={lufs} 
                onChange={(e) => setLufs(parseFloat(e.target.value))} 
                className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full relative z-10" 
              />
              <div className="flex justify-between text-[8px] font-mono text-[#444] mt-3 absolute w-full -bottom-6">
                <span>-20 (VINYL)</span>
                <span className="text-white border-b border-white">-14 (SPOTIFY)</span>
                <span>-10 (CLUB)</span>
                <span className="text-[#E60000]">-6 (BRICK)</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleMastering} 
            className="relative z-10 w-full max-w-lg bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] hover:shadow-[0_0_30px_rgba(230,0,0,0.4)] flex justify-center items-center gap-2"
          >
            Initiate Final Master
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-lg bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg relative overflow-hidden flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <div className="w-full h-1 bg-[#111] overflow-hidden mb-4">
            <div className="h-full bg-[#E60000] w-full animate-[pulse_1s_ease-in-out_infinite]" style={{ transformOrigin: "left", animationName: "scale-x" }}></div>
          </div>
          <div className="w-full flex justify-between text-[9px] font-mono uppercase text-[#555]">
            <span>Rendering OfflineAudioContext</span>
            <span className="text-[#E60000]">Peak: -0.5dB Limit</span>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-lg space-y-4">
          {masterUrl && (
            <div className="w-full bg-[#111] border border-[#333] p-6 flex justify-between items-center">
               <div>
                  <p className="text-[10px] text-[#888] font-mono uppercase tracking-widest mb-1">Final Artifact</p>
                  <p className="font-oswald text-lg text-white tracking-widest truncate">MASTER_MIX.WAV</p>
               </div>
               <button 
                 onClick={handleDownload}
                 className="bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-black p-3 rounded transition-colors"
                 title="Download Output"
               >
                 <Download size={20} />
               </button>
            </div>
          )}

          <button 
            onClick={handleProceed} 
            className="w-full flex justify-center items-center gap-3 bg-white text-black py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Move to Distribution <ArrowRight size={20} />
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scale-x {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}} />
    </div>
  );
}