import { useEffect, useState } from 'react';
import { DownloadSimple, Export, X } from '@phosphor-icons/react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/primitives';

export function PWAInstallPrompt() {
  const { isInstallable, installApp, isInstalled, needsIosInstructions } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('pwa-install-dismissed')) setDismissed(true);
  }, []);

  if (isInstalled || dismissed) return null;
  if (!isInstallable && !needsIosInstructions) return null;

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/25 bg-primary-soft p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {needsIosInstructions ? <Export size={16} /> : <DownloadSimple size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-foreground">Add PYPA to your home screen</p>
        <p className="text-caption text-muted-foreground">
          {needsIosInstructions
            ? 'Tap Share, then "Add to Home Screen".'
            : 'Faster to open, and it keeps working on a bad signal.'}
        </p>
      </div>
      {!needsIosInstructions && (
        <Button
          size="sm"
          onClick={async () => {
            const installed = await installApp();
            if (installed) setDismissed(true);
          }}
        >
          Install
        </Button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface"
      >
        <X size={16} />
      </button>
    </div>
  );
}
