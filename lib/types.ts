export type AccessTier = "Free Loader" | "The Artist" | "The Mogul";

export interface UserSession {
  id: string;
  tier: AccessTier;
  walletBalance: number;
  creditsRemaining: number | "UNLIMITED";
}

export interface AudioAnalysis {
  url: string;
  fileName: string;
  bpm: number;
  totalBars: number;
  grid?: number[];
}

export interface FlowDNA {
  tag: string;
  referenceText: string;
  syllableDensity: number;
}

export interface BlueprintSection {
  id: string;
  type: "INTRO" | "HOOK" | "VERSE" | "OUTRO" | "BRIDGE";
  bars: number;
}

export interface VocalStem {
  id: string;
  type: "Lead" | "Adlib" | "Double";
  url: string;
  blob?: Blob;
  volume: number; 
}

// NEW: Store the final master artifact
export interface FinalMaster {
  url: string;
  blob: Blob;
}