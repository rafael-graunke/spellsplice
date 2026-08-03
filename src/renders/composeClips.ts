import type { ClipTransform, ClipCrop } from '@/types/clip';

/**
 * One visual clip to composite onto the base canvas. `frame` is the current
 * video frame / image / VideoFrame; srcWidth/srcHeight are the source's
 * intrinsic dimensions (for resolving the crop source-rect).
 */
export interface BaseLayer {
    frame: CanvasImageSource;
    srcWidth: number;
    srcHeight: number;
    transform: ClipTransform;
    crop: ClipCrop;
}

/** Map a clip blend name to a 2D canvas globalCompositeOperation. */
function blendToComposite(blend: string): GlobalCompositeOperation {
    switch (blend) {
        case 'add':
        case 'lighter':
            return 'lighter';
        case 'screen':
            return 'screen';
        case 'multiply':
            return 'multiply';
        case 'overlay':
            return 'overlay';
        default:
            return 'source-over';
    }
}

/**
 * Composite the visual clip stack onto `ctx` (an outW×outH 2D context), filling
 * black behind. Layers draw back-to-front in array order. Each layer's crop
 * selects a source sub-rect; its transform places that sub-rect (centre anchor)
 * on the canvas with uniform-or-free scale, rotation, opacity, and blend.
 *
 * This is the single shared clip-compositing path used by both the live preview
 * (VideoPreview) and the baked export (pipeline) so the two stay pixel-identical.
 */
export function drawClipLayers(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    layers: BaseLayer[],
    outW: number,
    outH: number,
): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, outW, outH);

    for (const layer of layers) {
        const { frame, srcWidth, srcHeight, transform, crop } = layer;
        if (srcWidth <= 0 || srcHeight <= 0) continue;

        const sx = crop.left * srcWidth;
        const sy = crop.top * srcHeight;
        const sw = srcWidth * (1 - crop.left - crop.right);
        const sh = srcHeight * (1 - crop.top - crop.bottom);
        if (sw <= 0 || sh <= 0) continue;

        const dw = sw * transform.scaleX;
        const dh = sh * transform.scaleY;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity));
        ctx.globalCompositeOperation = blendToComposite(transform.blend);
        ctx.translate(transform.x, transform.y);
        if (transform.rotation) ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.drawImage(frame, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }
}
