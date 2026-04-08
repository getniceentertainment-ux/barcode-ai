export type AccessTier = "Free Loader" | "The Artist" | "The Mogul";

export interface UserSession {
  id: string;
  stageName: string;
  tier: AccessTier;
  walletBalance: number;
  creditsRemaining: number | "UNLIMITED";
}

export interface AudioAnalysis {
  url: string;
  fileName: string;
  bpm: number;
  totalBars: number;
  duration?: number; 
  grid?: number[];
  key?: string;
  dynamic_array?: number[]; // THEMATIC ENERGY ARRAY
  contour?: string;         // PITCH DIRECTION
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
  type: "Lead" | "Adlib" | "Double" | "Guide";
  url: string;
  blob?: Blob;
  volume: number; 
  offsetBars: number;
}

export interface FinalMaster {
  url: string;
  blob: Blob;
}