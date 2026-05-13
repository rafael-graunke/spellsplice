import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    framework: '@storybook/react-vite',
    viteFinal: async (config) => {
        config.plugins ??= [];
        config.plugins.unshift(tailwindcss());
        config.plugins.push(svgr({ include: 'src/assets/icons/**/*.svg' }));
        config.resolve ??= {};
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, '../src'),
        };
        return config;
    },
};

export default config;
