import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import OverlayPage from './features/overlay/OverlayPage';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';

const queryClient = new QueryClient();

const path = window.location.pathname.replace(/\/+$/, '');
const Root = path === '/overlay' ? OverlayPage : App;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                    <Root />
                </QueryClientProvider>
            </ErrorBoundary>
        </ThemeProvider>
    </StrictMode>
);
