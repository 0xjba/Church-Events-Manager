import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Hash password using crypto API
async function hashPassword(password: string, salt: string = 'pypa-salt'): Promise<string> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compare passwords
async function comparePassword(password: string, hash: string, salt: string = 'pypa-salt'): Promise<boolean> {
  const hashedInput = await hashPassword(password, salt);
  return hashedInput === hash;
}

// JWT secret for participant tokens
const JWT_SECRET = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(Deno.env.get('SUPABASE_JWT_SECRET') || 'fallback-secret-key'),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    
    console.log(`Participant auth action: ${action}`);

    switch (action) {
      case 'login':
        return await handleLogin(req);
      case 'verify':
        return await handleVerify(req);
      case 'create':
        return await handleCreate(req);
      case 'reset':
        return await handleReset(req);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in participant-auth function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle participant login
async function handleLogin(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return new Response(
      JSON.stringify({ error: 'Username and password are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Try to find participant first
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (participant && !participantError) {
    // Verify password for participant
    const passwordValid = await comparePassword(password, participant.password_hash);
    if (!passwordValid) {
      console.log('Invalid password for participant:', username);
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update login stats for participant
    await supabase
      .from('participants')
      .update({
        last_login: new Date().toISOString(),
        login_count: (participant.login_count || 0) + 1
      })
      .eq('id', participant.id);

    // Generate JWT token for participant
    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: participant.id,
        username: participant.username,
        role: 'participant',
        full_name: participant.full_name,
        category: participant.category,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      },
      JWT_SECRET
    );

    return new Response(
      JSON.stringify({
        token,
        participant: {
          id: participant.id,
          username: participant.username,
          full_name: participant.full_name,
          age: participant.age,
          chest_number: participant.chest_number,
          category: participant.category,
          church: participant.church,
          district: participant.district,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Try to find judge if participant not found
  const { data: judge, error: judgeError } = await supabase
    .from('judges')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (judge && !judgeError) {
    // Verify password for judge
    const passwordValid = await comparePassword(password, judge.password_hash);
    if (!passwordValid) {
      console.log('Invalid password for judge:', username);
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update login stats for judge
    await supabase
      .from('judges')
      .update({
        last_login: new Date().toISOString(),
        login_count: (judge.login_count || 0) + 1
      })
      .eq('id', judge.id);

    // Generate JWT token for judge
    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: judge.id,
        username: judge.username,
        role: 'judge',
        full_name: judge.full_name,
        church: judge.church,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      },
      JWT_SECRET
    );

    return new Response(
      JSON.stringify({
        token,
        judge: {
          id: judge.id,
          username: judge.username,
          full_name: judge.full_name,
          email: judge.email,
          church: judge.church,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Neither participant nor judge found
  console.log('User not found:', username);
  return new Response(
    JSON.stringify({ error: 'Invalid credentials' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Handle token verification
async function handleVerify(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return new Response(
      JSON.stringify({ valid: false, error: 'No token provided' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await verify(token, JWT_SECRET);
    
    if (!payload.sub || (payload.role !== 'participant' && payload.role !== 'judge')) {
      throw new Error('Invalid token');
    }

    if (payload.role === 'participant') {
      // Verify participant still exists and is active
      const { data: participant, error } = await supabase
        .from('participants')
        .select('id, username, full_name, age, chest_number, category, church, district, is_active')
        .eq('id', payload.sub)
        .eq('is_active', true)
        .single();

      if (error || !participant) {
        throw new Error('Participant not found or inactive');
      }

      return new Response(
        JSON.stringify({
          valid: true,
          participant
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (payload.role === 'judge') {
      // Verify judge still exists and is active
      const { data: judge, error } = await supabase
        .from('judges')
        .select('id, username, full_name, email, church, is_active')
        .eq('id', payload.sub)
        .eq('is_active', true)
        .single();

      if (error || !judge) {
        throw new Error('Judge not found or inactive');
      }

      return new Response(
        JSON.stringify({
          valid: true,
          judge
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return new Response(
      JSON.stringify({ valid: false, error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Handle participant creation (admin only)
async function handleCreate(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const supabaseToken = authHeader?.replace('Bearer ', '');

  // Verify admin/judge access through Supabase auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(supabaseToken);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const {
    full_name,
    age,
    chest_number,
    category,
    church,
    district,
    username,
    password
  } = await req.json();

  // Validate required fields
  if (!full_name || !age || !chest_number || !category || !church || !district || !username || !password) {
    return new Response(
      JSON.stringify({ error: 'All fields are required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check for duplicate chest number or username
  const { data: existing } = await supabase
    .from('participants')
    .select('chest_number, username')
    .or(`chest_number.eq.${chest_number},username.eq.${username}`);

  if (existing && existing.length > 0) {
    const duplicateField = existing.find(p => p.chest_number === chest_number) ? 'chest number' : 'username';
    return new Response(
      JSON.stringify({ error: `A participant with this ${duplicateField} already exists` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Create participant
  const { data: newParticipant, error: createError } = await supabase
    .from('participants')
    .insert({
      full_name,
      age,
      chest_number,
      category,
      church,
      district,
      username,
      password_hash,
      is_active: true,
      created_by: user.id,
      profile_id: null // No longer using profiles for participants
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating participant:', createError);
    return new Response(
      JSON.stringify({ error: 'Failed to create participant' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Participant created successfully',
      participant: {
        id: newParticipant.id,
        username: newParticipant.username,
        full_name: newParticipant.full_name
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Handle password reset (admin only)
async function handleReset(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const supabaseToken = authHeader?.replace('Bearer ', '');

  // Verify admin access through Supabase auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(supabaseToken);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { username } = await req.json();

  if (!username) {
    return new Response(
      JSON.stringify({ error: 'Username is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate new secure password
  const newPassword = generateSecurePassword();
  const password_hash = await hashPassword(newPassword);

  // Update participant password
  const { error: updateError } = await supabase
    .from('participants')
    .update({ password_hash })
    .eq('username', username);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to reset password' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      new_password: newPassword
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper function to generate secure passwords
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}