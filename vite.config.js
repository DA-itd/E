import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Coincide con https://github.com/DA-itd/E -> publicado en
// https://da-itd.github.io/E/
export default defineConfig({
  plugins: [react()],
  base: '/E/',
})
