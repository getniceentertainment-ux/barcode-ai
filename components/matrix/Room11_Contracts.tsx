"use client";

import React, { useState, useEffect } from "react";
import { FileAudio, CheckCircle, XCircle, UploadCloud, Play, Loader2, ShieldCheck, DollarSign } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

interface Contract {
  id: string;
  buyer_id: string;
  seller_id: string;
  seller_stage_name: string;
  amount: number;
  type: string;
  status: "PENDING" | "DELIVERED" | "APPROVED" | "REJECTED";
  deliverable_url: string | null;
  created_at: string;
}

export default function Room11_Contracts() {
  const { userSession, addToast, syncLedger } = useMatrixStore();
  
  const [activeView, setActiveView] = useState<"hires" | "gigs">("gigs");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
  }, [activeView, userSession]);

  const fetchContracts = async () => {
    if (!userSession?.id) return;
    setIsLoading(true);
    
    try {
      const column = activeView === "hires" ? "buyer_id" : "seller_id";
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq(column, userSession.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts(data || []);
    } catch (err) {
      console.error("Failed to load contracts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- SELLER ACTION: Deliver the Audio ---
  const handleFulfillContract = async (contractId: string) => {
    setProcessingId(contractId);
    try {
      // In production, you would use Supabase Storage to upload the actual file here.
      // For this matrix, we mock the secure URL delivery.
      const mockAudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      
      const { error } = await supabase
        .from('contracts')
        .update({ status: 'DELIVERED', deliverable_url: mockAudioUrl })
        .eq('id', contractId);

      if (error) throw error;
      if (addToast) addToast("Artifact delivered to buyer for review.", "success");
      fetchContracts();
    } catch (err) {
      if (addToast) addToast("Failed to upload deliverable.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  // --- BUYER ACTION: Approve & Release Payout ---
  const handleApproveContract = async (contract: Contract) => {
    setProcessingId(contract.id);
    try {
      // 1. Mark contract as APPROVED
      const { error: contractErr } = await supabase
        .from('contracts')
        .update({ status: 'APPROVED' })
        .eq('id', contract.id);
      
      if (contractErr) throw contractErr;

      // 2. Fetch the Seller's current wallet balance
      const { data: sellerData } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', contract.seller_id)
        .single();

      // 3. Inject the Escrowed funds into the Seller's fiat wallet
      const newBalance = (sellerData?.wallet_balance || 0) + contract.amount;
      await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', contract.seller_id);

      // 4. Create payout receipt
      await supabase.from('transactions').insert({
        user_id: contract.seller_id,
        amount: contract.amount,
        type: 'GIG_PAYOUT_CLEARED',
        description: `Cleared Payout: ${contract.type.toUpperCase()} from Client`
      });

      if (addToast) addToast(`Funds released! $${contract.amount} transferred to artist.`, "success");
      fetchContracts();
      syncLedger(); // Update buyer's local UI state
      
    } catch (err) {
      console.error(err);
      if (addToast) addToast("Failed to release funds.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto p-4 lg:p-8 animate-in fade-in duration-500">
      
      <div className="flex items-end justify-between border-b border-[#222] pb-6 mb-8">
        <div>
          <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
            <ShieldCheck size={36} className="text-[#E60000]" /> Active Contracts
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            Escrow Delivery & Fiat Clearance
          </p>
        </div>
        
        <div className="flex bg-black border border-[#222]">
          <button 
            onClick={() => setActiveView("gigs")}
            className={`px-6 py-3 font-oswald text-sm uppercase tracking-widest font-bold transition-colors ${activeView === 'gigs' ? 'bg-[#E60000] text-white' : 'text-[#555] hover:text-white'}`}
          >
            My Gigs (Seller)
          </button>
          <button 
            onClick={() => setActiveView("hires")}
            className={`px-6 py-3 font-oswald text-sm uppercase tracking-widest font-bold transition-colors ${activeView === 'hires' ? 'bg-[#E60000] text-white' : 'text-[#555] hover:text-white'}`}
          >
            My Hires (Buyer)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
        {isLoading ? (
           <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#E60000]" size={40} /></div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50 border border-dashed border-[#222] bg-[#050505]">
            <FileAudio size={48} className="text-[#333] mb-4" />
            <p className="font-oswald text-xl uppercase tracking-widest text-[#555]">No Active Contracts</p>
          </div>
        ) : (
          contracts.map((contract) => (
            <div key={contract.id} className="bg-[#050505] border border-[#222] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-[#E60000]/50 transition-all">
              
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-widest border 
                    ${contract.status === 'APPROVED' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 
                      contract.status === 'DELIVERED' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 
                      'bg-[#111] text-[#888] border-[#333]'}`}>
                    {contract.status}
                  </span>
                  <span className="font-mono text-[10px] text-[#555] uppercase">{new Date(contract.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">
                  {contract.type} Request
                </h3>
                <p className="font-mono text-[10px] text-[#888] uppercase mt-1">
                  {activeView === "hires" ? `Artist: ${contract.seller_stage_name}` : `Client ID: ${contract.buyer_id.substring(0,8)}`}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-1">Escrow Payout</p>
                  <p className="font-oswald text-2xl font-bold text-white flex items-center gap-1 justify-end">
                    <DollarSign size={18} className="text-green-500" />{contract.amount.toFixed(2)}
                  </p>
                </div>

                <div className="w-px h-12 bg-[#222] hidden md:block"></div>

                <div className="w-full md:w-48 shrink-0">
                  {/* SELLER LOGIC */}
                  {activeView === "gigs" && contract.status === "PENDING" && (
                    <button 
                      onClick={() => handleFulfillContract(contract.id)}
                      disabled={processingId === contract.id}
                      className="w-full bg-white text-black py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      {processingId === contract.id ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Upload Verse
                    </button>
                  )}
                  {activeView === "gigs" && contract.status === "DELIVERED" && (
                    <div className="text-center font-mono text-[10px] text-yellow-500 uppercase tracking-widest border border-yellow-500/30 bg-yellow-500/10 py-3">Awaiting Client Approval</div>
                  )}

                  {/* BUYER LOGIC */}
                  {activeView === "hires" && contract.status === "DELIVERED" && (
                    <div className="flex flex-col gap-2">
                      <a href={contract.deliverable_url || "#"} target="_blank" className="w-full border border-[#333] text-white py-2 font-oswald text-xs font-bold uppercase tracking-widest hover:bg-[#111] transition-all flex items-center justify-center gap-2">
                        <Play size={12} /> Play Artifact
                      </a>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApproveContract(contract)}
                          disabled={processingId === contract.id}
                          className="flex-1 bg-green-600 text-white py-2 font-oswald text-xs font-bold uppercase hover:bg-green-500 transition-all flex justify-center items-center"
                        >
                          {processingId === contract.id ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle size={14}/>} Approve
                        </button>
                        <button className="flex-1 bg-black border border-[#333] text-[#888] py-2 font-oswald text-xs font-bold uppercase hover:text-[#E60000] hover:border-[#E60000] transition-all flex justify-center items-center">
                          <XCircle size={14}/> Reject
                        </button>
                      </div>
                    </div>
                  )}
                  {activeView === "hires" && contract.status === "PENDING" && (
                     <div className="text-center font-mono text-[10px] text-[#555] uppercase tracking-widest border border-[#222] bg-[#111] py-3">Awaiting Artist Delivery</div>
                  )}

                  {/* RESOLVED LOGIC */}
                  {contract.status === "APPROVED" && (
                     <div className="text-center font-mono text-[10px] text-green-500 uppercase tracking-widest flex items-center justify-center gap-2 py-3">
                       <ShieldCheck size={14} /> Contract Resolved
                     </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}