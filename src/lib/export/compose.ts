import type { Player } from '@/components/types/player';
import { derivePlayerState, getActiveWindowedEvents } from '@/lib/deriveState';
import { renderPlayerState } from '@/renders/renderPlayerState';
import { renderHandStack } from '@/renders/renderHandStack';
import { ensureImage } from '@/lib/cardCache';

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
    gl_FragColor = mix(base, overlay, overlay.a);
}
`;

export class Compositor {
    private gl: WebGLRenderingContext;
    private glCanvas: HTMLCanvasElement | OffscreenCanvas;
    private overlayCanvas: OffscreenCanvas;
    private overlayCtx: OffscreenCanvasRenderingContext2D;
    private program: WebGLProgram;
    private videoTex: WebGLTexture;
    private overlayTex: WebGLTexture;
    private uVideoRect: WebGLUniformLocation;
    private outW: number;
    private outH: number;
    private drawW = 0;
    private drawH = 0;
    private offsetX = 0;
    private offsetY = 0;

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
        d20Img: HTMLImageElement | null,
        eyeImg: HTMLImageElement | null,
    ): void {
        const { overlayCtx, overlayCanvas, gl } = this;
        const { drawW, drawH, offsetX, offsetY, outW, outH } = this;

        overlayCtx.clearRect(0, 0, outW, outH);

        const playerStates = players.map((p) => derivePlayerState(p, p.track.events, time));
        const activeEvents = players.map((p) => getActiveWindowedEvents(p.track.events, time));

        const ctx2d = overlayCtx as unknown as CanvasRenderingContext2D;
        renderPlayerState(ctx2d, playerStates, offsetX, offsetY, drawW, drawH, d20Img);
        renderHandStack(ctx2d, playerStates, offsetX, offsetY, drawW, drawH, eyeImg);

        const cardH = drawH * 0.5;
        const cardW = cardH * (223 / 310);
        let cardOffset = 0;
        activeEvents.forEach((events) => {
            events.forEach((event) => {
                const card = event.meta?.cards?.[0];
                if (!card?.name) return;
                const cached = ensureImage(card.name, card.edition);
                if (cached === 'loading' || cached === 'error') return;
                const cardX = offsetX + drawW / 2 - cardW / 2 + cardOffset * (cardW + 8);
                const cardY = offsetY + drawH / 2 - cardH / 2;
                overlayCtx.save();
                overlayCtx.beginPath();
                overlayCtx.roundRect(cardX, cardY, cardW, cardH, 20);
                overlayCtx.clip();
                overlayCtx.drawImage(cached, cardX, cardY, cardW, cardH);
                overlayCtx.restore();
                cardOffset++;
            });
        });

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
        gl.getExtension('WEBGL_lose_context')?.loseContext();
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
