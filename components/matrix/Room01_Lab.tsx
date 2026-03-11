"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, DollarSign, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { setAudioData, setActiveRoom, userSession, addToast } = useMatrixStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">("idle");
  
  const [beats] = useState([
    { name: "GN_Beat_01_Drill_142BPM.mp3", url: "[https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3](https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3)", price: 29.99 },
    { name: "GN_Beat_02_Trap_120BPM.mp3", url: "[https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3](https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3)", price: 29.99 }
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userSession?.id) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      addToast("Security Breach: Only WAV and MP3 formats are permitted.", "error");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      addToast("Payload Exceeds 20MB Limit. Please compress audio file.", "error");
      return;
    }
    
    setStatus("uploading");
    
    try {
      const filePath = `${userSession.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      const cloudUrl = publicUrlData.publicUrl;

      setStatus("analyzing");
      
      const res = await fetch('/api/dsp', { 
        method: 'POST', 
        body: JSON.stringify({ file_url: cloudUrl, userId: userSession.id }) 
      });
      
      if (!res.ok) throw new Error("DSP Processing failed");
      const analysis = await res.json();
      
      // SPRINT 2: Save the 'key' to the Matrix Store
      setAudioData({
        url: cloudUrl,
        fileName: file.name,
        bpm: analysis.bpm || 120,
        totalBars: analysis.total_bars || 16,
        key: analysis.key || "Unknown",
        grid: analysis.grid || []
      });

      setStatus("success");
      addToast(`Ingested: ${file.name}. Audio secured in Matrix.`, "success");
      setTimeout(() => setActiveRoom("02"), 1500);

    } catch (err: any) {
      console.error("DSP Pipeline Error:", err);
      addToast(err.message || "Error processing audio.", "error");
      setStatus("idle");
    }
  };

  const handleSelectMarketplaceBeat = (beat: { name: string, url: string, price: number }) => {
    setStatus("analyzing");
    setTimeout(() => {
      setAudioData({
        url: beat.url,
        fileName: beat.name,
        bpm: parseInt(beat.name.match(/_(\d+)BPM/)?.[1] || "120"),
        totalBars: 64,
        key: "C# Minor" // Simulated Marketplace Key
      });
      setStatus("success");
      addToast(`Leased Beat Secured: ${beat.name}`, "success");
      setTimeout(() => setActiveRoom("02"), 1000);
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-2 flex flex-col justify-center">
        <label className={`border-2 border-dashed transition-all cursor-pointer group rounded-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]
          ${status === 'idle' ? 'border-[#222] bg-[#050505] hover:border-[#E60000]' : 'border-[#E60000] bg-[#110000]'}`}>
          {status === 'analyzing' && <div className="absolute inset-0 bg-[#E60000]/10 animate-pulse" />}
          
          {status === 'idle' && (
            <>
              <UploadCloud size={64} className="mx-auto mb-6 text-[#222] group-hover:text-[#E60000] transition-colors relative z-10" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold relative z-10 text-white">INJECT RAW AUDIO</h2>
              <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest relative z-10">Secured via Supabase // Routing to Worker 2</p>
              <div className="mt-6 flex items-center gap-2 text-[9px] text-yellow-600 font-mono uppercase tracking-widest bg-yellow-900/10 py-1 px-3 border border-yellow-900/30">
                <AlertTriangle size={12} /> Strict Limit: 20MB (WAV/MP3)
              </div>
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="audio/mpeg, audio/wav, audio/mp3" />
            </>
          )}
          {status === 'uploading' && (
            <div className="relative z-10 flex flex-col items-center">
              <UploadCloud size={64} className="mx-auto mb-6 text-[#E60000] animate-bounce" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">UPLOADING...</h2>
            </div>
          )}
          {status === 'analyzing' && (
            <div className="relative z-10 flex flex-col items-center">
              <Loader2 size={64} className="mx-auto mb-6 text-[#E60000] animate-spin" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">ANALYZING</h2>
            </div>
          )}
          {status === 'success' && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in">
              <CheckCircle2 size={64} className="mx-auto mb-6 text-green-500" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">DSP COMPLETE</h2>
            </div>
          )}
        </label>
      </div>

      <div className="bg-[#050505] border border-[#111] p-6 rounded-lg overflow-y-auto custom-scrollbar flex flex-col">
        <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] border-b border-[#222] pb-3 mb-4 font-bold flex items-center gap-2">
          <DollarSign size={16} /> Marketplace // Beats
        </h3>
        <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-6 leading-relaxed">
          Select a pre-analyzed track to bypass the DSP processing queue.
        </p>
        <div className="space-y-3 flex-1">
          {beats.map((b, i) => (
            <div key={i} className="bg-black p-4 border border-[#111] flex items-center justify-between group hover:border-[#E60000] transition-colors">
              <div className="flex flex-col pr-4 overflow-hidden">
                <span className="text-[10px] font-mono text-gray-300 uppercase truncate font-bold">{b.name}</span>
                <span className="text-[8px] font-mono text-green-500 uppercase mt-1">${b.price} Lease</span>
              </div>
              <button onClick={() => handleSelectMarketplaceBeat(b)} disabled={status !== 'idle'} className="bg-white text-black px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-colors disabled:opacity-50 shrink-0">
                Select
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}