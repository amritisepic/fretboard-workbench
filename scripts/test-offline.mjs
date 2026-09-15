// Acceptance test 11: after one online visit, the production build must boot and show saved
// presets with no network. It serves dist/ with Vite's preview server and drives a headless Edge or
// Chrome (throwaway profile) over the DevTools protocol. It then shuts the server down, which is real
// network loss for the page, reloads, and opens a fresh tab.
// Run with: npm run test:offline (builds first). Set CHROME_PATH to use another Chromium browser.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4174;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PRESET_NAME = 'Offline test';

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// A minimal DevTools protocol client
// ---------------------------------------------------------------------------

class Cdp {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error(`Could not connect to ${url}`)), { once: true });
    });
    return new Cdp(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
        else entry.resolve(message.result);
      } else {
        for (const listener of this.listeners) listener(message);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  waitFor(method, sessionId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const listener = (message) => {
        if (message.method !== method || message.sessionId !== sessionId) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(message.params);
      };
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.listeners.add(listener);
    });
  }

  close() {
    this.socket.close();
  }
}

async function openPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const settle = async (action, pause) => {
    const loaded = cdp.waitFor('Page.loadEventFired', sessionId);
    await action();
    await loaded.catch(() => {});
    await sleep(pause);
  };
  const page = {
    goto: (target) => settle(() => cdp.send('Page.navigate', { url: target }, sessionId), 800),
    reload: (ignoreCache) => settle(() => cdp.send('Page.reload', { ignoreCache }, sessionId), 1200),
    async evaluate(body) {
      const { result, exceptionDetails } = await cdp.send(
        'Runtime.evaluate',
        { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true },
        sessionId,
      );
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    },
    close: () => cdp.send('Target.closeTarget', { targetId }),
  };
  await page.goto(url);
  return page;
}

async function launchBrowser(executable, profile) {
  const child = spawn(
    executable,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portFile = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 150; attempt++) {
    if (existsSync(portFile)) {
      const [port, path] = readFileSync(portFile, 'utf8').trim().split(/\s+/);
      if (port && path) return { child, endpoint: `ws://127.0.0.1:${port}${path}` };
    }
    await sleep(100);
  }
  child.kill();
  throw new Error('The browser did not open its DevTools endpoint.');
}

// ---------------------------------------------------------------------------
// Scripts run inside the page
// ---------------------------------------------------------------------------

const WAIT_FOR_APP = `
  const wait = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let i = 0; i < 60 && !document.querySelector('.app'); i++) await wait(100);
`;

const INSTALL_STATE = `
  ${WAIT_FOR_APP}
  const registration = await Promise.race([navigator.serviceWorker.ready, wait(20000).then(() => null)]);
  let cached = [];
  for (let i = 0; i < 60; i++) {
    const name = (await caches.keys()).find((key) => key.includes('precache'));
    if (name) {
      const requests = await (await caches.open(name)).keys();
      cached = requests.map((request) => new URL(request.url).pathname.slice(1));
    }
    if (registration && registration.active && registration.active.state === 'activated' && cached.includes('index.html')) break;
    await wait(200);
  }
  return { state: registration && registration.active ? registration.active.state : 'none', cached };
`;

const DRIVE_APP = `
  ${WAIT_FOR_APP}
  const click = (node) => node && node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const circles = (box) => document.querySelectorAll('.box-group svg.fretboard')[box].querySelectorAll('.position circle');
  // A first visit offers the guided tour; decline it as a new user would.
  click([...document.querySelectorAll('.tour-card button')].find((button) => button.textContent === 'Not now'));
  await wait();
  click(document.querySelector('.empty-state .add-button'));
  await wait();
  for (const [string, fret] of [[1, 3], [2, 2], [3, 0]]) { click(circles(0)[string * 25 + fret]); await wait(); }
  const input = document.querySelector('.preset-name-input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '${PRESET_NAME}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await wait();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  await wait(900);
  const saveLabel = document.querySelector('.save-button').textContent;
  click(document.querySelector('.add-slot .add-button'));
  await wait();
  for (const [string, fret] of [[2, 3], [3, 2], [4, 1]]) { click(circles(1)[string * 25 + fret]); await wait(); }
  await wait(1200);
  return {
    saveLabel,
    boxes: document.querySelectorAll('.box-group').length,
    status: document.querySelector('.preset-status') ? document.querySelector('.preset-status').textContent : 'saved',
  };
`;

