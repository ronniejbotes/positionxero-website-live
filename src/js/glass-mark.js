/**
 * The glass X (12 November 2026): the light version of the immersive
 * page's WebGL logo, for the package pages. One fragment shader, no
 * three.js. The logo is drawn as a signed distance field and refracts the
 * same 115-degree blueprint lines the hero background is painted with,
 * with a cyan-to-amber edge and a slow moving highlight.
 *
 * Cost control: device pixel ratio capped at 2 (1.5 on touch screens),
 * pixels outside the logo's box return at once, drawing stops when the hero
 * is off screen or the tab is hidden, touch screens draw at 30 frames a
 * second, and reduced motion gets one still frame.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec4 uBox;
uniform float uTime;
uniform vec2 uPointer;
uniform float uDpr;
uniform float uAlpha;
uniform vec2 uPts[13];

float sdPoly(vec2 p) {
  float d = dot(p - uPts[0], p - uPts[0]);
  float s = 1.0;
  for (int i = 0; i < 12; i++) {
    vec2 vi = uPts[i];
    vec2 vj = uPts[i + 1];
    vec2 e = vj - vi;
    vec2 w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bool c1 = p.y >= vi.y;
    bool c2 = p.y < vj.y;
    bool c3 = e.x * w.y > e.y * w.x;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s *= -1.0;
  }
  return s * sqrt(d);
}

float stripes(vec2 q) {
  vec2 dir = vec2(0.9063, 0.4226);
  float v = dot(q, dir) + uTime * 5.0;
  float f = fract(v / 24.0) * 24.0;
  float dist = min(f, 24.0 - f);
  return 1.0 - smoothstep(0.5, 1.6, dist);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float scale = uBox.z / 100.0;
  vec2 p = (px - uBox.xy) / scale;
  if (p.x < -12.0 || p.x > 112.0 || p.y < -12.0 || p.y > 100.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float d = sdPoly(p);
  float aa = 1.0 / scale;
  float e = 0.6;
  vec2 g = vec2(sdPoly(p + vec2(e, 0.0)) - sdPoly(p - vec2(e, 0.0)),
                sdPoly(p + vec2(0.0, e)) - sdPoly(p - vec2(0.0, e))) / (2.0 * e);

  float inside = 1.0 - smoothstep(-aa, aa, d);
  float bevel = 6.5;
  float edge = 1.0 - smoothstep(0.0, bevel, -d);
  vec3 n = normalize(vec3(g * edge * 1.8, 1.0));

  float t = uTime * 0.35;
  vec2 lp = vec2(cos(t), sin(t * 0.8)) * 0.55 + uPointer * 0.6;
  vec3 L = normalize(vec3(lp, 0.85));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);

  vec2 css = px / uDpr;
  vec2 c = (p - vec2(50.0, 44.0)) * scale / uDpr;
  vec2 refr = n.xy * 22.0 - c * 0.10;
  float sr = stripes(css + refr * 1.00);
  float sg = stripes(css + refr * 1.10);
  float sb = stripes(css + refr * 1.22);

  float k = clamp((p.x * 0.6 + p.y) / 140.0, 0.0, 1.0);
  vec3 tint = mix(vec3(0.18, 0.90, 1.0), vec3(1.0, 0.42, 0.12), k);

  vec3 col = vec3(0.025, 0.035, 0.05);
  col += vec3(sr, sg, sb) * 0.42;
  col += tint * edge * 0.38;
  col += vec3(0.9, 0.97, 1.0) * spec * 0.9;
  float rim = 1.0 - smoothstep(0.0, 2.2 * aa, abs(d));
  col += mix(vec3(0.9, 0.98, 1.0), tint, 0.5) * rim * 0.85;

  float a = clamp(inside * 0.9 + rim * 0.7, 0.0, 1.0);
  float glow = exp(-max(d, 0.0) * 0.28) * (1.0 - inside) * 0.22;
  col = col * a + tint * glow;
  a = max(a, glow);
  gl_FragColor = vec4(col * uAlpha, a * uAlpha);
}
`;

// the logo outline, in its own 100 x 88 units, closed (first point repeated)
const PTS = [0, 0, 30, 0, 50, 30, 70, 0, 100, 0, 65, 44, 100, 88, 70, 88, 50, 58, 30, 88, 0, 88, 35, 44, 0, 0];

export function startGlassMark(canvas, markEl) {
  const hero = canvas.closest('.hero') || canvas.parentElement;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(prog, name);
  const uRes = u('uRes');
  const uBox = u('uBox');
  const uTime = u('uTime');
  const uPointer = u('uPointer');
  const uDpr = u('uDpr');
  const uAlpha = u('uAlpha');
  gl.uniform2fv(u('uPts[0]') || u('uPts'), new Float32Array(PTS));
  gl.uniform1f(uAlpha, Number(canvas.dataset.glassStrength || 1));

  const touch = window.matchMedia('(pointer: coarse)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dprCap = touch ? 1.5 : 2;
  let dpr = 1;

  const layout = () => {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const h = hero.getBoundingClientRect();
    const w = Math.max(1, Math.round(h.width * dpr));
    const ht = Math.max(1, Math.round(h.height * dpr));
    if (canvas.width !== w || canvas.height !== ht) { canvas.width = w; canvas.height = ht; }
    gl.viewport(0, 0, w, ht);
    // the SVG sits in a 108 x 96 box with the logo inset by 4 units
    const m = markEl.getBoundingClientRect();
    const unit = m.width / 108;
    const x = (m.left - h.left + 4 * unit) * dpr;
    const y = (m.top - h.top + 4 * unit) * dpr;
    gl.uniform2f(uRes, w, ht);
    gl.uniform4f(uBox, x, y, 100 * unit * dpr, 88 * unit * dpr);
    gl.uniform1f(uDpr, dpr);
  };

  let px = 0; let py = 0; let tx = 0; let ty = 0;
  if (!touch && !reduced) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  let visible = true;
  let raf = 0;
  let last = 0;
  const t0 = performance.now();
  const draw = (now) => {
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    gl.uniform1f(uTime, reduced ? 6.0 : (now - t0) / 1000);
    gl.uniform2f(uPointer, px, -py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (!touch || now - last > 32) { last = now; draw(now); }
    raf = requestAnimationFrame(loop);
  };
  const run = () => { if (!raf && !reduced) raf = requestAnimationFrame(loop); };

  layout();
  draw(performance.now());
  hero.classList.add('is-gl');

  let resizeId = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(() => { layout(); draw(performance.now()); }, 150);
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    visible = false;
    hero.classList.remove('is-gl');
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) run();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  run();
}
