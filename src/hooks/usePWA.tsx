import { useState, useEffect } from 'react';
import { notificationService } from '@/utils/notifications';

interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// iOS fires no beforeinstallprompt and exposes no install API: the only route
// onto the home screen is the Share sheet, so the prompt has to tell people
// what to tap instead of offering a button.
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports itself as a Mac; a touch-capable one is an iPad.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<PWAInstallPrompt | null>(null);
  const [needsIosInstructions, setNeedsIosInstructions] = useState(false);

  useEffect(() => {
    // Initialize notifications
    notificationService.init();

    // Check if already installed (running as PWA)
    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                               // Safari's own standalone flag, which is not in lib.dom.
                               (window.navigator as Navigator & { standalone?: boolean }).standalone ||
                               document.referrer.includes('android-app://');
    
    setIsInstalled(isRunningStandalone);
    setNeedsIosInstructions(!isRunningStandalone && isIos());

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as PWAInstallPrompt);
      setIsInstallable(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Install failed:', error);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    needsIosInstructions,
    installApp
  };
}