import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function NetworkStatus() {
  const { isOnline, syncStatus, unsyncedCount } = useOfflineSync();

  if (isOnline && syncStatus === 'idle' && unsyncedCount === 0) {
    return null; // Don't show when everything is normal
  }

  return (
    <div className="flex items-center space-x-2">
      {!isOnline && (
        <Badge variant="destructive" className="flex items-center space-x-1">
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </Badge>
      )}
      
      {syncStatus === 'syncing' && (
        <Badge variant="outline" className="flex items-center space-x-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Syncing...</span>
        </Badge>
      )}

      {unsyncedCount > 0 && (
        <Badge variant="outline" className="flex items-center space-x-1">
          <Wifi className="h-3 w-3" />
          <span>{unsyncedCount} pending</span>
        </Badge>
      )}
    </div>
  );
}