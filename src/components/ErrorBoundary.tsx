import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (error) {
            return (
                <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
                    <p className="text-lg font-semibold">Something went wrong</p>
                    <pre className="max-w-xl overflow-auto rounded bg-muted p-4 text-xs text-muted-foreground">
                        {error.message}
                    </pre>
                    <div className="flex gap-3">
                        <button
                            className="cursor-pointer rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
                            onClick={() => this.setState({ error: null })}
                        >
                            Try again
                        </button>
                        <a
                            href="https://github.com/rafael-graunke/spellsplice/issues"
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer rounded border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                        >
                            Report an issue
                        </a>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
