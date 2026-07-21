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
export default defineConfig(({ command }) => ({
    define: {
        __APP_VERSION__: JSON.stringify(version),
        // Which deploy target this build is for. release.yml sets APP_CHANNEL=beta
        // before building; promote.yml leaves it unset, so production is the
        // default and an unlabelled build is never mistaken for a beta one.
        __APP_CHANNEL__: JSON.stringify(
            process.env.APP_CHANNEL ?? (command === 'build' ? 'production' : 'dev')
        ),
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
}));
