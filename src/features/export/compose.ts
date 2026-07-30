import type { Player } from '@/types/player';
import type { AnnotationSlot, TimelineLayer } from '@/types/config';
import type {
    LiveScoreboardState,
    LiveHandStackConfig,
    LiveCardDisplayConfig,
    LiveAnnotationConfig,
    LiveLayerId,
    LivePlayerInfo,
    SingleScoreboardConfig,
} from '@/lib/liveMode';
import { derivePlayerState, deriveUIVisibility } from '@/lib/deriveState';
import { renderLiveHand, getHandStackTopY } from '@/renders/renderLiveHand';
import { renderLiveAnnotations } from '@/renders/renderLiveAnnotation';
import { renderLiveCardDisplay } from '@/renders/renderLiveCardDisplay';
import { renderLiveScoreboard, getLiveScoreboardImage } from '@/renders/renderLiveScoreboard';
import { toPlayerInfo, toHand, toAnnotations, toDisplayCards, toNow } from '@/lib/overlayData';

// Gap between the annotation column and the hand stack it follows, matching the
// live overlay page.
const ANNOTATION_HAND_GAP = 50;

// Overlay-appearance config passed into the compositor each frame. Shared by the
// preview (VideoPreview) and export (pipeline) callers.
export interface OverlayConfig {
    overlayStartHidden?: boolean;
    annotationSlots: AnnotationSlot[];
    scoreboard: LiveScoreboardState;
    handStack: LiveHandStackConfig;
    cardDisplay: LiveCardDisplayConfig;
    annotationConfig: LiveAnnotationConfig;
    layers: TimelineLayer[];
}

