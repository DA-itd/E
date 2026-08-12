// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: 'https://da-itd.github.io/E/', // <-- IMPORTANTE: coincide con tu repositorio
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          pdf: ['pdf-lib', 'jspdf', 'jspdf-autotable']
        }
      }
    }
  },
  // Asegurar que los archivos estáticos se copien
  publicDir: 'public',
});