import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: [
        '**/Screenshots/**',
        '**/*.tmp',
        '**/*.~tmp',
        '**/.~tmp',
        '**/.git/**',
      ],
    },
  },
});
