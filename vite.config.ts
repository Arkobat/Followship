import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build works on any GitHub Pages path (/<repo>/) without
  // hard-coding the repository name. Routing is hash-based, so this is safe.
  base: './',
})
