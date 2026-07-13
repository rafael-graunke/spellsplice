import type { LivePlayerInfo, TemplateFieldMapping } from './liveMode';

export function substituteTemplate(
    svg: string,
    mappings: TemplateFieldMapping[],
    left: LivePlayerInfo,
    right: LivePlayerInfo,
): string {
    if (mappings.length === 0) return svg;

    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return svg;

    for (const mapping of mappings) {
        const el = doc.getElementById(mapping.id);
        if (!el) continue;
        const info = mapping.side === 'left' ? left : right;
        el.textContent = String(info[mapping.field]);
    }

    return new XMLSerializer().serializeToString(doc);
}
