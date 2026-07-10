import { loadLiveModeConfig } from '@/lib/liveMode';

function OverlayPage() {
    const configured = loadLiveModeConfig() !== null;

    if (!configured) {
        return (
            <div className="h-screen flex items-center justify-center bg-background text-foreground">
                <p className="text-muted-foreground">Live Mode not configured</p>
            </div>
        );
    }

    return (
        <div className="h-screen flex items-center justify-center bg-background text-foreground">
            <p className="text-muted-foreground">Live Mode overlay coming soon</p>
        </div>
    );
}

export default OverlayPage;
