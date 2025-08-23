import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface ParticipantProtectedRouteProps {
  children: React.ReactNode;
}

const ParticipantProtectedRoute = ({ children }: ParticipantProtectedRouteProps) => {
  const { participant, loading } = useParticipantAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ParticipantProtectedRoute;