import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, profile, loading, isAdmin, isJudge, isParticipant } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
  
  if (isParticipant) {
    return <Navigate to="/participant" replace />;
  }

  return <Navigate to="/auth" replace />;
};

export default Index;
