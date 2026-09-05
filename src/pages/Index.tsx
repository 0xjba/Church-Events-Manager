import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';

const Index = () => {
  const { user, profile, loading, profileChecked, isAdmin, isJudge } = useAuth();

  // A signed-in user whose profile is still on its way waits here rather than
  // being bounced back to the login page; once the read has been attempted,
  // a missing profile falls through as before.
  if (loading || (user && !profile && !profileChecked)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <CircleNotch className="h-7 w-7 animate-spin text-primary" />
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
