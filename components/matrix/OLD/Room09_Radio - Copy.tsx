"use client";

import React, { useState, useEffect, useRef } from "react";
import { Radio, Users, MessageSquare, PlayCircle, Activity, Globe, Heart } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

// Mock global chat to simulate a live 24/7 broadcast
const INITIAL_CHAT = [
  { user: "Ghost_Node", msg: "This beat is absolutely lethal 🔥", isPlatform: false },
  { user: "SYSTEM", msg: "Track 'NEON BLOOD' added to the Sync Vault.", isPlatform: true },
  { user: "Drill_King_99", msg: "Who produced this??", isPlatform: false },
  { user: "Aura_Synth", msg: "GetNice algorithm going crazy right now.", isPlatform: false },
];

export default function Room09_Radio() {
  const { userSession } = useMatrixStore();
  
  const [listeners, setListeners] = useState(1402);
  const [chat, setChat] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // Simulate live fluctuations in listener count
  useEffect(() => {
    const interval = setInterval(() => {
      setListeners(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Simulate incoming messages
  useEffect(() => {
    const messages = ["yooo", "this goes hard", "Matrix taking over", "W track", "drop the link", "808s hitting different"];
    const users = ["User_492", "SynthRider", "Bass_God", "Anon_DJ", "Sector_7_Native"];
    
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        setChat(prev => [...prev.slice(-40), { 
          user: users[Math.floor(Math.random() * users.length)], 
          msg: messages[Math.floor(Math.random() * messages.length)],
          isPlatform: false
        }]);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setChat(prev => [...prev.slice(-40), { 
      user: userSession?.id || "GUEST_NODE", 
      msg: chatInput,
      isPlatform: false
    }]);
    setChatInput("");
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 overflow-hidden">
      
      {/* LEFT COL: THE BROADCAST VISUALIZER */}
      <div className="flex-1 flex flex-col relative border-r border-[#222]">
        
        {/* Stream Header */}
        <div className="absolute top-0 left-0 w-full p-6 z-20 flex justify-between items-start pointer-events-none">
          <div>
            <div className="bg-[#E60000] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 inline-flex items-center gap-2 mb-2 animate-pulse">
              <Radio size={12} /> Live Broadcast
            </div>
            <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white shadow-black drop-shadow-lg">
              GetNice Nation FM
            </h2>
          </div>
          <div className="bg-black/80 backdrop-blur-md border border-[#333] px-4 py-2 flex items-center gap-3">
            <Users size={14} className="text-[#E60000]" />
            <span className="font-mono text-sm text-white font-bold">{listeners.toLocaleString()}</span>
            <span className="text-[9px] text-[#555] uppercase tracking-widest hidden md:inline">Global Nodes</span>
          </div>
        </div>

        {/* Visualizer Environment */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#020202]">
          {/* Simulated 3D Matrix / Lofi aesthetic background */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #E60000 0%, transparent 40%)' }}></div>
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(230, 0, 0, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(230, 0, 0, 0.1) 1px, transparent 1px)', backgroundSize: '50px 50px', transform: 'perspective(500px) rotateX(60deg) translateY(-50px) translateZ(-200px)' }}></div>
          
          {/* Center Record/Logo */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-48 h-48 md:w-64 md:h-64 rounded-full border-4 border-[#222] bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(230,0,0,0.15)] group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#E60000]/20 to-transparent animate-[spin_4s_linear_infinite]"></div>
              <div className="w-16 h-16 rounded-full bg-black border-2 border-[#E60000] flex items-center justify-center z-10">
                <PlayCircle size={24} className="text-[#E60000]" />
              </div>
            </div>
            
            {/* Audio Bars simulation */}
            <div className="flex items-end gap-1 mt-12 h-16">
              {[...Array(24)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-2 bg-[#E60000] opacity-80"
                  style={{ 
                    height: `${Math.random() * 100}%`,
                    animation: `pulse ${0.5 + Math.random()}s ease-in-out infinite alternate` 
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Now Playing Footer */}
        <div className="bg-black border-t border-[#222] p-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-4">
            <Activity size={24} className="text-[#E60000]" />
            <div>
              <p className="text-[10px] text-[#E60000] uppercase font-bold tracking-widest mb-1">Now Playing Globally</p>
              <p className="font-oswald text-xl text-white tracking-widest font-bold">MATRIX INFILTRATION</p>
              <p className="font-mono text-xs text-[#888] uppercase mt-1">Prod. USER_77X // Score: 92/100</p>
            </div>
          </div>
          <button className="h-12 w-12 rounded-full border border-[#333] flex items-center justify-center text-[#888] hover:text-[#E60000] hover:border-[#E60000] transition-colors">
            <Heart size={20} />
          </button>
        </div>
      </div>

      {/* RIGHT COL: LIVE GLOBAL CHAT */}
      <div className="w-full md:w-80 lg:w-96 bg-[#0a0a0a] flex flex-col h-64 md:h-full shrink-0">
        <div className="p-4 border-b border-[#222] bg-black flex items-center gap-3">
          <MessageSquare size={16} className="text-[#E60000]" />
          <h3 className="font-oswald text-sm uppercase tracking-widest font-bold text-white">Global Feed</h3>
          <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {chat.map((c, i) => (
            <div key={i} className={`text-sm font-mono leading-relaxed ${c.isPlatform ? 'bg-[#110000] border border-[#330000] p-3' : ''}`}>
              <span className={`font-bold mr-2 ${c.isPlatform ? 'text-[#E60000]' : c.user === userSession?.id ? 'text-green-500' : 'text-[#888]'}`}>
                {c.user}:
              </span>
              <span className={c.isPlatform ? 'text-white' : 'text-gray-300'}>{c.msg}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-black border-t border-[#222]">
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send a message..." 
              className="w-full bg-[#111] border border-[#333] px-4 py-3 pr-12 text-xs text-white outline-none focus:border-[#E60000] font-mono transition-colors"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#E60000] disabled:opacity-50 transition-colors"
            >
              <Globe size={18} />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}