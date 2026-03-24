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

  // --- THE SILENT CLOUD SYNC ENGINE ---
  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

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

        const { data: existingSession } = await supabase
          .from('matrix_sessions')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingSession) {
          await supabase.from('matrix_sessions').update({ 
            session_state: payload, 
            updated_at: new Date().toISOString() 
          }).eq('user_id', userId);
        } else {
          await supabase.from('matrix_sessions').insert([{ 
            user_id: userId, 
            session_state: payload 
          }]);
        }
          
      } catch (err) {
        console.error("Silent auto-save failed", err);
      }
    }, 30000); // 30-second invisible interval

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