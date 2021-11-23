import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/frontend'),
  plugins: [ vue() ],
  server: {
    port: 6567
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src/frontend')
      }
    ]
  },
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, 'build/frontend'),
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
});
