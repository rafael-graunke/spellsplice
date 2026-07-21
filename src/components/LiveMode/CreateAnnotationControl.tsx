import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { AnnotationDialog } from './AnnotationDialog';

interface CreateAnnotationControlProps {
    onCreate: (title: string, description: string) => void;
}

export function CreateAnnotationControl({
    onCreate,
}: CreateAnnotationControlProps) {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className="flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed p-2 text-sm text-muted-foreground hover:bg-muted"
                onClick={() => setDialogOpen(true)}
            >
                <PlusIcon className="size-4" />
                New annotation
            </button>
            <AnnotationDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSave={onCreate}
            />
        </>
    );
}
