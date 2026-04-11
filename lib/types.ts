export type AccessTier = "Free Loader" | "The Artist" | "The Mogul";

export interface UserSession {
  id: string;
  stageName: string;
  tier: AccessTier;
  walletBalance: number;
  creditsRemaining: number | "UNLIMITED";
  hasEngineeringToken?: boolean;   // SURGICAL FIX: Consolidated to camelCase to match store
}

export interface AudioAnalysis {
  url: string;
  fileName: string;
  bpm: number;
  totalBars: number;
  duration?: number; 
  grid?: number[];
  key?: string;
  dynamic_array?: number[]; // SURGICAL FIX: Explicit mapping for DSP Truth
  contour?: string;         // SURGICAL FIX: Explicit mapping for DSP Truth
}

export interface FlowDNA {
  tag: string;
  referenceText: string;
  syllableDensity: number;
}

export interface BlueprintSection {
  id: string;
  type: "INTRO" | "HOOK" | "VERSE" | "OUTRO" | "BRIDGE" | "INSTRUMENTAL";
  bars: number;
  startBar?: number;
  patternName?: string;
  patternDesc?: string;
  patternArray?: number[];
}

export interface VocalStem {
  id: string;
  type: "Lead" | "Adlib" | "Double" | "Guide" | string;
  url: string;
  blob?: Blob;
  volume: number; 
  offsetBars?: number;
  isMuted?: boolean; // <-- SURGICAL ADDITION: Global Mute Tracking
}

export interface FinalMaster {
  id: string;
  url: string;
  blob?: Blob;
}

export interface MixParams {
  leadVol: number;
  adlibVol: number;
  doubleVol: number;
  beatVol: number;
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compressorThresh: number;
  compressorRatio: number;
  reverbMix: number;
  reverbSize: number;
  delayMix: number;
  delayTime: number;
  chorusMix: number;
  masterLimiter: number;
}