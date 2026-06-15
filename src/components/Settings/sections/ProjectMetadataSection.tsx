import type { ProjectConfig } from '@/components/types/config';
import { Input } from '@/components/ui/input';

interface Props {
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
}

function ProjectMetadataSection({ config, onConfigChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Project Metadata</h2>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="project-title" className="text-sm font-medium">Title</label>
                        <Input
                            id="project-title"
                            value={config.title}
                            onChange={(e) => onConfigChange({ ...config, title: e.target.value })}
                            placeholder="Untitled project"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="project-author" className="text-sm font-medium">Author</label>
                        <Input
                            id="project-author"
                            value={config.author}
                            onChange={(e) => onConfigChange({ ...config, author: e.target.value })}
                            placeholder="Your name"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProjectMetadataSection;
