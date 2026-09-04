import { create, verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const secret = Deno.env.get('JWT_SECRET');
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}

const KEY = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify'],
);

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export type CustomRole = 'participant' | 'judge';

export interface CustomClaims {
  sub: string;
  username: string;
  role: CustomRole;
  full_name?: string;
  exp: number;
}

export function issueToken(payload: Omit<CustomClaims, 'exp'>): Promise<string> {
  return create(
    { alg: 'HS256', typ: 'JWT' },
    { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS },
    KEY,
  );
}

export function bearer(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

// Verifies a token this system issued and confirms the account still exists and
// is active. Returns null for anything that does not check out.
export async function authenticateCustomUser(
  supabase: SupabaseClient,
  token: string | null,
  requiredRole?: CustomRole,
): Promise<{ claims: CustomClaims; record: Record<string, unknown> } | null> {
  if (!token) return null;

  let claims: CustomClaims;
  try {
    claims = await verify(token, KEY) as unknown as CustomClaims;
  } catch {
    return null;
  }

  if (!claims?.sub) return null;
  if (claims.role !== 'participant' && claims.role !== 'judge') return null;
  if (requiredRole && claims.role !== requiredRole) return null;

  const table = claims.role === 'judge' ? 'judges' : 'participants';
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', claims.sub)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return { claims, record: data };
}

// Confirms the caller holds a Supabase session whose profile row says admin.
// The previous code only checked that some user was signed in, so any account
// could create participants and reset passwords.
export async function requireAdmin(
  supabase: SupabaseClient,
  token: string | null,
): Promise<{ id: string } | null> {
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') return null;
  return { id: user.id };
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: {
    user_id?: string | null;
    actor_type: string;
    action: string;
    table_name: string;
    record_id?: string | null;
    new_values?: unknown;
  },
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: entry.user_id ?? null,
    actor_type: entry.actor_type,
    action: entry.action,
    table_name: entry.table_name,
    record_id: entry.record_id ?? null,
    new_values: entry.new_values ?? null,
  });
  if (error) console.error('audit log write failed:', error.message);
}
