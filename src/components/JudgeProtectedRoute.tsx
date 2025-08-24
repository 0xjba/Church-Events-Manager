import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface JudgeProtectedRouteProps {
  children: React.ReactNode;
}

const JudgeProtectedRoute = ({ children }: JudgeProtectedRouteProps) => {
  const { participant, loading, isAuthenticated } = useParticipantAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !participant) {
    return <Navigate to="/auth" replace />;
  }

  if (participant.role !== 'judge') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default JudgeProtectedRoute;
