"use client";

// SURGICAL FIX: Added an extra '../' to properly reach the store folder
import { useMatrixStore } from "../../store/useMatrixStore";
import { Loader2, CheckCircle2, AlertTriangle, Cloud } from "lucide-react";

export default function GlobalSyncIndicator() {
  const { syncStatus } = useMatrixStore();

  if (syncStatus === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#0a0a0a] border border-[#222] px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
      {syncStatus === "saving" && (
        <>
          <Loader2 size={14} className="text-[#E60000] animate-spin" />
          <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Securing Matrix...</span>
        </>
      )}
      {syncStatus === "saved" && (
        <>
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-[10px] font-mono text-green-500 uppercase tracking-widest">Ledger Synced</span>
        </>
      )}
      {syncStatus === "error" && (
        <>
          <AlertTriangle size={14} className="text-yellow-500" />
          <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest">Sync Failed</span>
        </>
      )}
    </div>
  );
}