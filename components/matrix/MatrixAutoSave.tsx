"use client";

import { useEffect } from 'react';
import { useMatrixStore } from '../../store/useMatrixStore';
import { supabase } from '../../lib/supabase';

export default function MatrixAutoSave() {
  const state = useMatrixStore();

  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

        // EXACT MATCH to Zustand state keys. 
        // Excludes vocalStems and finalMaster to prevent dead blob storage.
        const payload = {
          audioData: state.audioData,
          blueprint: state.blueprint,
          flowDNA: state.flowDNA,
          activeRoom: state.activeRoom,
          generatedLyrics: state.generatedLyrics,
          isProjectFinalized: state.isProjectFinalized
        };

        await supabase
          .from('matrix_sessions')
          .upsert({ 
            user_id: userId, 
            session_state: payload,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
          
      } catch (err) {
        console.error("Auto-Save matrix synchronization failed", err);
      }
    }, 30000); // 30-second strict interval

    return () => clearInterval(saveInterval);
  }, [
    state.userSession?.id, 
    state.audioData, 
    state.blueprint, 
    state.flowDNA, 
    state.activeRoom,
    state.generatedLyrics,
    state.isProjectFinalized
  ]);

  return null; // Invisible execution
}