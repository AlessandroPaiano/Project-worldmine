import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'main/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'electron'],
            },
          },
        },
      },
      preload: {
        input: 'preload/index.ts',
      },
      renderer: {},
    }),
  ],
})
