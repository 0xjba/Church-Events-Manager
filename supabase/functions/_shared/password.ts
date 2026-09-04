// PBKDF2-SHA256 password hashing.
//
// The previous scheme was a single SHA-256 pass over the password plus one
// shared salt that was also hardcoded in the browser bundle, so any leaked
// hash could be cracked offline in seconds. Hashes are stored as
//   pbkdf2$sha256$<iterations>$<salt b64>$<hash b64>
// and legacy 64 character hex hashes are still accepted at login, then
// transparently upgraded.

const ITERATIONS = 210_000; // OWASP recommendation for PBKDF2-HMAC-SHA256
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

const LEGACY_SALT = Deno.env.get('LEGACY_PASSWORD_SALT') ?? 'pypa-salt';

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Length independent comparison, so a mismatch never leaks position via timing.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const length = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

async function legacyHash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + LEGACY_SALT);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

export interface VerifyResult {
  valid: boolean;
  needsUpgrade: boolean;
}

export async function verifyPassword(password: string, stored: string): Promise<VerifyResult> {
  if (!stored) return { valid: false, needsUpgrade: false };

  if (stored.startsWith('pbkdf2$')) {
    const [, , iterations, salt, hash] = stored.split('$');
    const computed = await pbkdf2(password, fromBase64(salt), Number(iterations));
    return { valid: timingSafeEqual(toBase64(computed), hash), needsUpgrade: false };
  }

  // Legacy single-round SHA-256 hash.
  const computed = await legacyHash(password);
  return { valid: timingSafeEqual(computed, stored), needsUpgrade: true };
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// Rejection sampling over crypto.getRandomValues, so the output is uniform and
// unpredictable. The previous version used Math.random().
export function generatePassword(length = 12): string {
  const max = Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;
  let out = '';
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (byte < max) {
        out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
        if (out.length === length) break;
      }
    }
  }
  return out;
}
