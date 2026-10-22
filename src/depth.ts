// The background: one photo and its grayscale depth map. Every pixel is
// shifted toward the cursor in proportion to its depth, so near things
// (the flowers) slide more than far ones (the sky) and the scene reads as 3D.
// Settings match the reference page: x 7 %, y 10 %, motion depth 0.5,
// smoothing 0.08 per frame, no zoom, and the scene stays where the cursor
// left it.

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uColorMap;
uniform sampler2D uDepthMap;
uniform vec2 uMouse;        // smoothed, -1..1
uniform vec2 uCoverScale;   // aspect-correct "cover" scale
uniform vec2 uFocus;        // crop anchor, as CSS background-position
uniform float uZoom;        // overscan zoom, >= 1.0
uniform vec2 uThreshold;
uniform float uMotionDepth;

void main() {
    vec2 baseUv = uFocus + (vUv - uFocus) * uCoverScale / uZoom;
    float depth = texture2D(uDepthMap, baseUv).r;
    vec2 offset = uMouse * uThreshold * depth * uMotionDepth;
    gl_FragColor = texture2D(uColorMap, baseUv + offset);
}
`;

const X_THRESHOLD = 7;
const Y_THRESHOLD = 10;
const MOTION_DEPTH = 0.5;
const SMOOTHING = 0.08;
const ZOOM = 1;
// The objects on the hill sit left of centre, so narrow screens crop around
// them rather than the middle. Keep in step with .scene's background-position.
const FOCUS: [number, number] = [0.25, 0.5];

export function startDepthScene(canvas: HTMLCanvasElement, area: HTMLElement, image: string, depthMap: string) {
  const gl = canvas.getContext('webgl', { antialias: false }) as WebGLRenderingContext | null;
  if (!gl) return false;
  const program = link(gl, VERTEX, FRAGMENT);
  if (!program) return false;
  gl.useProgram(program);

  const position = gl.getAttribLocation(program, 'aPosition');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uMouse = u('uMouse');
  const uCover = u('uCoverScale');
  gl.uniform1i(u('uColorMap'), 0);
  gl.uniform1i(u('uDepthMap'), 1);
  gl.uniform2f(u('uFocus'), ...FOCUS);
  gl.uniform1f(u('uZoom'), ZOOM);
  gl.uniform2f(u('uThreshold'), (X_THRESHOLD / 100) * 0.3, (Y_THRESHOLD / 100) * 0.3);
  gl.uniform1f(u('uMotionDepth'), MOTION_DEPTH);

  let imageSize: [number, number] = [1, 1];
  let loaded = 0;
  const texture = (unit: number, src: string, onLoad?: (img: HTMLImageElement) => void) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    ]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      onLoad?.(img);
      // Show the canvas only once both maps are in, so the CSS photo
      // underneath covers the gap instead of a black frame.
      if (++loaded === 2) canvas.classList.add('ready');
    };
    img.src = src;
  };
  texture(0, image, (img) => {
    imageSize = [img.naturalWidth, img.naturalHeight];
    cover();
  });
  texture(1, depthMap);

  function cover() {
    const view = canvas.clientWidth / (canvas.clientHeight || 1);
    const img = imageSize[0] / imageSize[1];
    gl!.uniform2f(uCover, ...(view > img ? [1, img / view] : [view / img, 1]) as [number, number]);
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    cover();
  };
  resize();
  new ResizeObserver(resize).observe(canvas);

  let target: [number, number] = [0, 0];
  let current: [number, number] = [0, 0];
  area.addEventListener('pointermove', (event) => {
    const box = area.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    target = [Math.min(Math.max(x, -1), 1), Math.min(Math.max(y, -1), 1)];
  });

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const frame = () => {
    if (!still.matches) {
      current = [
        current[0] + (target[0] - current[0]) * SMOOTHING,
        current[1] + (target[1] - current[1]) * SMOOTHING,
      ];
    }
    gl.uniform2f(uMouse, current[0], current[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return true;
}

export function link(gl: WebGLRenderingContext | WebGL2RenderingContext, vertex: string, fragment: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error(gl.getShaderInfoLog(shader));
    return null;
  };
  const v = compile(gl.VERTEX_SHADER, vertex);
  const f = compile(gl.FRAGMENT_SHADER, fragment);
  if (!v || !f) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, v);
  gl.attachShader(program, f);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  console.error(gl.getProgramInfoLog(program));
  return null;
}
