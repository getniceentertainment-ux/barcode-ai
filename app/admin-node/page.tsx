"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Play, Pause, CheckCircle2, XCircle, ArrowLeft, BarChart, Clock, Music } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Submission {
  id: string;
  user_id: string;
  title: string;
  audio_url: string;
  hit_score: number;
  status: string;
  created_at: string;
}

export default function AdminNode() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      // Remove from the local UI list instantly
      setSubmissions(prev => prev.filter(sub => sub.id !== id));
    } catch (err) {
      console.error(`Error updating status to ${newStatus}:`, err);
      alert("Failed to update track status.");
    }
  };

  const togglePlay = (id: string) => {
    const currentAudio = document.getElementById(`audio-${playingId}`) as HTMLAudioElement;
    const newAudio = document.getElementById(`audio-${id}`) as HTMLAudioElement;

    if (playingId === id) {
      currentAudio?.pause();
      setPlayingId(null);
    } else {
      if (currentAudio) currentAudio.pause();
      if (newAudio) {
        newAudio.currentTime = 0;
        newAudio.play();
      }
      setPlayingId(id);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#E60000] p-8 md:p-16 flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-[#222] pb-6 gap-6">
        <div>
          <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-4">
            <ShieldAlert size={32} /> Label Boss // A&R Dashboard
          </h1>
          <p className="font-mono text-xs text-[#888] uppercase tracking-[0.2em] mt-2">
            Secure Node: Reviewing Mastered Submissions for Global Radio
          </p>
        </div>
        <Link 
          href="/" 
          className="flex items-center gap-2 bg-[#111] border border-[#333] px-6 py-3 font-oswald uppercase text-sm tracking-widest hover:bg-white hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Return to Matrix
        </Link>
      </div>

      {/* SUBMISSIONS QUEUE */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <div className="w-8 h-8 border-2 border-[#E60000] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-mono text-[10px] uppercase tracking-widest">Querying Blockchain Ledger...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-[#222] bg-[#0a0a0a]">
            <Music size={48} className="text-[#333] mb-4" />
            <p className="font-oswald text-xl uppercase tracking-widest text-[#555]">A&R Queue is Empty</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#444] mt-2">No pending tracks require review.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="bg-black border border-[#222] p-6 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-[#E60000]/50 transition-colors">
                
                {/* Hidden Audio Player for Previewing */}
                <audio id={`audio-${sub.id}`} src={sub.audio_url} onEnded={() => setPlayingId(null)} className="hidden" />

                <div className="flex items-center gap-6 w-full md:w-auto">
                  <button 
                    onClick={() => togglePlay(sub.id)}
                    className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all ${
                      playingId === sub.id 
                        ? 'bg-[#E60000] text-white shadow-[0_0_20px_rgba(230,0,0,0.4)]' 
                        : 'bg-[#111] text-[#E60000] hover:bg-white hover:text-black'
                    }`}
                  >
                    {playingId === sub.id ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                  </button>
                  
                  <div className="overflow-hidden">
                    <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white truncate">
                      {sub.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 font-mono text-[10px] text-[#888] uppercase tracking-widest">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(sub.created_at).toLocaleDateString()}</span>
                      <span className="text-[#555]">ID: {sub.user_id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                  <div className="flex flex-col items-center justify-center px-6 border-x border-[#222]">
                    <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest mb-1 flex items-center gap-1">
                      <BarChart size={10} /> Hit Score
                    </span>
                    <span className={`font-oswald text-2xl font-bold ${sub.hit_score >= 80 ? 'text-green-500' : sub.hit_score >= 65 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                      {sub.hit_score}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleStatusUpdate(sub.id, 'rejected')}
                      className="bg-[#110000] text-[#E60000] border border-[#E60000]/30 hover:bg-[#E60000] hover:text-white px-4 py-3 font-oswald text-sm uppercase tracking-widest font-bold transition-all flex items-center gap-2"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(sub.id, 'approved')}
                      className="bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500 hover:text-black px-4 py-3 font-oswald text-sm uppercase tracking-widest font-bold transition-all flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} /> Approve (Radio)
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}