// Generated source maps embed original checkout newlines. Canonicalize for CI.
import { readFile, writeFile } from 'node:fs/promises';
const path = new URL('../js/generated/personal-cfo-domain.js.map', import.meta.url);
const map = JSON.parse(await readFile(path, 'utf8'));
map.sourcesContent = map.sourcesContent.map(source => source?.replace(/\r\n/g, '\n') ?? source);
await writeFile(path, JSON.stringify(map));
