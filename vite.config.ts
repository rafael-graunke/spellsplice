import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Serving is configured in wrangler.jsonc: client routes like /overlay have no
// file on disk, so not_found_handling: 'single-page-application' hands back the
// app shell for them.

// https://vite.dev/config/
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [
        react(),
        tailwindcss(),
        svgr({ include: 'src/assets/icons/**/*.svg' }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
