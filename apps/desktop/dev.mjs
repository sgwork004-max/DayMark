#!/usr/bin/env node
/**
 * Dev launcher: runs `tauri dev` and re-signs the binary with Calendar
 * entitlements after every cargo rebuild. Required because `cargo build`
 * produces a linker-only adhoc signature with no entitlements, which
 * causes EventKit's requestAccess to silently return false.
 */
import { spawn, execFileSync, spawnSync } from 'child_process';
import { statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR          = dirname(fileURLToPath(import.meta.url));
const BINARY       = join(DIR, 'src-tauri/target/debug/daymark-desktop');
const ENTITLEMENTS = join(DIR, 'src-tauri/entitlements.plist');
const BUNDLE_ID    = 'co.daymark.desktop';

function sign() {
  if (!existsSync(BINARY)) return;
  try {
    execFileSync('codesign', [
      '--force', '-s', '-',
      '-i', BUNDLE_ID,
      '--entitlements', ENTITLEMENTS,
      BINARY,
    ], { stdio: 'pipe' });
    // codesign mutates the binary timestamp; record the new value so the
    // watcher does not treat our own signature as another Cargo rebuild.
    lastMtime = statSync(BINARY).mtimeMs;
    process.stdout.write('\x1b[32m[sign]\x1b[0m Binary signed (' + BUNDLE_ID + ')\n');
  } catch (_) {
    // binary might be locked mid-write; next poll will catch it
  }
}

// Poll for binary changes every 800ms (more reliable than fs.watch on macOS
// when cargo replaces the file via atomic rename)
let lastMtime = 0;
function poll() {
  try {
    const mt = statSync(BINARY).mtimeMs;
    if (mt !== lastMtime) {
      lastMtime = mt;
      setTimeout(sign, 100); // small delay so cargo finishes writing
    }
  } catch (_) {}
}

sign(); // sign whatever exists from a previous build
const poller = setInterval(poll, 800);

// Find the tauri CLI binary shipped with this package
const tauriBin = join(DIR, 'node_modules/.bin/tauri');

const proc = spawn(tauriBin, ['dev'], {
  stdio: 'inherit',
  cwd: DIR,
  env: { ...process.env },
});

proc.on('exit', (code) => {
  clearInterval(poller);
  process.exit(code ?? 0);
});
process.on('SIGINT',  () => { clearInterval(poller); proc.kill('SIGINT');  });
process.on('SIGTERM', () => { clearInterval(poller); proc.kill('SIGTERM'); });
