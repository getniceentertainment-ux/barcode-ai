"use client";

import React, { useState, useEffect } from "react";
import { UploadCloud, DollarSign, Loader2, CheckCircle2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { setAudioData, setActiveRoom, userSession } = useMatrixStore();
  
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">("idle");
  
  // ADDED: price property to the state
  const [beats, setBeats] = useState<{name: string, url: string, price: number}[]>([]);

  // Fetch live marketplace beats directly from your Supabase bucket
  useEffect(() => {
    const fetchMarketplaceBeats = async () => {
      try {
        const { data, error } = await supabase.storage.from('marketplace_beats').list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
        if (error) throw error;
        
        if (data) {
          // Mocking real marketplace prices (e.g., $29.99, $49.99, $99.99)
          const standardPrices = [29.99, 49.99, 99.99, 149.99];
          
          const formattedBeats = data
            .filter(file => file.name !== '.emptyFolderPlaceholder' && file.name !== '.DS_Store')
            .map(file => {
              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              // Randomly assign one of the standard prices for realism
              const randomPrice = standardPrices[Math.floor(Math.random() * standardPrices.length)];
              
              return { name: file.name, url: urlData.publicUrl, price: randomPrice };
            });
          setBeats(formattedBeats);
        }
      } catch (err) {
        console.error("Failed to load marketplace beats:", err);
      }
    };
    fetchMarketplaceBeats();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userSession?.id) return;
    
    setStatus("uploading");
    
    try {
      // 1. Upload to Supabase 'raw-audio' Bucket (organized by user ID)
      const filePath = `${userSession.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('raw-audio')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get the real Public Cloud URL for this file
      const { data: publicUrlData } = supabase.storage
        .from('raw-audio')
        .getPublicUrl(filePath);
        
      const cloudUrl = publicUrlData.publicUrl;

      setStatus("analyzing");
      
      // Hit the Next.js API which securely pings Worker 2 (Essentia)
      const res = await fetch('/api/dsp', { 
        method: 'POST', 
        body: JSON.stringify({ file_url: cloudUrl, userId: userSession?.id }) 
      });
      const analysis = await res.json();

      // 1. Save real data to Zustand Global Store
      setAudioData({
        url: publicUrl,
        fileName: file.name,
        bpm: analysis.bpm,
        totalBars: analysis.total_bars,
        grid: analysis.grid
      });

      setStatus("success");
      
      // 2. Automatically advance the Matrix Controller to Room 02
      setTimeout(() => {
        setActiveRoom("02");
      }, 1500);

    } catch (err) {
      console.error("DSP Pipeline Error:", err);
      setStatus("idle");
    }
  };

  const handleSelectMarketplaceBeat = (beat: { name: string, url: string }) => {
    setStatus("analyzing");
    
    // Simulate DSP on a pre-existing beat
    setTimeout(() => {
      setAudioData({
        url: beat.url,
        fileName: beat.name,
        bpm: parseInt(beat.name.match(/_(\d+)BPM/)?.[1] || "120"),
        totalBars: 16,
      });
      setStatus("success");
      
      setTimeout(() => setActiveRoom("02"), 1000);
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      {/* LEFT COL: INJECTION DROPZONE */}
      <div className="lg:col-span-2 flex flex-col justify-center">
        <label className={`border-2 border-dashed transition-all cursor-pointer group rounded-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]
          ${status === 'idle' ? 'border-[#222] bg-[#050505] hover:border-[#E60000]' : 'border-[#E60000] bg-[#110000]'}`}>
          
          {status === 'analyzing' && <div className="absolute inset-0 bg-[#E60000]/10 animate-pulse" />}
          
          {status === 'idle' && (
            <>
              <UploadCloud size={64} className="mx-auto mb-6 text-[#222] group-hover:text-[#E60000] transition-colors relative z-10" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold relative z-10 text-white">INJECT RAW AUDIO</h2>
              <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest relative z-10">Supports WAV, MP3 // Routing to Worker 2 (Essentia DSP)</p>
              <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*" />
            </>
          )}

          {status === 'uploading' && (
            <div className="relative z-10 flex flex-col items-center">
              <UploadCloud size={64} className="mx-auto mb-6 text-[#E60000] animate-bounce" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">UPLOADING...</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Transmitting to Secure Bucket</p>
            </div>
          )}

          {status === 'analyzing' && (
            <div className="relative z-10 flex flex-col items-center">
              <Loader2 size={64} className="mx-auto mb-6 text-[#E60000] animate-spin" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">ANALYZING</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Extracting Rhythm Grid & BPM Context</p>
            </div>
          )}

          {status === 'success' && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in">
              <CheckCircle2 size={64} className="mx-auto mb-6 text-green-500" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">DSP COMPLETE</h2>
              <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest">Routing to Brain Train...</p>
            </div>
          )}
        </label>
      </div>

      {/* RIGHT COL: MARKETPLACE */}
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
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-[#E60000] font-bold">${b.price}</span>
                  <span className="text-[8px] font-mono text-[#555] uppercase">Standard Lease</span>
                </div>
              </div>
              <button 
                onClick={() => handleSelectMarketplaceBeat(b)}
                disabled={status !== 'idle'}
                className="bg-white text-black px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-colors disabled:opacity-50 shrink-0"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}