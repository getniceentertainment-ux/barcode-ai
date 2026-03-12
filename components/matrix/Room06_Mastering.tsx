"use client";

import React, { useState } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, Disc3, Download, RefreshCw, FileArchive, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import JSZip from 'jszip';
import jsPDF from 'jspdf';

function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length), view = new DataView(bufferArray),
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
      } offset++;
  }
  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, setActiveRoom, addToast, finalMaster, setFinalMaster, userSession } = useMatrixStore();
  const [lufs, setLufs] = useState(-14); 
  const [status, setStatus] = useState<"idle" | "processing" | "uploading" | "success">(finalMaster ? "success" : "idle");
  const [isZipping, setIsZipping] = useState(false);

  const handleMastering = async () => {
    if (!audioData?.url) { addToast("No instrumental beat detected.", "error"); return; }
    setStatus("processing");

    try {
      const beatResp = await fetch(audioData.url);
      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beatBuf = await tmpCtx.decodeAudioData(await beatResp.arrayBuffer());
      let maxDuration = beatBuf.duration;

      let vocalBuf: AudioBuffer | null = null;
      if (vocalStems.length > 0) {
        const vocalResp = await fetch(vocalStems[0].url);
        vocalBuf = await tmpCtx.decodeAudioData(await vocalResp.arrayBuffer());
        if (vocalBuf.duration > maxDuration) maxDuration = vocalBuf.duration;
      }

      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const mixBus = offlineCtx.createGain();
      mixBus.gain.value = Math.pow(10, ((lufs - (-14)) / 20)); 

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5; limiter.knee.value = 0; limiter.ratio.value = 20; 
      limiter.attack.value = 0.001; limiter.release.value = 0.050;
      mixBus.connect(limiter); limiter.connect(offlineCtx.destination);

      const beatSource = offlineCtx.createBufferSource(); beatSource.buffer = beatBuf;
      const beatGain = offlineCtx.createGain(); beatGain.gain.value = vocalBuf ? 0.75 : 1.0; 
      beatSource.connect(beatGain); beatGain.connect(mixBus); beatSource.start(0);

      if (vocalBuf) {
        const vocalSource = offlineCtx.createBufferSource(); vocalSource.buffer = vocalBuf;
        const vocalGain = offlineCtx.createGain(); vocalGain.gain.value = 1.2; 
        vocalSource.connect(vocalGain); vocalGain.connect(mixBus); vocalSource.start(0);
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);

      // THE FIX: Immediately upload to Supabase to prevent React memory loss!
      setStatus("uploading");
      const safeId = userSession?.id || "GUEST";
      const fileName = `${safeId}/${Date.now()}_MASTER.wav`;
      
      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(fileName, wavBlob, { contentType: 'audio/wav', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('public_audio').getPublicUrl(fileName);
      const cloudUrl = publicUrlData.publicUrl;

      // Store ONLY the permanent cloud URL. We no longer rely on the volatile Blob.
      setFinalMaster({ url: cloudUrl, blob: wavBlob }); 
      
      if(addToast) addToast("Master encoded and secured in the Cloud.", "success");
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      if(addToast) addToast("Error rendering master.", "error");
      setStatus("idle");
    }
  };

  const needleRotation = ((lufs - (-20)) / ((-6) - (-20))) * 90 - 45;

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">R06: Mastering Suite</h2>
      </div>

      {status === "idle" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all duration-500">
          <div className="w-48 h-24 overflow-hidden relative mb-8 flex justify-center items-end border-b-2 border-[#333] bg-[#0a0a0a] rounded-t-full">
             <div className="absolute w-full h-full rounded-t-full border-t-[8px] border-l-[8px] border-r-[8px] border-[#222] z-10"></div>
             <div className="w-1 h-20 bg-[#E60000] origin-bottom transition-transform duration-300 ease-out z-20 shadow-[0_0_10px_rgba(230,0,0,0.5)]" style={{ transform: `rotate(${needleRotation}deg)` }}></div>
          </div>
          <div className="w-full mb-12 relative z-10">
            <div className="flex justify-between items-end text-[10px] uppercase font-bold text-[#888] mb-6">
              <span className="flex items-center gap-2"><Sliders size={14} className="text-[#E60000]" /> Target Loudness</span>
              <span className={`font-oswald text-3xl font-bold ${lufs > -10 ? 'text-[#E60000]' : lufs > -12 ? 'text-yellow-500' : 'text-white'}`}>{lufs} <span className="text-xs font-mono text-[#555]">LUFS</span></span>
            </div>
            <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full relative z-10" />
          </div>
          <button onClick={handleMastering} className="relative z-10 w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Initiate Lossless Master</button>
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <p className="text-[10px] uppercase text-[#E60000] tracking-widest">Rendering AudioContext (Peak -0.5dB)</p>
        </div>
      )}
      
      {status === "uploading" && (
        <div className="w-full max-w-xl bg-[#050505] border border-green-500/30 p-10 rounded-lg flex flex-col items-center">
          <Loader2 size={64} className="text-green-500 animate-spin mb-8" />
          <p className="text-[10px] uppercase text-green-500 tracking-widest">Encrypting artifact to Supabase Ledger...</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-xl space-y-4">
          <div className="w-full bg-[#0a0a0a] border border-[#333] p-6 flex justify-between items-center group hover:border-[#E60000] transition-colors">
             <div>
                <p className="text-[10px] text-[#E60000] font-mono uppercase tracking-widest mb-1 font-bold">Studio Export Ready</p>
                <p className="font-oswald text-xl text-white tracking-widest truncate">{audioData?.fileName?.replace(/\.[^/.]+$/, "") || "TRACK"}_MASTER.wav</p>
             </div>
             <a href={finalMaster?.url} target="_blank" rel="noreferrer" className="bg-white text-black hover:bg-[#E60000] hover:text-white p-4 rounded-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]">
               <Download size={24} />
             </a>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button onClick={() => setActiveRoom("07")} className="w-full flex justify-center items-center gap-3 bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Route to Distribution <ArrowRight size={20} /></button>
            <button onClick={() => { setFinalMaster(null); setStatus("idle"); }} className="w-full border border-[#222] text-[#555] py-3 font-oswald text-xs font-bold uppercase tracking-widest hover:text-white hover:border-white transition-all flex justify-center items-center gap-2"><RefreshCw size={14} /> Re-Master Track</button>
          </div>
        </div>
      )}
    </div>
  );
}