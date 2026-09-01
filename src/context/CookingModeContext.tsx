"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type CookingModeContextType = {
  isCookingMode: boolean;
  toggleCookingMode: () => void;
};

const CookingModeContext = createContext<CookingModeContextType | undefined>(undefined);

export const CookingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCookingMode, setIsCookingMode] = useState(false);
  const [wakeLock, setWakeLock] = useState<any>(null);

  useEffect(() => {
    // Load state from localStorage
    const saved = localStorage.getItem('isCookingMode');
    if (saved === 'true') {
      setIsCookingMode(true);
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        setWakeLock(lock);
        console.log('Wake Lock is active');
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      console.log('Wake Lock released');
    }
  }, [wakeLock]);

  useEffect(() => {
    if (isCookingMode) {
      document.body.classList.add('cooking-mode');
      localStorage.setItem('isCookingMode', 'true');
      requestWakeLock();
    } else {
      document.body.classList.remove('cooking-mode');
      localStorage.setItem('isCookingMode', 'false');
      releaseWakeLock();
    }
  }, [isCookingMode, requestWakeLock, releaseWakeLock]);

  // Handle visibility change to re-request wake lock
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (isCookingMode && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isCookingMode, requestWakeLock]);

  const toggleCookingMode = () => {
    setIsCookingMode(prev => !prev);
  };

  return (
    <CookingModeContext.Provider value={{ isCookingMode, toggleCookingMode }}>
      {children}
    </CookingModeContext.Provider>
  );
};

export const useCookingMode = () => {
  const context = useContext(CookingModeContext);
  if (context === undefined) {
    throw new Error('useCookingMode must be used within a CookingModeProvider');
  }
  return context;
};
