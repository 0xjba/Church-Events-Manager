// Origins allowed to call the edge functions. Set ALLOWED_ORIGINS to a comma
// separated list in the function secrets; falls back to "*" only in local dev.
const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * An entry may name an exact origin, or a wildcard subdomain such as
 * https://*.netlify.app, which covers deploy previews without listing each of
 * their generated hostnames.
 */
function isAllowed(origin: string): boolean {
  if (!origin) return false;

  return configured.some((rule) => {
    if (rule === origin) return true;
    if (!rule.startsWith('https://*.')) return false;

    const suffix = rule.slice('https://*.'.length);
    try {
      const url = new URL(origin);
      return (
        url.protocol === 'https:' &&
        (url.hostname === suffix || url.hostname.endsWith(`.${suffix}`))
      );
    } catch {
      return false;
    }
  });
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = configured.length === 0 ? '*' : isAllowed(origin) ? origin : configured[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
