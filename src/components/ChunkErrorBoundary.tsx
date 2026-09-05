import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

const RELOAD_KEY = 'pypa.chunk-reload-at';
// Long enough that a build which is broken for real cannot reload in a loop,
// short enough that the next deploy is free to reload again.
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Deploys rename every hashed chunk, and Netlify stops serving the old names —
 * its SPA catch-all answers them with index.html instead, so the browser is
 * handed HTML where it expected JavaScript and the lazy route dies on a syntax
 * error. An installed app is the common victim: iOS suspends and resumes a PWA
 * rather than reloading it, so a phone can sit on a build that no longer exists
 * on the server.
 *
 * Reloading fetches the current index.html and its current chunk names. The
 * recorded timestamp means a genuinely broken build reloads once and then shows
 * the message rather than looping.
 */
export class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!isChunkError(error)) {
      console.error('Unhandled render error', error, info);
      return;
    }

    if (!reloadOnce()) return;
    window.location.reload();
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div>
          <h1 className="text-title font-semibold text-foreground">This page needs a refresh</h1>
          <p className="mt-1 text-body text-muted-foreground">
            The app was updated while you had it open.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-12 rounded-lg bg-primary px-6 text-body font-semibold text-primary-foreground"
        >
          Reload
        </button>
      </div>
    );
  }
}

/** True when a reload is worth trying; false once one has just been tried. */
export const reloadOnce = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage is unavailable (private mode, blocked cookies). One attempt is
    // still better than a blank screen; a loop here would need storage to fail
    // and the build to be broken at the same time.
  }
  return true;
};

// Every engine words this differently, and the Netlify case arrives as a plain
// syntax error from parsing index.html, so the match stays broad.
const isChunkError = (error: Error): boolean =>
  /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|Unexpected token '<'|expected expression/i.test(
    `${error?.name}: ${error?.message}`,
  );
