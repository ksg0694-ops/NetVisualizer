import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../manifest.json', import.meta.url);
const raw = await readFile(manifestPath, 'utf8');

let manifest;
try {
  manifest = JSON.parse(raw);
} catch (error) {
  console.error(`manifest.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

const requiredStringFields = ['name', 'short_name', 'description', 'start_url', 'display', 'background_color', 'theme_color'];
const missingFields = requiredStringFields.filter((field) => typeof manifest[field] !== 'string' || manifest[field].trim() === '');

if (missingFields.length > 0) {
  console.error(`manifest.json is missing required string fields: ${missingFields.join(', ')}`);
  process.exit(1);
}

if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  console.error('manifest.json must define at least one icon.');
  process.exit(1);
}

console.log('manifest.json ok');
