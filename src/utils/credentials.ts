// Credential helpers.
//
// Passwords are hashed by the participant-auth edge function. The browser used
// to hash them with SHA-256 and a salt that shipped in the bundle, and wrote
// the result straight into a publicly readable table.

import { supabase } from '@/integrations/supabase/client';

export type CredentialUserType = 'participant' | 'judge';

export interface CredentialInput {
  user_type: CredentialUserType;
  user_id: string;
  password: string;
}

async function invokeSetPassword(body: Record<string, unknown>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your admin session has expired. Please sign in again.');

  const { data, error } = await supabase.functions.invoke('participant-auth/set-password', {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export function setPassword(
  userType: CredentialUserType,
  userId: string,
  password: string,
): Promise<void> {
  return invokeSetPassword({ user_type: userType, user_id: userId, password });
}

// Up to 500 per call, used by the bulk import.
export function setPasswords(credentials: CredentialInput[]): Promise<void> {
  return invokeSetPassword({ credentials });
}

export async function resetPassword(
  userType: CredentialUserType,
  username: string,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your admin session has expired. Please sign in again.');

  const { data, error } = await supabase.functions.invoke('participant-auth/reset', {
    body: { username, user_type: userType },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.new_password as string;
}
