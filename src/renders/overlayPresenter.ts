// GPU present path for the live overlay. All overlay content is rendered on a
// 2D offscreen canvas, then uploaded as a texture and drawn as a single
// fullscreen quad onto the visible WebGL canvas. This mirrors the timeline
// compositor (compose.ts): the expensive per-frame cost of a full-screen
// transparent 2D canvas present is what made the live overlay choppier than
// the timeline preview, even though both do the same 2D rasterization.
//
// The context keeps a real alpha channel (transparent background) so OBS
// Browser/Window Capture still composites the overlay over the scene.

const VERT_SRC = `
attribute vec2 aPosition;
varying vec2 vTexCoord;
void main() {
    vTexCoord = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vTexCoord;
void main() {
    gl_FragColor = texture2D(uTex, vTexCoord);
}
`;

export class OverlayPresenter {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram;
    private tex: WebGLTexture;

    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        const gl = canvas.getContext('webgl', {
            alpha: true,
            premultipliedAlpha: true,
            antialias: false,
            depth: false,
            stencil: false,
        }) as WebGLRenderingContext | null;
        if (!gl) throw new Error('WebGL not available');
        this.gl = gl;

        const vs = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
        this.program = gl.createProgram()!;
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw new Error(
                'Shader link failed: ' + gl.getProgramInfoLog(this.program)
            );
        gl.useProgram(this.program);

        const buf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );
        const aPos = gl.getAttribLocation(this.program, 'aPosition');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uTex'), 0);

        // Source canvas holds straight-alpha pixels; premultiply on upload so it
        // matches the premultipliedAlpha:true drawing buffer.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

        gl.activeTexture(gl.TEXTURE0);
        this.tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
    }

    present(source: HTMLCanvasElement): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            source
        );
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    dispose(): void {
        const { gl } = this;
        gl.deleteTexture(this.tex);
        gl.deleteProgram(this.program);
    }

    private compileShader(type: number, src: string): WebGLShader {
        const { gl } = this;
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            throw new Error(
                'Shader compile failed: ' + gl.getShaderInfoLog(sh)
            );
        return sh;
    }
}
