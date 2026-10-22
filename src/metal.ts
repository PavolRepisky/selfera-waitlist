import fragmentBody from './metal.frag.glsl?raw';
import { link } from './depth';

// The logo in the middle of the card, drawn as flowing liquid metal. The
// shader reads a heightmap built from the logo's silhouette: red is a smooth
// "height" that rises from the edges inward (it shapes the bevel), green is
// the inverted alpha, blue the hard mask. Built here the same way the
// reference builds it, so any transparent PNG works as the logo.

// The mobile app's accent (gradients.accent: peach, rose, lavender), laid
// bottom left to top right by the shader; the metal's own shine is worked
// out there.
const COLORS = ['#f7c3a0', '#efa3b7', '#d8c6ee'];
const UNIFORMS: Record<string, number> = {
  u_angle: 20,
  u_bend: 0.24,
  u_contour: 0.8,
  u_motionMode: 0,
  u_scale: 1.2,
  u_seed: 6,
  u_speed: 0.6,
  u_turbAmp: 0.21,
  u_turbFreq: 1.15,
  u_turbIter: 7,
  u_waveFreq: 2.4,
};

const VERTEX = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_uv;
void main() {
    v_uv = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
#define NUM_COLORS 8
uniform vec4 u_colors[NUM_COLORS];
uniform int u_colors_length;
uniform vec4 u_colorBack;
${Object.keys(UNIFORMS).map((name) => `uniform float ${name};`).join('\n')}
uniform sampler2D u_image_heightmap;
uniform sampler2D u_push_buffer;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_deltaTime;
uniform float u_pixelRatio;
`;

export function startMetal(canvas: HTMLCanvasElement, logo: string) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true });
  if (!gl) return false;
  const program = link(gl, VERTEX, HEADER + fragmentBody);
  if (!program) return false;
  gl.useProgram(program);

  const attribute = (name: string, data: number[]) => {
    const at = gl.getAttribLocation(program, name);
    if (at < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  };
  attribute('a_position', [-1, -1, 1, -1, -1, 1, 1, 1]);
  attribute('a_texCoord', [0, 0, 1, 0, 0, 1, 1, 1]);

  const u = (name: string) => gl.getUniformLocation(program, name);
  for (const [name, value] of Object.entries(UNIFORMS)) gl.uniform1f(u(name), value);
  const palette = new Float32Array(8 * 4);
  COLORS.forEach((hex, i) => palette.set([...rgb(hex), 1], i * 4));
  gl.uniform4fv(u('u_colors'), palette);
  gl.uniform1i(u('u_colors_length'), COLORS.length);
  gl.uniform4f(u('u_colorBack'), 1, 1, 1, 0);

  // The cursor push is off in the reference, so its buffer is a still,
  // empty field.
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(u('u_push_buffer'), 1);
  gl.uniform1i(u('u_image_heightmap'), 0);

  const uTime = u('u_time');
  const uDelta = u('u_deltaTime');
  const uResolution = u('u_resolution');
  const uPixelRatio = u('u_pixelRatio');

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uPixelRatio, dpr);
  };

  let visible = true;
  let ready = false;
  let start = 0;
  let last = 0;
  let queued = false;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const frame = (now: number) => {
    queued = false;
    if (!start) start = last = now;
    gl.uniform1f(uTime, still.matches ? 0 : (now - start) / 1000);
    gl.uniform1f(uDelta, (now - last) / 1000);
    last = now;
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (visible && !still.matches) tick();
  };
  const tick = () => {
    if (ready && !queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  };

  const img = new Image();
  img.onload = () => {
    const map = heightmap(img);
    if (!map) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
    resize();
    ready = true;
    canvas.classList.add('ready');
    tick();
  };
  img.src = logo;

  new ResizeObserver(() => { resize(); tick(); }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    tick();
  }).observe(canvas);
  still.addEventListener('change', tick);
  return true;
}

// Silhouette → heightmap. The alpha mask is shrunk to ~1024 px, its inside
// gets a smooth dome from an over-relaxed Poisson solve (50 red/black
// passes), and the result is scaled back to the image's own size.
function heightmap(image: HTMLImageElement) {
  const LIMIT = 1024;
  let scale = LIMIT / Math.min(image.naturalWidth, image.naturalHeight);
  const area = image.naturalWidth * scale * (image.naturalHeight * scale);
  if (area > LIMIT * LIMIT) scale *= Math.sqrt((LIMIT * LIMIT) / area);
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));

  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(image, 0, 0, w, h);
  const pixels = sctx.getImageData(0, 0, w, h).data;
  const n = w * h;

  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = pixels[i * 4 + 3] > 0 ? 1 : 0;

  // Only pixels with no background neighbour take part in the solve, so
  // the edge stays pinned at zero.
  const inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) continue;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++)
      for (let dx = -1; dx <= 1 && !edge; dx++)
        if ((dx || dy) && !mask[(y + dy) * w + x + dx]) edge = true;
    if (!edge) inside[i] = 1;
  }

  const height = new Float32Array(n);
  const red: number[] = [];
  const black: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!inside[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    ((x + y) % 2 === 0 ? red : black).push(
      i, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1,
    );
  }
  const OMEGA = 1.95;
  const SOURCE = 0.01;
  const relax = (cells: Int32Array) => {
    for (let k = 0; k < cells.length; k += 5) {
      const s = (j: number) => (j >= 0 ? height[j] : 0);
      height[cells[k]] = (1 - OMEGA) * height[cells[k]]
        + (OMEGA / 4) * (SOURCE + s(cells[k + 1]) + s(cells[k + 2]) + s(cells[k + 3]) + s(cells[k + 4]));
    }
  };
  const r = Int32Array.from(red);
  const b = Int32Array.from(black);
  for (let pass = 0; pass < 50; pass++) {
    relax(r);
    relax(b);
  }

  let max = 0;
  for (let i = 0; i < n; i++) if (height[i] > max) max = height[i];
  const out = sctx.createImageData(w, h);
  for (let i = 0; i < n; i++) {
    out.data[i * 4] = Math.round((max > 0 ? height[i] / max : 0) * 255);
    out.data[i * 4 + 1] = 255 - pixels[i * 4 + 3];
    out.data[i * 4 + 2] = mask[i] ? 255 : 0;
    out.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(out, 0, 0);

  const full = document.createElement('canvas');
  full.width = image.naturalWidth;
  full.height = image.naturalHeight;
  const fctx = full.getContext('2d');
  if (!fctx) return null;
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(small, 0, 0, full.width, full.height);
  return full;
}

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
