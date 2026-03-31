"use client";

import React, { useEffect } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";
import RoomDirectives from "../../components/matrix/RoomDirectives";

// Import your rooms
import Room01_Lab from "../components/matrix/Room01_Lab";
import Room02_BrainTrain from "../components/matrix/Room02_BrainTrain";
import Room03_Ghostwriter from "../components/matrix/Room03_Ghostwriter";
import Room04_Booth from "../components/matrix/Room04_Booth";
import Room05_VocalSuite from "../components/matrix/Room05_VocalSuite";
import Room06_Mastering from "../components/matrix/Room06_Mastering";
import Room07_Distribution from "../components/matrix/Room07_Distribution";
import Room08_Bank from "../components/matrix/Room08_Bank";
import Room09_Radio from "../components/matrix/Room09_Radio";
import Room10_Social from "../components/matrix/Room10_Social";
import Room11_Exec from "../components/matrix/Room11_Exec";

export default function StudioClient() {
  const { activeRoom, setActiveRoom, setAudioData, addToast } = useMatrixStore();

  // --- SURGICAL FIX: THE GLOBAL BEAT INTERCEPTOR ---
  // We place this here because StudioClient ALWAYS mounts when returning to /studio
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const beatPurchased = params.get('beat_purchased');
    const beatUrl = params.get('beat_url');

    if (beatPurchased === 'true' && beatUrl) {
      if (addToast) addToast("Beat License Acquired. Downloading to Lab...", "info");

      fetch(decodeURIComponent(beatUrl))
        .then(res => res.blob())
        .then(blob => {
          // 1. Inject the audio directly into the Matrix state
          setAudioData({
            url: URL.createObjectURL(blob),
            blob: blob,
            fileName: "Licensed_Marketplace_Beat.wav",
            duration: 0,
            bpm: 120,
            totalBars: 0
          });
          
          // 2. Teleport the user to Room 01
          setActiveRoom("01"); 
          if (addToast) addToast("Beat injected. Ready for DSP Analysis.", "success");

          // 3. Clean the URL so it doesn't re-download if the user refreshes the page
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(err => {
          console.error("Beat injection failed:", err);
          if (addToast) addToast("Failed to inject beat. Please download manually.", "error");
        });
    }
  }, [setActiveRoom, setAudioData, addToast]);

  const renderRoom = () => {
    switch (activeRoom) {
      case "01": return <Room01_Lab />;
      case "02": return <Room02_BrainTrain />;
      case "03": return <Room03_Ghostwriter />;
      case "04": return <Room04_Booth />;
      case "05": return <Room05_VocalSuite />;
      case "06": return <Room06_Mastering />;
      case "07": return <Room07_Distribution />;
      case "08": return <Room08_Bank />;
      case "09": return <Room09_Radio />;
      case "10": return <Room10_Social />;
      case "11": return <Room11_Exec />;
      default: return <div />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 md:p-8 overflow-y-auto custom-scrollbar">
      
      {/* The Universal Directive Header */}
      <RoomDirectives roomId={activeRoom} />

      {/* The Active Room Content */}
      <div className="flex-1 w-full">
        {renderRoom()}
      </div>
      
    </div>
  );
}