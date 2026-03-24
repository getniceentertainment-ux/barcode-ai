"use client";

import { useEffect } from 'react';
import { useMatrixStore } from '../../store/useMatrixStore';
import { supabase } from '../../lib/supabase';

export default function MatrixAutoSave() {
  const state = useMatrixStore();

  // --- THE HYDRATION ENGINE ---
  useEffect(() => {
    const bootMatrix = async () => {
      await state.hydrateDiskAudio();
    };
    bootMatrix();
  }, []);

  // --- THE CLOUD SYNC ENGINE ---
  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

        // CRITICAL: We strip out audioData, vocalStems, and finalMaster.
        // Supabase will throw a 400 Bad Request if you try to save an audio Blob as JSON.
        const payload = {
          blueprint: state.blueprint,
          flowDNA: state.flowDNA,
          activeRoom: state.activeRoom,
          generatedLyrics: state.generatedLyrics,
          isProjectFinalized: state.isProjectFinalized,
          anrData: state.anrData,
          mixParams: state.mixParams,
          gwTitle: state.gwTitle,
          gwPrompt: state.gwPrompt,
          gwStyle: state.gwStyle
        };

        // SURGICAL FIX: We removed { onConflict: 'user_id' } 
        // Supabase natively detects the Primary Key. Forcing it causes the 400 crash.
        const { error } = await supabase
          .from('matrix_sessions')
          .upsert({ 
            user_id: userId, 
            session_state: payload,
            updated_at: new Date().toISOString()
          });
          
        if (error) {
          console.error("Supabase Save Error:", error.message);
        }
          
      } catch (err) {
        console.error("Auto-Save matrix synchronization failed", err);
      }
    }, 30000); // 30-second interval

    return () => clearInterval(saveInterval);
  }, [
    state.userSession?.id, 
    state.blueprint, 
    state.flowDNA, 
    state.activeRoom,
    state.generatedLyrics,
    state.isProjectFinalized,
    state.anrData,
    state.mixParams
  ]);

  return null; 
}