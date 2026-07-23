import { defineConfig } from 'vitest/config';
import path from 'path';

// Unit tests target pure logic (state derivation, overlay synthesis), so a plain
// node environment keeps them fast. Anything needing the DOM/canvas should mock
// its dependencies rather than pull in a browser environment here.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
