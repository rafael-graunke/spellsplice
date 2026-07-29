import { memo, useState } from 'react';
import { DragOverlay, useDndMonitor } from '@dnd-kit/core';
import type { OracleCard } from '@/lib/oracleCards';
import { CardChip } from './CardChip';

interface DragLayerProps {
    resolveCard: (id: string) => OracleCard | null;
    dropSuccessRef: { current: boolean };
}

export const DragLayer = memo(function DragLayer({
    resolveCard,
    dropSuccessRef,
}: DragLayerProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeWidth, setActiveWidth] = useState<number | null>(null);
    const [skipDropAnimation, setSkipDropAnimation] = useState(false);

    const clear = () => {
        setActiveId(null);
        setActiveWidth(null);
    };

    useDndMonitor({
        onDragStart(e) {
            setActiveId(String(e.active.id));
            setActiveWidth(e.active.rect.current.initial?.width ?? null);
        },
        onDragEnd() {
            setSkipDropAnimation(dropSuccessRef.current);
            clear();
        },
        onDragCancel() {
            setSkipDropAnimation(false);
            clear();
        },
    });

    const activeCard = activeId ? resolveCard(activeId) : null;

    return (
        <DragOverlay dropAnimation={skipDropAnimation ? null : undefined}>
            {activeCard ? (
                <CardChip
                    card={activeCard}
                    className="shadow-lg"
                    style={activeWidth ? { width: activeWidth } : undefined}
                />
            ) : null}
        </DragOverlay>
    );
});
