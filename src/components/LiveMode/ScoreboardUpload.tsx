import { useRef } from 'react';
import { UploadIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScoreboardUploadProps {
    hasScoreboard: boolean;
    onUpload: (svg: string) => void;
    onClear: () => void;
}

export function ScoreboardUpload({
    hasScoreboard,
    onUpload,
    onClear,
}: ScoreboardUploadProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        onUpload(await file.text());
    };

    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-2">
            <div className="flex items-center gap-2">
                <p className="text-sm font-medium flex-1">
                Scoreboard
            </p>
            <span className="text-muted-foreground">•</span>
            <p className={cn('text-sm', hasScoreboard ? 'text-green-500' : 'text-muted-foreground')}>
                {hasScoreboard ? 'Loaded' : 'Default'}
            </p>
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
                {hasScoreboard ? 'Replace' : 'Upload'} SVG
            </Button>
            {hasScoreboard && (
                <Button
                    size="sm"
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={onClear}
                >
                    <XIcon />
                    Clear
                </Button>
            )}
        </div></div>
    );
}
