import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { reviewApiPlugin } from './server/plugin';

export default defineConfig({
  plugins: [react(), reviewApiPlugin()],
  server: {
    port: 5180,
    strictPort: true,
  },
});
