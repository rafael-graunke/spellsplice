import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { copyFileSync, existsSync, readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

// GitHub Pages has no file at client routes like /overlay, so a direct load
// (OBS Browser Source, refresh) 404s before the SPA can route. Serving the
// app shell as 404.html makes Pages hand back index.html for unknown paths;
// main.tsx then renders the right screen from window.location.pathname.
function spaFallback404(): Plugin {
    return {
        name: 'spa-fallback-404',
        apply: 'build',
        writeBundle(options) {
            const dir = options.dir ?? 'dist';
            const index = path.join(dir, 'index.html');
            if (existsSync(index)) {
                copyFileSync(index, path.join(dir, '404.html'));
            }
        },
    };
}

// https://vite.dev/config/
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [
        react(),
        tailwindcss(),
        svgr({ include: 'src/assets/icons/**/*.svg' }),
        spaFallback404(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
