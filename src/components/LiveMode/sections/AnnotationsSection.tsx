import type { LiveAnnotationConfig } from '@/lib/liveMode';
import AnnotationConfigEditor from './AnnotationConfigEditor';

interface Props {
    annotationConfig: LiveAnnotationConfig;
    onAnnotationConfigChange: (next: LiveAnnotationConfig) => void;
}

function AnnotationsSection({
    annotationConfig,
    onAnnotationConfigChange,
}: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-1">Annotations</h2>
                <p className="text-xs text-muted-foreground">
                    Placement and sizing of every annotation on a side. Settings
                    apply to all of that player's annotations, not one at a
                    time.
                </p>
            </div>

            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Left Player
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <AnnotationConfigEditor
                    config={annotationConfig.left}
                    onChange={(left) =>
                        onAnnotationConfigChange({ ...annotationConfig, left })
                    }
                    ownSide="left"
                />
            </div>
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Right Player
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <AnnotationConfigEditor
                    config={annotationConfig.right}
                    onChange={(right) =>
                        onAnnotationConfigChange({ ...annotationConfig, right })
                    }
                    ownSide="right"
                />
            </div>
        </div>
    );
}

export default AnnotationsSection;
