import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { generatePassword, hashPassword, verifyPassword } from '../_shared/password.ts';
import { authenticateCustomUser, bearer, issueToken, requireAdmin, writeAuditLog } from '../_shared/auth.ts';
import { clientKey, rateLimit } from '../_shared/rateLimit.ts';

// Service role client: the credentials table is unreachable for anon and
// authenticated, so every credential read and write happens here.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const INVALID_CREDENTIALS = 'Invalid credentials';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const action = new URL(req.url).pathname.split('/').pop();

    switch (action) {
      case 'login':
        return await handleLogin(req);
      case 'verify':
        return await handleVerify(req);
      case 'set-password':
        return await handleSetPassword(req);
      case 'reset':
        return await handleReset(req);
      default:
        return json(req, { error: 'Invalid action' }, 400);
    }
  } catch (error) {
    // Never echo the internal error back to the client.
    console.error('participant-auth failure:', error);
    return json(req, { error: 'Something went wrong' }, 500);
  }
});

async function getCredential(userType: 'participant' | 'judge', userId: string) {
  const { data } = await supabase
    .from('user_credentials')
    .select('password_hash')
    .eq('user_type', userType)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.password_hash ?? null;
}

async function storeCredential(userType: 'participant' | 'judge', userId: string, password: string) {
  const password_hash = await hashPassword(password);
  const { error } = await supabase
    .from('user_credentials')
    .upsert(
      { user_type: userType, user_id: userId, password_hash, updated_at: new Date().toISOString() },
      { onConflict: 'user_type,user_id' },
    );
  if (error) throw error;
}

async function handleLogin(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return json(req, { error: 'Username and password are required' }, 400);
  }

  // 10 attempts per minute per IP, and 10 per minute per account.
  if (!rateLimit(clientKey(req, 'login'), 10, 60_000) || !rateLimit(`user:${username}`, 10, 60_000)) {
    return json(req, { error: 'Too many attempts. Try again in a minute.' }, 429);
  }

  const [participantResult, judgeResult] = await Promise.all([
    supabase.from('participants').select('*').eq('username', username).eq('is_active', true).maybeSingle(),
    supabase.from('judges').select('*').eq('username', username).eq('is_active', true).maybeSingle(),
  ]);

  const participant = participantResult.data;
  const judge = judgeResult.data;
  const account = participant
    ? { type: 'participant' as const, record: participant }
    : judge
    ? { type: 'judge' as const, record: judge }
    : null;

  if (!account) {
    // Spend comparable time on unknown users so the response does not reveal
    // whether the account exists.
    await verifyPassword(password, await hashPassword(password));
    return json(req, { error: INVALID_CREDENTIALS }, 401);
  }

  const stored = await getCredential(account.type, account.record.id);
  const { valid, needsUpgrade } = stored
    ? await verifyPassword(password, stored)
    : { valid: false, needsUpgrade: false };

  if (!valid) {
    return json(req, { error: INVALID_CREDENTIALS }, 401);
  }

  // Legacy SHA-256 hash: replace it with PBKDF2 now that we hold the password.
  if (needsUpgrade) {
    await storeCredential(account.type, account.record.id, password).catch((error) =>
      console.error('password upgrade failed:', error)
    );
  }

  const token = await issueToken({
    sub: account.record.id,
    username: account.record.username,
    role: account.type,
    full_name: account.record.full_name,
  });

  if (account.type === 'participant') {
    const p = account.record;
    return json(req, {
      token,
      participant: {
        id: p.id,
        username: p.username,
        full_name: p.full_name,
        age: p.age,
        chest_number: p.chest_number,
        age_category: p.age_category,
        church: p.church,
        district: p.district,
      },
    });
  }

  const j = account.record;
  return json(req, {
    token,
    judge: {
      id: j.id,
      username: j.username,
      full_name: j.full_name,
      email: j.email,
      church: j.church,
    },
  });
}

async function handleVerify(req: Request) {
  const authenticated = await authenticateCustomUser(supabase, bearer(req));
  if (!authenticated) {
    return json(req, { valid: false, error: 'Invalid token' }, 401);
  }

  const { claims, record } = authenticated;
  const safe = { ...record };
  delete (safe as Record<string, unknown>).password_hash;

  return claims.role === 'judge'
    ? json(req, { valid: true, judge: safe })
    : json(req, { valid: true, participant: safe });
}

// Admin sets or replaces a password. Hashing used to happen in the browser with
// a salt baked into the bundle; it happens here now.
async function handleSetPassword(req: Request) {
  const admin = await requireAdmin(supabase, bearer(req));
  if (!admin) return json(req, { error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const entries: Array<{ user_type: string; user_id: string; password: string }> =
    Array.isArray(body.credentials) ? body.credentials : [body];

  if (entries.length === 0 || entries.length > 500) {
    return json(req, { error: 'Between 1 and 500 credentials per request' }, 400);
  }

  for (const entry of entries) {
    if (entry.user_type !== 'participant' && entry.user_type !== 'judge') {
      return json(req, { error: 'user_type must be participant or judge' }, 400);
    }
    if (typeof entry.user_id !== 'string' || typeof entry.password !== 'string') {
      return json(req, { error: 'user_id and password are required' }, 400);
    }
    if (entry.password.length < 8) {
      return json(req, { error: 'Passwords must be at least 8 characters' }, 400);
    }
  }

  for (const entry of entries) {
    await storeCredential(entry.user_type as 'participant' | 'judge', entry.user_id, entry.password);
    await writeAuditLog(supabase, {
      user_id: admin.id,
      actor_type: 'admin',
      action: 'set_password',
      table_name: 'user_credentials',
      record_id: entry.user_id,
      new_values: { user_type: entry.user_type },
    });
  }

  return json(req, { success: true, updated: entries.length });
}

async function handleReset(req: Request) {
  const admin = await requireAdmin(supabase, bearer(req));
  if (!admin) return json(req, { error: 'Unauthorized' }, 401);

  const { username, user_type = 'participant' } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || !username) {
    return json(req, { error: 'Username is required' }, 400);
  }
  if (user_type !== 'participant' && user_type !== 'judge') {
    return json(req, { error: 'user_type must be participant or judge' }, 400);
  }

  const table = user_type === 'judge' ? 'judges' : 'participants';
  const { data: account } = await supabase
    .from(table)
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (!account) return json(req, { error: 'Account not found' }, 404);

  const newPassword = generatePassword();
  await storeCredential(user_type, account.id, newPassword);
  await writeAuditLog(supabase, {
    user_id: admin.id,
    actor_type: 'admin',
    action: 'reset_password',
    table_name: 'user_credentials',
    record_id: account.id,
    new_values: { user_type },
  });

  return json(req, { success: true, new_password: newPassword });
}
