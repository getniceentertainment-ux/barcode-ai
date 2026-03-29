"use client";

import { useEffect } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function SecurityShield() {
  const addToast = useMatrixStore((state) => state.addToast);

  useEffect(() => {
    // --- THE TRIPWIRE EXPLOSION EFFECT ---
    const triggerTripwire = (message: string) => {
      addToast(message, "error");

      const flash = document.createElement("div");
      flash.style.position = "fixed";
      flash.style.top = "0";
      flash.style.left = "0";
      flash.style.width = "100vw";
      flash.style.height = "100vh";
      flash.style.backgroundColor = "rgba(230, 0, 0, 0.4)";
      flash.style.zIndex = "9999999";
      flash.style.pointerEvents = "none"; 
      flash.style.mixBlendMode = "color-dodge";
      flash.style.transition = "opacity 0.5s ease-out";
      
      document.body.appendChild(flash);

      // SURGICAL FIX FOR CHROME: Force browser to calculate layout 
      // before changing opacity, otherwise Chrome skips the animation entirely.
      void flash.offsetWidth; 
      
      flash.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(flash)) document.body.removeChild(flash);
      }, 500);
    };

    // 1. Block Right-Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Stop Chrome from bubbling the event
      triggerTripwire("SECURITY PROTOCOL: Unauthorized context inspection blocked.");
    };

    // 2. Block Common DevTool Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        (e.metaKey && e.altKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        (e.ctrlKey && ["U", "u"].includes(e.key)) ||
        (e.metaKey && ["U", "u"].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerTripwire("SECURITY PROTOCOL: Developer node access denied.");
      }
    };

    // SURGICAL FIX FOR CHROME: Attach to 'window' and use 'capture: true' 
    // to intercept the event BEFORE the browser native functions can run.
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [addToast]);

  return null;
}