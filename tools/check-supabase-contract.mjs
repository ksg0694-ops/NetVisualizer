import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const scanDirs = [
  path.join(rootDir, 'js', 'features'),
  path.join(rootDir, 'supabase', 'functions'),
];

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (/\.(js|mjs|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = (await Promise.all(scanDirs.map(collectFiles))).flat().sort();
const violations = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(rootDir, file).replaceAll(path.sep, '/');
  const lines = source.split(/\r?\n/);
  let insideSupabaseColumns = false;

  lines.forEach((line, index) => {
    if (/const\s+SUPABASE_COLUMNS\s*=/.test(line)) {
      insideSupabaseColumns = true;
    }

    if (/\.select\s*\(\s*(['"`])\*\1\s*\)/.test(line)) {
      violations.push(`${relative}:${index + 1} uses .select('*')`);
    }

    if (insideSupabaseColumns && /:\s*(['"`])\*\1\s*(,|})/.test(line)) {
      violations.push(`${relative}:${index + 1} uses wildcard column contract`);
    }

    if (insideSupabaseColumns && /^\s*};\s*$/.test(line)) {
      insideSupabaseColumns = false;
    }
  });
}

if (violations.length > 0) {
  console.error('Supabase contract check failed:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Supabase column contracts ok (${files.length} files scanned)`);
