import type { ReactNode } from 'react';
import { InfoIcon } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Small info affordance for a field label: an info icon that reveals the
// field's help text on hover/focus, replacing the always-on helper paragraph
// that used to sit under each control.
function InfoHint({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <TooltipProvider delayDuration={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="More info"
                        className="text-muted-foreground hover:text-foreground inline-flex"
                    >
                        <InfoIcon className={cn('size-3.5', className)} />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56">{children}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export default InfoHint;
