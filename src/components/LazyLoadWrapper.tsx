import { Suspense, ReactNode } from 'react';
import { Skeleton } from 'antd';

interface LazyLoadWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function LazyLoadWrapper({ children, fallback }: LazyLoadWrapperProps) {
  const defaultFallback = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Skeleton.Button active style={{ height: '32px', width: '100%' }} />
      <Skeleton active paragraph={{ rows: 4 }} />
      <Skeleton active paragraph={{ rows: 2 }} />
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}