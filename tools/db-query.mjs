// Explicitly scoped maintenance client. Never prints credentials.
import { readFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const file = args[args.indexOf('--file') + 1];
if (!args.includes('--file') || !file) throw new Error('Usage: node tools/db-query.mjs --file query.sql [--write]');
const ref = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (ref !== 'djwqcewsochlesjcouoi') throw new Error('Unexpected linked project');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: await readFile(file, 'utf8'), read_only: !args.includes('--write') }),
});
if (!response.ok) throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
console.log(JSON.stringify(await response.json(), null, 2));