const VERT_SRC = `
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main() {
    vTexCoord = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Letterboxes video using uVideoRect; alpha-blends overlay on top.
const FRAG_SRC = `
precision mediump float;
uniform sampler2D uVideo;
uniform sampler2D uOverlay;
uniform vec4 uVideoRect;
// Global overlay opacity, driving the HIDE_UI / SHOW_UI fade. Applied here so no
// renderer needs to know about it.
uniform float uOverlayAlpha;
varying vec2 vTexCoord;
void main() {
    vec4 base;
    if (vTexCoord.x >= uVideoRect.x && vTexCoord.x <= uVideoRect.z &&
        vTexCoord.y >= uVideoRect.y && vTexCoord.y <= uVideoRect.w) {
        vec2 videoUV = vec2(
            (vTexCoord.x - uVideoRect.x) / (uVideoRect.z - uVideoRect.x),
            (vTexCoord.y - uVideoRect.y) / (uVideoRect.w - uVideoRect.y)
        );
        base = texture2D(uVideo, videoUV);
    } else {
        base = vec4(0.0, 0.0, 0.0, 1.0);
    }
    vec4 overlay = texture2D(uOverlay, vTexCoord);
    gl_FragColor = mix(base, overlay, overlay.a * uOverlayAlpha);
}
`;

// Returns `prev` when every field matches `fresh`, so callers keep a stable
// object reference across frames while the scoreboard data is unchanged.
function stableInfo(fresh: LivePlayerInfo, prev: LivePlayerInfo | null): LivePlayerInfo {
    if (
        prev &&
        prev.name === fresh.name &&
        prev.deckName === fresh.deckName &&
        prev.standing === fresh.standing &&
        prev.pronouns === fresh.pronouns &&
        prev.life === fresh.life &&
        prev.wins === fresh.wins
    ) {
        return prev;
    }
    return fresh;
}

export class Compositor {
    private gl: WebGLRenderingContext;
    private glCanvas: HTMLCanvasElement | OffscreenCanvas;
    private overlayCanvas: OffscreenCanvas;
    private overlayCtx: OffscreenCanvasRenderingContext2D;
    private program: WebGLProgram;
    private videoTex: WebGLTexture;
    private overlayTex: WebGLTexture;
    private uVideoRect: WebGLUniformLocation;
    private uOverlayAlpha: WebGLUniformLocation;
    private outW: number;
    private outH: number;
    private drawW = 0;
    private drawH = 0;
    private offsetX = 0;
    private offsetY = 0;
    // Cached scoreboard player-info objects, reused by reference while their
    // field values are unchanged. getLiveScoreboardImage's fast path is keyed on
    // reference equality, so stable refs avoid re-parsing the SVG every frame.
    private sbLeft: LivePlayerInfo | null = null;
    private sbRight: LivePlayerInfo | null = null;

    constructor(outWidth: number, outHeight: number, canvas?: HTMLCanvasElement | OffscreenCanvas) {
        this.outW = outWidth;
        this.outH = outHeight;

        this.glCanvas = canvas ?? new OffscreenCanvas(outWidth, outHeight);
        const gl = this.glCanvas.getContext('webgl') as WebGLRenderingContext | null;
        if (!gl) throw new Error('WebGL not available');
        this.gl = gl;

        this.overlayCanvas = new OffscreenCanvas(outWidth, outHeight);
        this.overlayCtx = this.overlayCanvas.getContext('2d')!;

        const vs = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error('Shader link failed: ' + gl.getProgramInfoLog(this.program));
        gl.useProgram(this.program);

        const buf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,   1, -1,   -1,  1,
            -1,  1,   1, -1,    1,  1,
        ]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(this.program, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform1i(gl.getUniformLocation(this.program, 'uVideo'), 0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uOverlay'), 1);
        this.uVideoRect = gl.getUniformLocation(this.program, 'uVideoRect')!;
        this.uOverlayAlpha = gl.getUniformLocation(this.program, 'uOverlayAlpha')!;
        gl.uniform1f(this.uOverlayAlpha, 1);

        this.videoTex = this.createTex(gl.TEXTURE0);
        this.overlayTex = this.createTex(gl.TEXTURE1);

        gl.viewport(0, 0, outWidth, outHeight);
    }

    setLayout(drawW: number, drawH: number, offsetX: number, offsetY: number): void {
        this.drawW = drawW;
        this.drawH = drawH;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.gl.uniform4f(
            this.uVideoRect,
            offsetX / this.outW,
            offsetY / this.outH,
            (offsetX + drawW) / this.outW,
            (offsetY + drawH) / this.outH,
        );
    }

    uploadBlackFrame(): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    }

    uploadVideoElement(videoEl: HTMLVideoElement): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoEl);
    }

    uploadVideoFrame(frame: VideoFrame): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.videoTex);
        // VideoFrame is accepted as TexImageSource in Chrome — uploads GPU→GPU without CPU readback
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame as unknown as TexImageSource);
    }

    updateOverlay(
        players: Player[],
        time: number,
        eyeImg: HTMLImageElement | null,
        config: OverlayConfig,
        onScoreboardReady: () => void = () => {},
    ): void {
        const { overlayCtx, overlayCanvas, gl } = this;
        const { drawW, drawH, offsetX, offsetY, outW, outH } = this;

        overlayCtx.clearRect(0, 0, outW, outH);

        const playerStates = players.map((p) => derivePlayerState(p, p.track.events, time));
        const ctx2d = overlayCtx as unknown as CanvasRenderingContext2D;
        const now = toNow(time);

        // HIDE_UI / SHOW_UI fades the whole overlay via the shader uniform, so no
        // renderer needs to know about it.
        gl.useProgram(this.program);
        gl.uniform1f(this.uOverlayAlpha, deriveUIVisibility(players, time, config.overlayStartHidden));

        // Hands are synthesized first: annotations with `follow` pin themselves
        // above the rendered hand stack.
        const hands = players.map((p, i) =>
            toHand(p, time, config.handStack[i === 0 ? 'left' : 'right'], i === 0 ? 'left' : 'right'),
        );
        const leftHand = hands[0]?.cards ?? [];
        const rightHand = hands[1]?.cards ?? [];
        const handAnims = new Map([...(hands[0]?.anims ?? []), ...(hands[1]?.anims ?? [])]);

        const drawScoreboard = () => {
            if (!playerStates[0]) return;
            this.sbLeft = stableInfo(toPlayerInfo(playerStates[0]), this.sbLeft);
            const leftInfo = this.sbLeft;
            if (playerStates[1]) {
                this.sbRight = stableInfo(toPlayerInfo(playerStates[1]), this.sbRight);
            }
            const rightInfo = playerStates[1] ? this.sbRight! : leftInfo;
            const sb = config.scoreboard;
            const drawOne = (slot: string, cfg: SingleScoreboardConfig) => {
                if (!cfg.svg) return;
                const img = getLiveScoreboardImage(slot, cfg.svg, cfg.fieldMappings, leftInfo, rightInfo, onScoreboardReady);
                if (!img) return;
                renderLiveScoreboard(ctx2d, img, cfg.anchor, cfg.scale, cfg.offset, outW, outH);
            };
            if (sb.mode === 'shared') drawOne('shared', sb.shared);
            else {
                drawOne('left', sb.left);
                drawOne('right', sb.right);
            }
        };

        const drawLayer: Record<LiveLayerId, () => void> = {
            scoreboard: drawScoreboard,
            hand: () =>
                renderLiveHand(ctx2d, leftHand, rightHand, offsetX, offsetY, drawW, drawH, config.handStack, handAnims, now, eyeImg),
            annotations: () => {
                const { annotations, anims } = toAnnotations(players, time, config.annotationSlots, {
                    left: config.annotationConfig.left.insert === 'prepend',
                    right: config.annotationConfig.right.insert === 'prepend',
                });
                renderLiveAnnotations(
                    ctx2d,
                    annotations,
                    offsetX,
                    offsetY,
                    drawW,
                    drawH,
                    config.annotationConfig,
                    {
                        anchorBottomY: {
                            left: getHandStackTopY(leftHand, config.handStack.left, offsetY, drawH) - ANNOTATION_HAND_GAP,
                            right: getHandStackTopY(rightHand, config.handStack.right, offsetY, drawH) - ANNOTATION_HAND_GAP,
                        },
                        stripW: {
                            left: config.handStack.left.cardStripWidth,
                            right: config.handStack.right.cardStripWidth,
                        },
                    },
                    anims,
                    now,
                );
            },
            cardDisplay: () => {
                const d = toDisplayCards(players, time, {
                    left: config.cardDisplay.left.animation,
                    right: config.cardDisplay.right.animation,
                });
                renderLiveCardDisplay(
                    ctx2d,
                    d.left,
                    d.right,
                    offsetX,
                    offsetY,
                    drawW,
                    drawH,
                    {
                        left: config.handStack.left.cardStripWidth,
                        right: config.handStack.right.cardStripWidth,
                    },
                    config.cardDisplay,
                    d.anims,
                    now,
                    d.frontSide,
                );
            },
        };

        // Paint overlay layers bottom -> top per the configured order, skipping
        // hidden ones and the base video (handled by the caller's texture upload).
        for (const layer of config.layers) {
            if (!layer.visible || layer.id === 'video') continue;
            drawLayer[layer.id]?.();
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.overlayTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, overlayCanvas);
    }

    draw(): void {
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    compose(timestamp: number, duration: number): VideoFrame {
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        return new VideoFrame(this.glCanvas as OffscreenCanvas, { timestamp, duration });
    }

    dispose(): void {
        const { gl } = this;
        gl.deleteTexture(this.videoTex);
        gl.deleteTexture(this.overlayTex);
        gl.deleteProgram(this.program);
    }

    private compileShader(type: number, src: string): WebGLShader {
        const { gl } = this;
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(sh));
        return sh;
    }

    private createTex(unit: number): WebGLTexture {
        const { gl } = this;
        gl.activeTexture(unit);
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return tex;
    }
}
