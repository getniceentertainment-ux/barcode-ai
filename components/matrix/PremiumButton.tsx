"use client";

import React, { useState } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { Loader2, Lock } from "lucide-react";

interface PremiumButtonProps {
  cost: number;
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  isMogulOnly?: boolean;
}

export default function PremiumButton({ cost, onConfirm, children, className, isMogulOnly = false }: PremiumButtonProps) {
  const { spendCredit, userSession, setIsUpgrading, addToast } = useMatrixStore();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = async () => {
    // 1. Check if it's a Mogul-only feature
    if (isMogulOnly && userSession?.tier !== "The Mogul") {
      addToast("This feature is restricted to The Mogul tier.", "error");
      setIsUpgrading(true); // Pop the upgrade screen
      return;
    }

    // 2. Process the Credit Transaction
    setIsProcessing(true);
    const approved = await spendCredit(cost);
    
    // 3. If paid, execute the room's specific function
    if (approved) {
      await onConfirm();
    }
    setIsProcessing(false);
  };

  return (
    <button 
      onClick={handleClick} 
      disabled={isProcessing} 
      className={`relative transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isProcessing ? (
        <div className="flex items-center justify-center gap-2 w-full">
          <Loader2 className="animate-spin" size={18} /> Processing Ledger...
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full">
          {children}
          {isMogulOnly && userSession?.tier !== "The Mogul" && <Lock size={14} className="opacity-50" />}
        </div>
      )}
    </button>
  );
}