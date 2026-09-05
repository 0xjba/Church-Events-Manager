// Gives each build its own service worker.
//
// public/sw.js is copied into dist/ verbatim, so without this the same bytes
// ship every release: the browser sees no change, never installs a new worker,
// never runs activate, and one cache accumulates the hashed assets of every
// deploy that ever happened. Hashing the built asset names gives a value that
// changes exactly when the assets do.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const swPath = join(dist, 'sw.js');

const assets = readdirSync(join(dist, 'assets')).sort().join('|');
const buildId = createHash('sha256').update(assets).digest('hex').slice(0, 12);

const sw = readFileSync(swPath, 'utf8');
if (!sw.includes('__BUILD_ID__')) {
  console.error('stamp-sw: no __BUILD_ID__ placeholder in dist/sw.js');
  process.exit(1);
}

writeFileSync(swPath, sw.replace('__BUILD_ID__', buildId));
console.log(`stamp-sw: cache name devotional-events-${buildId}`);
