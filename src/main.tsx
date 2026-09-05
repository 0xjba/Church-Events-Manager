import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { reloadOnce } from '@/components/ChunkErrorBoundary'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Vite raises this when a preloaded chunk 404s — the same stale-build problem
// the error boundary catches, but reported before React ever renders it.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (reloadOnce()) window.location.reload();
});

// The service worker used to be registered from inside the notification helper,
// which only ran on two screens, so most people never got one at all. It is a
// property of the app, so the app registers it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}
