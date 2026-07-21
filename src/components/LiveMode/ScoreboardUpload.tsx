import { useRef } from 'react';
import { RotateCcwIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scoreboardSvgStatus } from '@/lib/liveMode';

interface ScoreboardUploadProps {
    svg: string | null;
    onImport: (svg: string) => void;
    onRestoreDefault: () => void;
}

const STATUS_LABEL: Record<ReturnType<typeof scoreboardSvgStatus>, string> = {
    none: 'No scoreboard',
    default: 'Default',
    custom: 'Custom',
};

export function ScoreboardUpload({
    svg,
    onImport,
    onRestoreDefault,
}: ScoreboardUploadProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const status = scoreboardSvgStatus(svg);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        onImport(await file.text());
    };

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
                <span className="text-sm font-medium">Scoreboard</span>
                <span className="text-xs text-muted-foreground">
                    {STATUS_LABEL[status]}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />
                <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => inputRef.current?.click()}
                >
                    <UploadIcon />
                    Import
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={status === 'default'}
                    onClick={onRestoreDefault}
                >
                    <RotateCcwIcon />
                    Restore default
                </Button>
            </div>
        </div>
    );
}
