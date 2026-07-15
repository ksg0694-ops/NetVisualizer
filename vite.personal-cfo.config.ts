import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(rootDir, 'src/features/personal-cfo/runtime.ts'),
      name: 'PersonalCfoDomain',
      formats: ['iife'],
      fileName: () => 'personal-cfo-domain.js',
    },
    minify: false,
    outDir: resolve(rootDir, 'js/generated'),
    sourcemap: true,
  },
});
