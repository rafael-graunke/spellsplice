import { useRef } from 'react';
import { UploadIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TemplateUploadProps {
    hasTemplate: boolean;
    onUpload: (svg: string) => void;
    onClear: () => void;
}

export function TemplateUpload({ hasTemplate, onUpload, onClear }: TemplateUploadProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        onUpload(await file.text());
    };

    return (
        <div className="flex items-center gap-2 rounded-lg border p-2">
            <p className="text-sm font-medium flex-1">
                Overlay template — {hasTemplate ? 'loaded' : 'none uploaded'}
            </p>
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
            <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => inputRef.current?.click()}>
                <UploadIcon />
                {hasTemplate ? 'Replace' : 'Upload'} SVG
            </Button>
            {hasTemplate && (
                <Button size="sm" variant="destructive" className="cursor-pointer" onClick={onClear}>
                    <XIcon />
                    Clear
                </Button>
            )}
        </div>
    );
}
