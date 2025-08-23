import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';

const Index = () => {
  const { user, profile, loading, isAdmin, isJudge } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to role-specific dashboard
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  
  if (isJudge) {
    return <Navigate to="/judge" replace />;
  }

  return <Navigate to="/auth" replace />;
};

export default Index;
