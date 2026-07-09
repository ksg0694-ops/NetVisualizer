import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const featureDir = path.join(rootDir, 'js', 'features');
const featureEntries = await readdir(featureDir, { withFileTypes: true });
const files = featureEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => path.join(featureDir, entry.name))
  .sort();

files.push(path.join(rootDir, 'sw.js'));

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    failed = true;
    console.error(result.stderr || result.stdout || `Syntax check failed: ${file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`JavaScript syntax ok (${files.length} files)`);