const APP_STATE = `
  ${WAIT_FOR_APP}
  await document.fonts.ready;
  const tab = document.querySelector('[data-explorer-tab]');
  if (tab && !document.querySelector('.explorer-panel')) tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await wait(250);
  return {
    booted: !!document.querySelector('.app'),
    controlled: !!navigator.serviceWorker.controller,
    name: document.querySelector('.preset-name-input') ? document.querySelector('.preset-name-input').value : null,
    status: document.querySelector('.preset-status') ? document.querySelector('.preset-status').textContent : 'saved',
    boxes: document.querySelectorAll('.box-group').length,
    titles: [...document.querySelectorAll('.box-title')].map((node) => node.textContent),
    // Saved presets only; the built-in examples are listed in their own section below.
    presets: [...document.querySelectorAll('.explorer-panel > .explorer-list .explorer-name span')].map((node) => node.textContent),
    fontLoaded: [...document.fonts].some((face) => face.family.includes('Inter') && face.status === 'loaded'),
  };
`;

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------

function checkOfflineState(label, state) {
  check(`${label}: app boots`, state.booted);
  check(`${label}: served by the service worker`, state.controlled);
  check(`${label}: saved preset is listed`, state.presets.includes(PRESET_NAME), `presets [${state.presets.join(', ')}]`);
  check(
    `${label}: unsaved work is restored`,
    state.boxes === 2 && state.status === 'Edited' && state.name === PRESET_NAME,
    `${state.boxes} boxes [${state.titles.join(', ')}], "${state.name}", ${state.status}`,
  );
  check(`${label}: bundled font loads`, state.fontLoaded);
}

const workerFile = join(root, 'dist', 'sw.js');
if (!existsSync(workerFile)) {
  console.error('dist/sw.js is missing: build first (npm run test:offline does this).');
  process.exit(1);
}
const executable = BROWSERS.find((path) => existsSync(path));
if (!executable) {
  console.error('No Chrome or Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}
/** Every distinct URL the worker is told to precache. */
const precacheUrls = [...new Set([...readFileSync(workerFile, 'utf8').matchAll(/url:"([^"]+)"/g)].map((match) => match[1]))];

const profile = mkdtempSync(join(tmpdir(), 'fretboard-offline-'));
let server;
let browser;
let cdp;
try {
  server = await preview({
    root,
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: PORT, strictPort: true, open: false },
  });
  browser = await launchBrowser(executable, profile);
  cdp = await Cdp.connect(browser.endpoint);
  console.log(`Serving dist/ at ${ORIGIN} with ${executable}`);

  // 1. First visit, online: the service worker installs and precaches the app shell.
  const page = await openPage(cdp, ORIGIN);
  const install = await page.evaluate(INSTALL_STATE);
  check('first visit: service worker activates', install.state === 'activated', `state ${install.state}`);
  const missing = precacheUrls.filter((url) => !install.cached.includes(url));
  check(
    'first visit: whole app shell precached',
    missing.length === 0 && install.cached.includes('index.html'),
    missing.length === 0 ? `all ${precacheUrls.length} files cached` : `missing ${missing.join(', ')}`,
  );

  // 2. Work online: save a preset, then leave an unsaved edit.
  const work = await page.evaluate(DRIVE_APP);
  check('online: preset saved', work.saveLabel === 'Saved', `button "${work.saveLabel}"`);
  check('online: unsaved second box', work.boxes === 2 && work.status === 'Edited', `${work.boxes} boxes, ${work.status}`);

  // 3. Kill the network.
  await server.close();
  server = undefined;
  const unreachable = await fetch(ORIGIN).then(
    () => false,
    () => true,
  );
  check('network: server unreachable', unreachable);

  // 4. Reload with no network.
  await page.reload(false);
  checkOfflineState('offline reload', await page.evaluate(APP_STATE));

  // 5. A brand-new tab, still offline.
  await page.close();
  const freshTab = await openPage(cdp, ORIGIN);
  checkOfflineState('offline new tab', await freshTab.evaluate(APP_STATE));

  // 6. For reference only. This DevTools reload skips the HTTP cache. It is not the same as a user's
  // Ctrl+Shift+R, which Chromium also sends around the service worker.
  await freshTab.reload(true);
  const bypass = await freshTab.evaluate('return { booted: !!document.querySelector(".app") };').catch(() => ({ booted: false }));
  console.log(`INFO  DevTools reload with ignoreCache, offline: app ${bypass.booted ? 'booted' : 'did not load'}`);
} catch (error) {
  check('offline test ran to completion', false, error instanceof Error ? error.message : String(error));
} finally {
  cdp?.close();
  if (browser && browser.child.exitCode === null) {
    browser.child.kill();
    await Promise.race([once(browser.child, 'exit'), sleep(5000)]);
  }
  if (server) await server.close();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      break;
    } catch {
      await sleep(300);
    }
  }
}

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`\nTest 11 FAILED: ${failed.length} of ${results.length} checks.`);
  process.exit(1);
}
console.log(`\nTest 11 passed: ${results.length} checks.`);
process.exit(0);
