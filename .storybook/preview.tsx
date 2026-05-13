import '../src/index.css';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
    parameters: {
        backgrounds: {
            default: 'dark',
            values: [{ name: 'dark', value: '#09090b' }],
        },
    },
    decorators: [
        (Story) => (
            <div className="dark">
                <div className="bg-background text-foreground">
                    <Story />
                </div>
            </div>
        ),
    ],
};

export default preview;
