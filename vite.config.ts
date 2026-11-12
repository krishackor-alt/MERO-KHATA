import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Allows root `index.html` on disk to point to prebuilt `./dist/assets/index.js` & `./dist/assets/index.css`
 * so static servers (GitHub Pages from `main` branch root, VS Code Live Server, etc.) never request raw `.tsx`
 * (which causes the "MIME type of application/octet-stream" error), while `vite` and `vite build`
 * still compile from `./src/main.tsx`.
 */
function staticFallbackEntryPlugin(): Plugin {
  return {
    name: 'mero-khata-static-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(
            /<link[^>]*data-static-bundle[^>]*>\s*/g,
            ''
          )
          .replace(
            /<script[^>]*data-static-bundle[^>]*><\/script>/,
            '<script type="module" src="./src/main.tsx"></script>'
          );
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [staticFallbackEntryPlugin(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
