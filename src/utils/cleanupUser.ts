import { supabase } from '@/integrations/supabase/client';

export const cleanupCorruptedUser = async (userId: string) => {
  try {
    console.log('🧹 Attempting to cleanup corrupted user:', userId);
    
    // Try to call the edge function to delete the user
    const { data, error } = await supabase.functions.invoke('cleanup-user', {
      body: { userId }
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw error;
    }

    console.log('✅ User cleanup successful:', data);
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return { success: false, error };
  }
};

// Temporary function to call from browser console
(window as any).cleanupUser = () => {
  cleanupCorruptedUser('abbcc480-3ab6-4c7f-87f2-65f211b92c4b');
};