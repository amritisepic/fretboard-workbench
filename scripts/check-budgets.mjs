// Ceilings the build has to stay under, checked against `dist/` after `npm run build`.
//
// The first load is what a browser downloads before it can show anything: the entry module, every
// module the entry statically imports (Vite lists those as `modulepreload`, and the browser fetches
// them in the same round trip), and the stylesheet. Anything reached through `import()` — the
// presets panel with its 88 examples, the export machinery, the tour, the scale wizard, the
// settings panel, the sidebar — is not counted, because nobody pays for it until they ask.
//
// Sizes are gzipped, because that is what crosses the network. The numbers below are the measured
// values, so nothing gets slower without the build saying so; the target is in the design plan
// (item 31 asks for a first load under 60 kB) and a change that gets closer should tighten these in
// the same commit. Loosening one is a regression and the reason belongs in the commit message.

import { gzipSync } from 'node:zlib';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');

/**
 * Kilobytes, gzipped.
 *
 * `firstLoadJs` went from 114 to 115 with the second and third phases of the design plan, which put
 * the Display popover, the one Switch, the theme and its theme-aware dot colors, and the strip's new
 * model on the first-paint path: 113.1 kB before them, 114.6 after. `firstLoadCss` came down from 10
 * to 8 when the stylesheet was split and the wizard, export and tour sheets moved to their chunks.
 */
const BUDGETS = {
  firstLoadJs: 115,
  firstLoadCss: 8,
  /** Everything in the build, lazy chunks included, so a new dependency cannot hide in a chunk. */
  allJs: 145,
};

const html = readFileSync(join(DIST, 'index.html'), 'utf8');

/** Every asset the entry HTML fetches up front, as a path relative to `dist`. */
function firstLoadAssets() {
  const paths = [];
  for (const pattern of [
    /<script[^>]+src="([^"]+)"/g,
    /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g,
    /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g,
  ]) {
    for (const match of html.matchAll(pattern)) paths.push(match[1].replace(/^\/+/, ''));
  }
  return paths;
}

const gzipKb = (paths) =>
  paths.reduce((total, path) => total + gzipSync(readFileSync(join(DIST, path))).length, 0) / 1024;

const assets = firstLoadAssets();
if (assets.length === 0) {
  console.error('No first-load assets found in dist/index.html. Did the build run?');
  process.exit(1);
}

const measured = {
  firstLoadJs: gzipKb(assets.filter((path) => path.endsWith('.js'))),
  firstLoadCss: gzipKb(assets.filter((path) => path.endsWith('.css'))),
  allJs: gzipKb(globSync('assets/**/*.js', { cwd: DIST })),
};

let failed = false;
for (const [name, budget] of Object.entries(BUDGETS)) {
  const value = measured[name];
  const over = value > budget;
  failed ||= over;
  console.log(`${over ? 'OVER  ' : 'ok    '} ${name}: ${value.toFixed(1)} kB gzip (budget ${budget})`);
}

if (failed) {
  console.error('\nA budget in scripts/check-budgets.mjs was exceeded. Make the build smaller, or');
  console.error('raise the budget in the same commit and say in the message what bought the size.');
  process.exit(1);
}
console.log(`\nBundle budgets passed: ${assets.length} files in the first load.`);
