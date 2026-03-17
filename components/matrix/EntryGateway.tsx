"use client";

import React, { useState, useEffect } from "react";
import { Lock, Mail, Key, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function EntryGateway() {
  const { grantAccess, addToast } = useMatrixStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    // Auto-check if they just clicked the email link and have a session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        verifyAndGrantAccess(session);
      }
    };
    checkSession();
  }, []);

  const verifyAndGrantAccess = async (session: any) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('tier, credits')
        .eq('id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // If no profile exists yet, create the default Free Loader profile
      if (!profile) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: session.user.id,
          tier: 'Free Loader',
          credits: 5
        });
        if (insertError) throw insertError;
        
        grantAccess({ id: session.user.id, tier: 'Free Loader', walletBalance: 0 });
      } else {
        grantAccess({ id: session.user.id, tier: profile.tier, walletBalance: 0 });
      }
    } catch (error: any) {
      console.error("Profile Error:", error);
      if(addToast) addToast("Error syncing matrix profile.", "error");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setVerificationSent(false);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) await verifyAndGrantAccess(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;

        // THE FIX: If user is returned but session is null, it means email confirmation is required!
        if (data.user && !data.session) {
          setVerificationSent(true);
          if(addToast) addToast("Secure link dispatched to your inbox.", "success");
        } else if (data.session) {
          // Fallback just in case confirmation is turned off
          await verifyAndGrantAccess(data.session);
        }
      }
    } catch (error: any) {
      if(addToast) addToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white items-center justify-center p-6 selection:bg-[#E60000]">
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="bg-black border border-[#222] p-10 relative overflow-hidden shadow-[0_0_50px_rgba(230,0,0,0.1)]">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E60000] to-transparent opacity-50"></div>
          
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-[#110000] border border-[#E60000]/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(230,0,0,0.2)]">
              <Lock size={24} className="text-[#E60000]" />
            </div>
            <h1 className="font-oswald text-3xl uppercase tracking-[0.2em] font-bold text-white mb-2">Bar-Code.ai</h1>
            <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">A&R Neural Network Matrix</p>
          </div>

          {verificationSent ? (
            <div className="text-center py-6 animate-in zoom-in">
              <Mail size={48} className="mx-auto text-green-500 mb-6" />
              <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-3">Verify Identity</h2>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest leading-relaxed mb-8">
                A secure entry link has been dispatched to<br/><span className="text-white">{email}</span>
              </p>
              <button 
                onClick={() => setVerificationSent(false)}
                className="text-[10px] text-[#555] font-mono uppercase tracking-widest hover:text-white transition-colors"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input 
                    type="email" 
                    placeholder="OPERATOR EMAIL" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0a] border border-[#222] text-white py-4 pl-12 pr-4 font-mono text-xs tracking-widest focus:outline-none focus:border-[#E60000] transition-colors"
                  />
                </div>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input 
                    type="password" 
                    placeholder="ENCRYPTION KEY" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0a] border border-[#222] text-white py-4 pl-12 pr-4 font-mono text-xs tracking-widest focus:outline-none focus:border-[#E60000] transition-colors"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex justify-center items-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <>{isLogin ? "Initialize Session" : "Create Node"} <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {!verificationSent && (
            <div className="mt-8 text-center border-t border-[#111] pt-6">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-[10px] text-[#555] font-mono uppercase tracking-widest hover:text-[#E60000] transition-colors"
              >
                {isLogin ? "Request New Authorization Node" : "Existing Operator? Initialize Here"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}