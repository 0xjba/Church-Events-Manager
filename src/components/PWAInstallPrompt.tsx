import { useState, useEffect } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { Download, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

const { Title, Text } = Typography;

export function PWAInstallPrompt() {
  const { isInstallable, installApp, isInstalled } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this session
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setDismissed(true);
    }
  };

  // Don't show if already installed, not installable, or dismissed
  if (!isInstallable || isInstalled || dismissed) {
    return null;
  }

  return (
    <Card 
      style={{ 
        marginBottom: '24px', 
        borderColor: '#8b5cf6', 
        backgroundColor: '#f3f0ff' 
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <Space>
          <Download size={20} color="#8b5cf6" />
          <Title level={4} style={{ margin: 0 }}>Install App</Title>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<X size={16} />}
          onClick={handleDismiss}
        />
      </div>
      <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
        Install Devotional Events Pro for offline access and better performance
      </Text>
      <Space>
        <Button type="primary" onClick={handleInstall} icon={<Download size={16} />}>
          Install Now
        </Button>
        <Button onClick={handleDismiss}>
          Later
        </Button>
      </Space>
    </Card>
  );
}