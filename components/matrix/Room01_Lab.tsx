"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, DollarSign, Loader2, CheckCircle2, Activity, Zap } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, userSession, addToast } = useMatrixStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // NEW: Added the 'separating' status for the MDX stage
  const [status, setStatus] = useState<"idle" | "uploading" | "separating" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [useDemucs, setUseDemucs] = useState(false);
  
  const [beats, setBeats] = useState<{name: string, url: string, price: number}[]>([
    { name: "GN_Beat_01_Drill_142BPM.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", price: 149.99 },
    { name: "GN_Beat_02_Trap_120BPM.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", price: 49.99 }
  ]);

  React.useEffect(() => {
    const fetchMarketplaceBeats = async () => {
      try {
        const { data, error } = await supabase.storage.from('marketplace_beats').list();
        if (error) throw error;
        if (data && data.length > 0) {
          const fetchedBeats = data
            .filter(file => file.name.endsWith('.mp3') || file.name.endsWith('.wav'))
            .map(file => {
              const bpmMatch = file.name.match(/_?(\d+)\s*BPM/i);
              const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 120;
              let calculatedPrice = 29.99;
              if (bpm >= 140) calculatedPrice = 149.99;
              else if (bpm >= 125) calculatedPrice = 99.99;
              else if (bpm >= 110) calculatedPrice = 49.99;

              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              return { name: file.name, url: urlData.publicUrl, price: calculatedPrice };
            });
          
          if (fetchedBeats.length > 0) {
            setBeats(prev => {
              const existingNames = new Set(prev.map(p => p.name));
              const newBeats = fetchedBeats.filter(fb => !existingNames.has(fb.name));
              return [...prev, ...newBeats];
            });
          }
        }
      } catch (err) {
        console.error("Failed to load beats from Supabase marketplace:", err);
      }
    };
    fetchMarketplaceBeats();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userSession?.id) return;
    
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      if(addToast) addToast("Security Breach: Only WAV and MP3 formats are permitted.", "error");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      if(addToast) addToast("Payload Exceeds 20MB Limit. Please compress audio file.", "error");
      return;
    }

    setStatus("uploading");
    
    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('credits, tier').eq('id', userSession.id).single();
      if (profileError || !profile) throw new Error("Could not verify identity in ledger.");
      
      const requiredCredits = useDemucs ? 2 : 1; // 2 credits if splitting stems
      if (profile.tier !== 'The Mogul' && profile.credits < requiredCredits) {
        throw new Error("Insufficient Credits. Upgrade your tier to execute this operation.");
      }

      const filePath = `${userSession.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      let currentCloudUrl = publicUrlData.publicUrl;

      // GET SECURE JWT TOKEN FOR API CALLS
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // NEW: MDX NEURAL SEPARATION
      if (useDemucs) {
        setStatus("separating");
        const mdxRes = await fetch('/api/demucs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ file_url: currentCloudUrl })
        });
        
        const mdxData = await mdxRes.json();
        if (!mdxRes.ok) {
           await supabase.storage.from('audio_raw').remove([filePath]);
           throw new Error(mdxData.error || "MDX Separation Failed");
        }
        
        // Override the file URL with the clean instrumental so DSP doesn't get confused by vocals!
        currentCloudUrl = mdxData.instrumental_url || currentCloudUrl;
        if(addToast) addToast("MDX Separation Complete. Acapella isolated.", "success");
      }

      setStatus("analyzing");
      
      // FIXED: Passed the JWT Bearer Token to DSP
      const res = await fetch('/api/dsp', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ file_url: currentCloudUrl }) 
      });
      
      const analysis = await res.json();
      
      if (!res.ok) {
        await supabase.storage.from('audio_raw').remove([filePath]);
        throw new Error(analysis.error || "DSP Processing failed");
      }
      
      setAudioData({
        url: currentCloudUrl,
        fileName: file.name,
        bpm: analysis.bpm || 120, 
        totalBars: analysis.total_bars || 64,
        grid: analysis.grid || []
      });

      setStatus("success");
      if(addToast) addToast("Audio imported & analyzed successfully", "success");

    } catch (err: any) {
      console.error("DSP/MDX Pipeline Error:", err);
      if(addToast) addToast(err.message || "Error processing audio.", "error");
      setStatus("idle");
    }
  };

  const handleSelectMarketplaceBeat = (beat: { name: string, url: string, price: number }) => {
    setStatus("analyzing");
    setTimeout(() => {
      setAudioData({
        url: beat.url,
        fileName: beat.name,
        bpm: parseInt(beat.name.match(/_?(\d+)\s*BPM/i)?.[1] || "120"),
        totalBars: 88, 
      });
      setStatus("success");
      if(addToast) addToast("Marketplace beat secured.", "success");
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      {/* LEFT COL: INJECTION DROPZONE */}
      <div className="lg:col-span-2 flex flex-col justify-center">
        <div className={`border-2 transition-all group rounded-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]
          ${status === 'idle' ? 'border-[#222] bg-[#050505] hover:border-[#E60000] border-dashed' : 'border-[#E60000] bg-[#110000] border-solid'}`}>
          
          {status === 'analyzing' && <div className="absolute inset-0 bg-[#E60000]/10 animate-pulse pointer-events-none" />}
          
          {status === 'idle' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 relative">
              
              <div className="absolute top-4 right-4 bg-[#111] border border-[#333] px-3 py-1 flex items-center gap-2 rounded-full">
                <Zap size={12} className="text-[#E60000]" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#888]">Cost: {useDemucs ? '2 Credits' : '1 Credit'}</span>
              </div>

              <label className="cursor-pointer flex flex-col items-center mb-8">
                <UploadCloud size={64} className="mx-auto mb-6 text-[#222] group-hover:text-[#E60000] transition-colors relative z-10" />
                <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold relative z-10 text-white group-hover:text-[#E60000] transition-colors">INJECT RAW AUDIO</h2>
                <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest relative z-10">Secured via Supabase // Routing to Worker 2</p>
                <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*" ref={fileInputRef} />
              </label>

              {/* MDX Separation Toggle */}
              <div className="flex items-center gap-3 border border-[#222] bg-[#0a0a0a] px-4 py-3 rounded group hover:border-[#E60000] transition-colors">
                <input
                  type="checkbox"
                  id="mdx-toggle"
                  checked={useDemucs}
                  onChange={(e) => setUseDemucs(e.target.checked)}
                  className="accent-[#E60000] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="mdx-toggle" className="text-[10px] text-[#888] font-mono uppercase tracking-widest cursor-pointer select-none group-hover:text-white transition-colors">
                  Enable MDX Stem Split (Acapella Extraction)
                </label>
              </div>
            </div>
          )}

          {status === 'uploading' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <UploadCloud size={64} className="mx-auto mb-6 text-[#E60000] animate-bounce" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">UPLOADING...</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Transmitting to Secure Supabase Bucket</p>
            </div>
          )}

          {status === 'separating' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <Activity size={64} className="mx-auto mb-6 text-[#E60000] animate-pulse" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">MDX NEURAL SPLIT</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Deconstructing Audio into Master Stems...</p>
            </div>
          )}

          {status === 'analyzing' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <Loader2 size={64} className="mx-auto mb-6 text-[#E60000] animate-spin" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">ANALYZING</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Extracting Rhythm Grid & BPM Context</p>
            </div>
          )}

          {status === 'success' && audioData && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in w-full px-8 py-10">
              <Activity size={48} className="mx-auto mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full bg-green-500/10 p-2" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-6 font-bold text-white">Smart Analysis Complete</h2>
              
              <div className="bg-black border border-green-500/30 p-6 w-full max-w-sm mb-8 space-y-4">
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Detected BPM</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{Math.round(audioData.bpm)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Structural Length</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.totalBars} Bars</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Rhythm Grid</span>
                  <span className="text-[10px] font-mono text-green-500 tracking-widest">SECURED</span>
                </div>
              </div>

              <div className="w-full max-w-sm flex flex-col gap-3">
                <button 
                  onClick={() => setActiveRoom("02")}
                  className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Advance to Brain Train
                </button>
                
                <button 
                  onClick={() => setStatus("idle")}
                  className="w-full border border-[#333] text-[#888] py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#111] hover:text-white transition-all"
                >
                  Analyze New Track
                </button>
              </div>
            </div>
          )}
        </div>
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
                <span className="text-[9px] font-mono text-green-500 uppercase mt-1 tracking-widest">
                  Lease: ${b.price.toFixed(2)}
                </span>
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