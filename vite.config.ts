import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Non-stable channels deploy once per commit off the last stable tag, so
// `git describe` stamps distance + sha (e.g. 1.3.0-14-ga1b2c3d): unique per
// commit, ordered, and traceable back to the source. `--always` falls back to a
// bare sha before the first tag exists. Needs tags in the checkout (CI uses
// fetch-depth: 0). Returns the package version outside a git checkout.
function describeVersion(): string {
    try {
        // Tags are v-prefixed (v1.3.0); strip it since the AppBar adds its own v.
        return execSync('git describe --tags --always').toString().trim().replace(/^v/, '');
    } catch {
        return version;
    }
}

// Serving is configured in wrangler.jsonc: client routes like /overlay have no
// file on disk, so not_found_handling: 'single-page-application' hands back the
// app shell for them.

// https://vite.dev/config/
export default defineConfig(({ command }) => {
    // Which deploy target this build is for. release.yml sets APP_CHANNEL=beta
    // before building; promote.yml leaves it unset, so stable is the default and
    // an unlabelled build is never mistaken for a beta one.
    const channel = process.env.APP_CHANNEL ?? (command === 'build' ? 'stable' : 'dev');

    // Stable ships the clean tag version; every other channel gets a per-commit
    // describe stamp. The channel itself is shown by the AppBar badge, so it
    // stays out of the version string.
    const displayVersion = channel === 'stable' ? version : describeVersion();

    return {
        define: {
            __APP_VERSION__: JSON.stringify(displayVersion),
            __APP_CHANNEL__: JSON.stringify(channel),
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
    };
});
