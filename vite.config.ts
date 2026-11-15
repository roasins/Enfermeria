import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Identificador de esta compilación (fecha y hora). La app lo compara con /version.json
// para avisar cuando hay una versión nueva publicada.
const version = new Date().toISOString().slice(0, 16).replace('T', ' ')

const archivoVersion = (): Plugin => ({
  name: 'archivo-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), archivoVersion()],
  define: { __VERSION__: JSON.stringify(version) },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
