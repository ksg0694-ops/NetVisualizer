import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function cleanLocalRef(ref) {
  if (!ref.startsWith('./')) return null;
  const cleaned = ref.split('#')[0].split('?')[0];
  if (cleaned === './') return null;
  return cleaned.replace(/^\.\//, '');
}

async function exists(relativePath) {
  try {
    await access(path.join(rootDir, relativePath), constants.F_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

const refs = new Map();
function addRef(source, ref) {
  const cleaned = cleanLocalRef(ref);
  if (!cleaned) return;
  if (!refs.has(cleaned)) refs.set(cleaned, new Set());
  refs.get(cleaned).add(source);
}

const indexHtml = await readFile(path.join(rootDir, 'index.html'), 'utf8');
for (const match of indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
  addRef('index.html', match[1]);
}

const swSource = await readFile(path.join(rootDir, 'sw.js'), 'utf8');
for (const match of swSource.matchAll(/["'](\.\/[^"']+)["']/g)) {
  addRef('sw.js', match[1]);
}

const manifest = JSON.parse(await readFile(path.join(rootDir, 'manifest.json'), 'utf8'));
for (const icon of manifest.icons || []) {
  if (typeof icon?.src === 'string') addRef('manifest.json', icon.src);
}

const missing = [];
for (const [relativePath, sources] of refs) {
  if (!(await exists(relativePath))) {
    missing.push(`${relativePath} referenced by ${[...sources].join(', ')}`);
  }
}

if (missing.length > 0) {
  console.error('Static asset check failed:');
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Static asset refs ok (${refs.size} local refs)`);
