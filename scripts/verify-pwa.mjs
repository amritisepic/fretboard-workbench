// Checks a production build for offline readiness. Every file in dist/ must be precached by the
// service worker (source maps and the worker itself excepted), and the web manifest must be
// installable: standalone display, off-white theme colour, and 192px, 512px and maskable icons.
// Run with: npm run verify:pwa (builds first)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const problems = [];
const fail = (message) => problems.push(message);

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [relative(dist, path).split('\\').join('/')];
  });
}

if (!existsSync(join(dist, 'sw.js'))) {
  console.error('dist/sw.js is missing: build the app first (npm run build).');
  process.exit(1);
}

// --- Precache coverage ---------------------------------------------------
const worker = readFileSync(join(dist, 'sw.js'), 'utf8');
const precached = new Set([...worker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]));
const skip = (file) => file === 'sw.js' || /^workbox-[\w-]+\.js$/.test(file) || file.endsWith('.map');
const files = listFiles(dist).filter((file) => !skip(file));
for (const file of files) {
  if (!precached.has(file)) fail(`not precached: ${file}`);
}
if (!precached.has('index.html')) fail('index.html is not precached, so the app cannot boot offline');
if (!/NavigationRoute|createHandlerBoundToURL/.test(worker)) fail('no navigation fallback to index.html');

// --- Manifest ------------------------------------------------------------
const manifestFile = join(dist, 'manifest.webmanifest');
if (!existsSync(manifestFile)) {
  fail('dist/manifest.webmanifest is missing');
} else {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (manifest.display !== 'standalone') fail(`manifest display is "${manifest.display}", expected "standalone"`);
  if (String(manifest.theme_color).toUpperCase() !== '#FAF9F7') fail(`manifest theme_color is "${manifest.theme_color}"`);
  if (String(manifest.background_color).toUpperCase() !== '#FAF9F7') fail(`manifest background_color is "${manifest.background_color}"`);
  if (!manifest.name || !manifest.short_name) fail('manifest needs name and short_name');
  const icons = manifest.icons ?? [];
  for (const size of ['192x192', '512x512']) {
    if (!icons.some((icon) => icon.sizes === size)) fail(`manifest has no ${size} icon`);
  }
  if (!icons.some((icon) => String(icon.purpose ?? '').includes('maskable'))) fail('manifest has no maskable icon');
  for (const icon of icons) {
    if (!existsSync(join(dist, icon.src))) fail(`manifest icon file missing: ${icon.src}`);
  }
}

const html = existsSync(join(dist, 'index.html')) ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
if (!html.includes('rel="manifest"')) fail('index.html does not link the manifest');
if (/https?:\/\/(?!www\.w3\.org)/.test(html)) fail('index.html references a remote URL, which would not load offline');

if (problems.length > 0) {
  console.error(`PWA check failed:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`PWA check passed: ${files.length} files precached, manifest installable.`);
