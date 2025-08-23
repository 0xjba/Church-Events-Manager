import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ParticipantData {
  id: string;
  username: string;
  full_name: string;
  age: number;
  chest_number: string;
  category: 'children' | 'teens' | 'youth' | 'adults';
  church: string;
  district: string;
}

interface ParticipantAuthContextType {
  participant: ParticipantData | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: any }>;
  signOut: () => void;
  isAuthenticated: boolean;
}

const ParticipantAuthContext = createContext<ParticipantAuthContextType | undefined>(undefined);

export const useParticipantAuth = () => {
  const context = useContext(ParticipantAuthContext);
  if (context === undefined) {
    throw new Error('useParticipantAuth must be used within a ParticipantAuthProvider');
  }
  return context;
};

export const ParticipantAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('participant_token');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('participant-auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (error || !data?.valid) {
        localStorage.removeItem('participant_token');
        setParticipant(null);
      } else {
        setParticipant(data.participant);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('participant_token');
      setParticipant(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('participant-auth/login', {
        body: { username, password }
      });

      if (error || data?.error) {
        return { error: data?.error || error };
      }

      // Store token and participant data
      localStorage.setItem('participant_token', data.token);
      setParticipant(data.participant);
      
      return {};
    } catch (error) {
      console.error('Participant sign in failed:', error);
      return { error: 'Failed to sign in' };
    }
  };

  const signOut = () => {
    localStorage.removeItem('participant_token');
    setParticipant(null);
  };

  const value = {
    participant,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!participant,
  };

  return (
    <ParticipantAuthContext.Provider value={value}>
      {children}
    </ParticipantAuthContext.Provider>
  );
};