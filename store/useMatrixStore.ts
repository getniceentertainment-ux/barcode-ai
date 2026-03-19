import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';
import { supabase } from '../lib/supabase';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface MatrixState {
  hasAccess: boolean;
  activeRoom: string;
  userSession: UserSession | null;
  activeProjectId: string | null;
  isProjectFinalized: boolean;

  // 💳 TRANSACTION ENGINE
  spendCredit: (amount?: number) => Promise<boolean>;
  spendMasteringToken: () => Promise<boolean>;

  // RADIO PLAYER STATE
  playbackMode: 'session' | 'radio';
  radioTrack: { url: string; title: string; artist: string; score: number } | null;
  setPlaybackMode: (mode: 'session' | 'radio') => void;
  setRadioTrack: (track: { url: string; title: string; artist: string; score: number } | null) => void;
  
  // MDX NEURAL STATUS
  mdxJobId: string | null;
  setMdxJobId: (id: string | null) => void;
  mdxStatus: "idle" | "processing" | "success" | "failed";
  setMdxStatus: (status: "idle" | "processing" | "success" | "failed") => void;

  grantAccess: (session: UserSession) => void;
  setActiveRoom: (roomId: string) => void;
  setActiveProject: (id: string | null, isFinalized: boolean) => void;

  // 🛡️ PROTECTED SETTERS
  audioData: AudioAnalysis | null;
  setAudioData: (data: AudioAnalysis) => Promise<void>;
  flowDNA: FlowDNA | null;
  setFlowDNA: (dna: FlowDNA) => Promise<void>;
  generatedLyrics: string | null;
  setGeneratedLyrics: (lyrics: string) => Promise<void>;

  // STANDARD SETTERS
  gwTitle: string;
  gwPrompt: string;
  gwStyle: string;
  gwGender: string;
  gwUseSlang: boolean;
  gwUseIntel: boolean;
  setGwTitle: (t: string) => void;
  setGwPrompt: (p: string) => void;
  setGwStyle: (s: string) => void;
  setGwGender: (g: string) => void;
  setGwUseSlang: (b: boolean) => void;
  setGwUseIntel: (b: boolean) => void;

  blueprint: BlueprintSection[];
  setBlueprint: (blueprint: BlueprintSection[]) => void;

  vocalStems: VocalStem[];
  addVocalStem: (stem: VocalStem) => void;
  removeVocalStem: (id: string) => void;
  updateStemVolume: (id: string, volume: number) => void;
  updateStemOffset: (id: string, offsetBars: number) => void;

  finalMaster: FinalMaster | null;
  setFinalMaster: (master: FinalMaster | null) => void;

  toasts: ToastMessage[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  clearMatrix: () => void;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      hasAccess: false,
      activeRoom: "01",
      userSession: null,
      activeProjectId: null,
      isProjectFinalized: false,
      playbackMode: 'session',
      radioTrack: null,
      mdxJobId: null,
      mdxStatus: "idle",
      audioData: null,
      flowDNA: null,
      gwTitle: "",
      gwPrompt: "",
      gwStyle: "getnice_hybrid",
      gwGender: "male",
      gwUseSlang: true,
      gwUseIntel: true,
      blueprint: [],
      generatedLyrics: null,
      vocalStems: [],
      finalMaster: null,
      toasts: [],

      // --- 🏦 THE BANKER (Private Logic) ---
      spendCredit: async (amount = 1) => {
        const session = get().userSession;
        if (!session) return false;
        if (session.tier === "The Mogul") return true;

        const currentCredits = Number(session.creditsRemaining);
        if (currentCredits < amount) {
          get().addToast("Insufficient Credits. Visit Room 08.", "error");
          return false;
        }

        const newBalance = currentCredits - amount;

        try {
          const { error } = await supabase
            .from('profiles')
            .update({ credits: newBalance })
            .eq('id', session.id);

          if (error) throw error;
          set({ userSession: { ...session, creditsRemaining: newBalance } });
          get().addToast(`Matrix Resource Accessed. -${amount} CRD`, "info");
          return true;
        } catch (err) {
          get().addToast("Accounting Link Failed.", "error");
          return false;
        }
      },

      // --- 📀 MASTERING TOKEN HANDLER ---
      spendMasteringToken: async () => {
        const state = get();
        const session = state.userSession;
        if (!session) return false;
        
        // 🎖️ The Mogul Exception (Included in Tier)
        if (session.tier === "The Mogul") return true;

        try {
          // 🔥 REAL-TIME DB CHECK: Verify total from source of truth
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('mastering_tokens')
            .eq('id', session.id)
            .single();

          if (fetchError || !profile || (profile.mastering_tokens || 0) < 1) {
            state.addToast?.("Mastering Token Required ($4.99).", "error");
            return false;
          }

          // 🌪️ ATOMIC BURN: Subtract token before allowing the render
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ mastering_tokens: profile.mastering_tokens - 1 })
            .eq('id', session.id);

          if (updateError) throw updateError;
          
          return true;
        } catch (err) {
          console.error("Ledger Transaction Failure:", err);
          return false;
        }
      },

      // --- 🛡️ PROTECTED SETTERS ---
      setAudioData: async (data) => {
        const success = await get().spendCredit(1);
        if (success) set({ audioData: data });
      },
      setFlowDNA: async (dna) => {
        const success = await get().spendCredit(1);
        if (success) set({ flowDNA: dna });
      },
      setGeneratedLyrics: async (lyrics) => {
        const success = await get().spendCredit(1);
        if (success) set({ generatedLyrics: lyrics });
      },

      // --- STANDARD LOGIC ---
      setPlaybackMode: (mode) => set({ playbackMode: mode }),
      setRadioTrack: (track) => set({ radioTrack: track }),
      setMdxJobId: (id) => set({ mdxJobId: id }),
      setMdxStatus: (status) => set({ mdxStatus: status }),
      grantAccess: (session) => set({ hasAccess: true, userSession: session }),
      setActiveRoom: (roomId) => set({ activeRoom: roomId }),
      setActiveProject: (id, isFinalized) => set({ activeProjectId: id, isProjectFinalized: isFinalized }),
      
      setGwTitle: (t) => set({ gwTitle: t }),
      setGwPrompt: (p) => set({ gwPrompt: p }),
      setGwStyle: (s) => set({ gwStyle: s }),
      setGwGender: (g) => set({ gwGender: g }),
      setGwUseSlang: (b) => set({ gwUseSlang: b }),
      setGwUseIntel: (b) => set({ gwUseIntel: b }),
      setBlueprint: (blueprint) => set({ blueprint }),
      
      addVocalStem: (stem) => set((state) => ({ vocalStems: [...state.vocalStems, stem] })),
      removeVocalStem: (id) => set((state) => ({ vocalStems: state.vocalStems.filter(s => s.id !== id) })),
      updateStemVolume: (id, volume) => set((state) => ({
        vocalStems: state.vocalStems.map(s => s.id === id ? { ...s, volume } : s)
      })),
      updateStemOffset: (id, offsetBars) => set((state) => ({
        vocalStems: state.vocalStems.map(s => s.id === id ? { ...s, offsetBars } : s)
      })),

      setFinalMaster: (master) => set({ finalMaster: master }),
      addToast: (message, type) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => set((state) => ({ toasts: get().toasts.filter(t => t.id !== id) })), 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      clearMatrix: () => set({
        audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01",
        gwTitle: "", gwPrompt: "", gwStyle: "getnice_hybrid", activeProjectId: null, isProjectFinalized: false, finalMaster: null,
        userSession: null, hasAccess: false, playbackMode: 'session', radioTrack: null, mdxJobId: null, mdxStatus: "idle"
      })
    }),
    {
      name: 'barcode-matrix-storage', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        audioData: state.audioData, 
        flowDNA: state.flowDNA,
        blueprint: state.blueprint, 
        generatedLyrics: state.generatedLyrics,
        gwTitle: state.gwTitle,
        gwPrompt: state.gwPrompt,
        gwStyle: state.gwStyle,
        vocalStems: state.vocalStems,
        playbackMode: state.playbackMode,
        radioTrack: state.radioTrack,
        activeProjectId: state.activeProjectId,
        isProjectFinalized: state.isProjectFinalized,
        userSession: state.userSession 
      }),
    }
  )
);