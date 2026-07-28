import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const edgeFunction = await readFile(
  path.join(rootDir, 'supabase', 'functions', 'sync-market-prices', 'index.ts'),
  'utf8',
);
const quantEngine = await readFile(path.join(rootDir, 'js', 'features', 'quantEngine.js'), 'utf8');
const appCore = await readFile(path.join(rootDir, 'js', 'features', 'appCore.js'), 'utf8');

assert.match(edgeFunction, /provider === 'yahoo'/);
assert.match(edgeFunction, /`\$\{ticker\}\.KS`/);
assert.match(edgeFunction, /currency mismatch/);
assert.match(edgeFunction, /6 \* 60 \* 60 \* 1000/);
assert.match(quantEngine, /MARKET_PRICE_AUTO_SYNC_INTERVAL_MS = 4 \* 60 \* 60 \* 1000/);
assert.match(quantEngine, /window\.maybeAutoSyncMarketPrices/);
assert.match(appCore, /window\.maybeAutoSyncMarketPrices\?\.\(\)/);

console.log('Market price auto-sync contract ok');
