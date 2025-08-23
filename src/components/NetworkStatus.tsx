import { useState, useEffect } from 'react';
import { Badge, Space } from 'antd';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function NetworkStatus() {
  const { isOnline, syncStatus, unsyncedCount } = useOfflineSync();

  if (isOnline && syncStatus === 'idle' && unsyncedCount === 0) {
    return null; // Don't show when everything is normal
  }

  return (
    <Space>
      {!isOnline && (
        <Badge
          color="red"
          text={
            <Space size={4}>
              <WifiOff size={12} />
              <span>Offline</span>
            </Space>
          }
        />
      )}
      
      {syncStatus === 'syncing' && (
        <Badge
          color="blue"
          text={
            <Space size={4}>
              <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Syncing...</span>
            </Space>
          }
        />
      )}

      {unsyncedCount > 0 && (
        <Badge
          color="orange"
          text={
            <Space size={4}>
              <Wifi size={12} />
              <span>{unsyncedCount} pending</span>
            </Space>
          }
        />
      )}
    </Space>
  );
}