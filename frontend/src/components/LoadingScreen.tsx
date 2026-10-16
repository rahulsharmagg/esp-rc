import React, { useState, useEffect } from 'react';

declare const __APP_VERSION__: string | undefined;

// Session-level flag to guarantee the splash screen plays exactly once per browser tab session
let hasLoadedInSession = false;

export const LoadingScreen: React.FC = () => {
  const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'v4.0.0';

  // If already loaded previously during this tab session, start immediately ready and bypass
  const [alreadyLoaded] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('esp_app_loaded');
      if (stored === 'true' || hasLoadedInSession) {
        return true;
      }
    }
    return false;
  });

  const [progress, setProgress] = useState(alreadyLoaded ? 100 : 0);
  const [isReady, setIsReady] = useState(alreadyLoaded);
  const [statusText, setStatusText] = useState(
    alreadyLoaded ? `ALL SYSTEMS ONLINE (${APP_VERSION})` : 'INITIALIZING AVIONICS HARDWARE...'
  );

  const INIT_STEPS = [
    {
      label: 'CHECKING BLUETOOTH & SECURE CONTEXT...',
      targetPct: 25,
      delayMs: 300,
      run: async () => {
        const hasBle = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
        const isSecure = typeof window !== 'undefined' && window.isSecureContext;
        return hasBle && isSecure;
      }
    },
    {
      label: 'LOADING HIGH-CONTRAST FONTS & ASSETS...',
      targetPct: 50,
      delayMs: 300,
      run: async () => {
        if (typeof document !== 'undefined' && 'fonts' in document) {
          try {
            await document.fonts.ready;
          } catch {}
        }
        return true;
      }
    },
    {
      label: 'CALIBRATING TOUCH ENGINE & CONTROLS...',
      targetPct: 75,
      delayMs: 300,
      run: async () => {
        return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
      }
    },
    {
      label: 'INITIALIZING RADAR HUD & GPU ENGINE...',
      targetPct: 90,
      delayMs: 300,
      run: async () => {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('2d');
      }
    },
    {
      label: 'AVIONICS READY • COCKPIT ONLINE',
      targetPct: 100,
      delayMs: 250,
      run: async () => true
    }
  ];

  useEffect(() => {
    if (alreadyLoaded) return;

    let cancelled = false;

    async function executeInitSequence() {
      for (const step of INIT_STEPS) {
        if (cancelled) break;
        setStatusText(step.label);
        try {
          await step.run();
        } catch {}

        setProgress(step.targetPct);
        await new Promise((resolve) => setTimeout(resolve, step.delayMs));
      }

      if (!cancelled) {
        setProgress(100);
        setStatusText(`ALL SYSTEMS ONLINE (${APP_VERSION})`);
        hasLoadedInSession = true;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('esp_app_loaded', 'true');
        }
        setTimeout(() => {
          setIsReady(true);
        }, 200);
      }
    }

    executeInitSequence();

    return () => {
      cancelled = true;
    };
  }, [alreadyLoaded, APP_VERSION]);

  if (alreadyLoaded) {
    return null;
  }

  return (
    <div className={`loading-screen ${isReady ? 'hidden' : ''}`}>
      <div className="loading-card">
        <div className="loading-logo-box">
          <img src="/assets/logo.svg" alt="ESP-RC Logo" className="loading-icon" />
          <div className="logo-pulse-ring"></div>
        </div>

        <h1 className="loading-title">ESP-RC</h1>
        <span className="loading-subtitle">HIGH PERFORMANCE COCKPIT • {APP_VERSION}</span>

        <div className="loading-bar-wrap">
          <div className="loading-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="loading-status-row">
          <span className="loading-status-text">{statusText}</span>
          <span className="loading-pct-text">{progress}%</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
