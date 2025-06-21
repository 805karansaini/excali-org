import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    target: "esnext",
    rollupOptions: {
      input: {
        content: "./content_script/unified-entry.ts",
      },
      output: {
        entryFileNames: "assets/[name].js"
      }
    },
  },
})
