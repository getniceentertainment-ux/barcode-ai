"use client";

import CreditHustle from '../components/matrix/CreditHustle';
import React from "react";
import Link from "next/link";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut
} from "lucide-react";
import { useMatrixStore } from "../store/useMatrixStore";

// The Gateway
import EntryGateway from "../components/matrix/EntryGateway";

// The 10 Matrix Rooms
import Room01_Lab from "../components/matrix/Room01_Lab";
import Room02_BrainTrain from "../components/matrix/Room02_BrainTrain";
import Room03_Ghostwriter from "../components/matrix/Room03_Ghostwriter";
import Room04_Booth from "../components/matrix/Room04_Booth";
import Room05_VocalSuite from "../components/matrix/Room05_VocalSuite";
import Room06_Mastering from "../components/matrix/Room06_Mastering";
import Room07_Distribution from "../components/matrix/Room07_Distribution";
import Room08_Bank from "../components/matrix/Room08_Bank";
import Room09_Radio from "../components/matrix/Room09_Radio";
import Room10_Social from "../components/matrix/Room10_Social";

export default function MatrixController() {
  const { hasAccess, activeRoom, setActiveRoom, userSession, clearMatrix } = useMatrixStore();

  // If the user hasn't selected a tier or authenticated, lock the mainframe.
  if (!hasAccess) {
    return <EntryGateway />;
  }

  const rooms = [
    { id: "01", name: "The Lab", icon: <UploadCloud size={16} /> },
    { id: "02", name: "Brain Train", icon: <Cpu size={16} /> },
    { id: "03", name: "Ghostwriter", icon: <PenTool size={16} /> },
    { id: "04", name: "The Booth", icon: <Mic2 size={16} /> },
    { id: "05", name: "Engineering", icon: <Layers size={16} /> },
    { id: "06", name: "Mastering", icon: <Sliders size={16} /> },
    { id: "07", name: "Distribution", icon: <Send size={16} /> },
    { id: "08", name: "The Bank", icon: <Wallet size={16} /> },
    { id: "09", name: "The Radio", icon: <Radio size={16} /> },
    { id: "10", name: "Social Syndicate", icon: <Users size={16} /> },
  ];

  const renderActiveRoom = () => {
    switch (activeRoom) {
      case "01": return <Room01_Lab />;
      case "02": return <Room02_BrainTrain />;
      case "03": return <Room03_Ghostwriter />;
      case "04": return <Room04_Booth />;
      case "05": return <Room05_VocalSuite />;
      case "06": return <Room06_Mastering />;
      case "07": return <Room07_Distribution />;
      case "08": return <Room08_Bank />;
      case "09": return <Room09_Radio />;
      case "10": return <Room10_Social />;
      default: return <div className="text-white p-10 font-mono text-xs opacity-50 uppercase">[Room {activeRoom} - Offline]</div>;
    }
  };

  const handleLogout = () => {
    clearMatrix();
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden selection:bg-[#E60000]">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-72 bg-black border-r border-[#111] flex flex-col z-20 shadow-2xl shrink-0">
        <div className="p-8 border-b border-[#111]">
          <h1 className="font-oswald text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">Bar-Code.ai</h1>
          {userSession && (
            <div className="mt-4 p-3 bg-[#050505] border border-[#222]">
              <p className="font-mono text-[9px] text-[#555] uppercase">Active Session:</p>
              <p className="font-mono text-[10px] text-green-500 truncate">{userSession.id}</p>
              <div className="flex justify-between items-end mt-1">
                <p className="font-mono text-[10px] text-[#E60000] uppercase font-bold tracking-widest">{userSession.tier}</p>
                <button onClick={handleLogout} className="text-[#555] hover:text-white transition-colors" title="Disconnect">
                  <LogOut size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1 mb-8">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={`w-full flex flex-col px-5 py-4 text-left transition-all rounded-lg group ${
                  activeRoom === room.id ? "bg-[#E60000] text-white shadow-[0_4px_15px_rgba(230,0,0,0.2)]" : "text-[#444] hover:bg-[#0a0a0a] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={activeRoom === room.id ? 'text-white' : 'text-[#888] group-hover:text-[#E60000]'}>{room.icon}</span>
                  <span className="font-oswald text-sm uppercase tracking-widest font-bold">R{room.id} - {room.name}</span>
                </div>
              </button>
            ))}
          </div>
          
          {/* ADMIN OVERRIDE LINK */}
          <div className="pt-4 border-t border-[#111]">
            <Link 
              href="/admin-node"
              className="w-full flex items-center gap-3 px-5 py-4 text-left text-yellow-600 hover:text-yellow-500 hover:bg-[#111] transition-all rounded-lg font-oswald text-sm uppercase tracking-widest font-bold"
            >
              <ShieldAlert size={16} /> Admin Node
            </Link>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
        {/* Subtle Background Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {/* Top Breadcrumb Bar */}
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-10 z-10 shrink-0">
           <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.4em]">
             Facility // Room {activeRoom} // {rooms.find(r => r.id === activeRoom)?.name.toUpperCase()}
           </span>
           <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-[#E60000] rounded-full animate-pulse" />
               <span className="text-[8px] text-[#E60000] uppercase font-bold tracking-widest">Active Matrix</span>
             </div>
           </div>
        </div>
        
        {/* Active Room Viewport */}
        <div className="flex-1 overflow-hidden relative z-10">
          <div className="h-full w-full overflow-y-auto custom-scrollbar p-6 lg:p-10">
            {renderActiveRoom()}
          </div>
        </div>
      </main>

    </div>
  );
}