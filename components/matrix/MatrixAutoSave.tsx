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

  // --- THE CLOUD SYNC ENGINE (Bypass Mode) ---
  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

        // 1. WAKE UP THE UI (Show the loading spinner)
        state.setSyncStatus("saving");

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

        // SURGICAL FIX: The Upsert Bypass
        const { data: existingSession } = await supabase
          .from('matrix_sessions')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingSession) {
          const { error: updateError } = await supabase
            .from('matrix_sessions')
            .update({ 
              session_state: payload, 
              updated_at: new Date().toISOString() 
            })
            .eq('user_id', userId);
            
          if (updateError) throw new Error(updateError.message);
          
        } else {
          const { error: insertError } = await supabase
            .from('matrix_sessions')
            .insert([{ 
              user_id: userId, 
              session_state: payload 
            }]);
            
          if (insertError) throw new Error(insertError.message);
        }

        // 2. SHOW SUCCESS UI (Turn green, hide after 3 seconds)
        state.setSyncStatus("saved");
        setTimeout(() => state.setSyncStatus("idle"), 3000);
          
      } catch (err) {
        console.error("Auto-Save matrix synchronization failed", err);
        
        // 3. SHOW ERROR UI (Turn yellow if the save fails)
        state.setSyncStatus("error");
        setTimeout(() => state.setSyncStatus("idle"), 5000);
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
    state.mixParams,
    state.setSyncStatus
  ]);

  return null; 
}