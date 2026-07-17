import { useRef, useState } from 'react';
import { FilePlus, FolderOpen, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LiveModeDialog from '@/components/LiveMode/LiveModeDialog';

interface WelcomeScreenProps {
    onCreateNew: () => void;
    onOpenProject: (file: File) => void;
    onStartLiveMode: () => void;
}

function WelcomeScreen({ onCreateNew, onOpenProject, onStartLiveMode }: WelcomeScreenProps) {
    const importRef = useRef<HTMLInputElement>(null);
    const [liveModeOpen, setLiveModeOpen] = useState(false);

    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <input
                ref={importRef}
                type="file"
                accept=".sps"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onOpenProject(file);
                    e.target.value = '';
                }}
            />
            <div className="flex flex-col items-center text-center space-y-1">
                <img src="/logo.svg" alt="Spellsplice" className="h-26 mb-2" />
                <h1 className="text-6xl font-regular font-forque">SpellsplicE</h1>
                <p className="text-sm text-muted-foreground">Magic: The Gathering video overlay editor</p>
            </div>
            <div className="flex flex-col gap-3 w-64">
                <Button size="lg" className="justify-start" onClick={onCreateNew}>
                    <FilePlus /> Create new project
                </Button>
                <Button size="lg" variant="outline" className="justify-start" onClick={() => importRef.current?.click()}>
                    <FolderOpen /> Open existing project
                </Button>
                <Button size="lg" variant="outline" className="justify-start" onClick={() => setLiveModeOpen(true)}>
                    <Radio /> Start Live Mode
                </Button>
            </div>
            <LiveModeDialog open={liveModeOpen} onOpenChange={setLiveModeOpen} onStart={onStartLiveMode} />
        </div>
    );
}

export default WelcomeScreen;
