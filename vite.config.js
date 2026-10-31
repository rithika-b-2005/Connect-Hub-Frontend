import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { spaFallback } from './scripts/spa-fallback.mjs';

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback()],
});
