import { defineConfig } from 'vite';

/**
 * Plugin som automatiskt laddar om sidan i webbläsaren när ljudfiler
 * i public/assets/sounds/ ändras, läggs till eller byts ut.
 */
function watchSoundsPlugin() {
  return {
    name: 'watch-sounds-plugin',
    configureServer(server) {
      server.watcher.add('public/assets/sounds/**');
      const reload = (file) => {
        if (file && (file.includes('sounds') || file.endsWith('.mp3') || file.endsWith('.wav'))) {
          console.log(`[Vite] Ljudfil uppdaterades: ${file} -> Laddar om spelet...`);
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
    },
  };
}

export default defineConfig({
  plugins: [watchSoundsPlugin()],
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
