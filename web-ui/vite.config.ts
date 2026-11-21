import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function classicWebViewHtmlPlugin(): Plugin {
  return {
    name: 'classic-webview-html',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script\b([^>]*?)\btype=["']module["']([^>]*?)>/gi, '<script defer$1$2>')
        .replace(/\s+crossorigin(?:=["'][^"']*["'])?/gi, '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), classicWebViewHtmlPlugin()],
  build: {
    target: 'es2018',
    cssTarget: 'chrome90',
    outDir: '../app/src/main/assets/www',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
