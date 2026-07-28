import type { ComponentProps, ElementType } from 'react';

import { cn } from '@/lib/utils';

function Empty({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty"
            className={cn(
                'pointer-events-none select-none flex flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground',
                className
            )}
            {...props}
        />
    );
}

interface EmptyIconProps {
    icon: ElementType;
    size?: string;
    className?: string;
}

function EmptyIcon({ icon: Icon, size = 'size-12', className }: EmptyIconProps) {
    return (
        <div
            data-slot="empty-icon"
            className="flex items-center justify-center text-muted-foreground"
        >
            <Icon className={cn('shrink-0', size, className)} />
        </div>
    );
}

function EmptyTitle({ className, ...props }: ComponentProps<'span'>) {
    return (
        <span
            data-slot="empty-title"
            className={cn('font-medium', className)}
            {...props}
        />
    );
}

function EmptySubtitle({ className, ...props }: ComponentProps<'span'>) {
    return (
        <span data-slot="empty-subtitle" className={cn(className)} {...props} />
    );
}

Empty.Icon = EmptyIcon;
Empty.Title = EmptyTitle;
Empty.Subtitle = EmptySubtitle;

export { Empty };
