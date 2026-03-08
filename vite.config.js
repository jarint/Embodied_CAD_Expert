// vite.config.js
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [basicSsl()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        ar: './ar.html'
      }
    }
  },
  server: {
    open: true,
    port: 3000
  }
});
