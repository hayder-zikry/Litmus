import { writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const MANIFEST = {
  manifest_version: 3,
  name: 'Litmus',
  version: '0.2',
  description: "Fact-checks the YouTube Short you're watching, on the page, automatically.",
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      js: ['content.js'],
      run_at: 'document_idle',
    },
  ],
  host_permissions: ['https://litmus-api-907722055477.asia-southeast1.run.app/*'],
}

// Emits manifest.json alongside the built content script.
function emitManifest(outDir: string): Plugin {
  return {
    name: 'litmus-manifest',
    closeBundle() {
      writeFileSync(`${outDir}/manifest.json`, JSON.stringify(MANIFEST, null, 2))
    },
  }
}

const outDir = 'extension-dist'

// Builds the content script as one self-contained IIFE bundle (React + styles
// inlined) so it can be loaded unpacked. Shares src/litmus with the website.
export default defineConfig({
  plugins: [react(), tailwindcss(), emitManifest(outDir)],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/extension/content.tsx', import.meta.url)),
      output: {
        entryFileNames: 'content.js',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
})
