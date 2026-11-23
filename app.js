/* Ten Print — UI, image sampling and the p5.js sketch. */
(() => {
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = {
    pattern: 'slash',
    across: 48,
    weight: 14,       // % of a tile
    cap: 'round',
    influence: 30,    // %
    toneWeight: 90,   // %
    contrast: 30,
    cutoff: 100,
    underlay: 0,
    invert: false,
    balance: 0,
    seed: 1982,
    colorMode: 'ink',
    bg: '#fbfaf7',
    ink: '#141414',
    ink2: '#1b6c80',
    size: '1600',
  };

  const PRESETS = [
    { name: 'Paper', bg: '#fbfaf7', ink: '#141414', ink2: '#1b6c80' },
    { name: 'Blueprint', bg: '#16466d', ink: '#eef4f8', ink2: '#8fc1e3' },
    { name: 'Riso', bg: '#f3efe4', ink: '#e0457b', ink2: '#2364aa' },
    { name: 'Night', bg: '#121212', ink: '#f1efe8', ink2: '#e2b33c' },
    { name: 'Moss', bg: '#e7ebdd', ink: '#2c4a2a', ink2: '#9a6b1f' },
  ];

  const STORE_KEY = 'tenprint:v1';
  let state = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') state = { ...DEFAULTS, ...saved };
  } catch (_) { /* storage unavailable: defaults are fine */ }
  if (!PATTERNS.some((p) => p.id === state.pattern)) state.pattern = DEFAULTS.pattern;

  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) {} };

  /* ---------- Source image ---------- */
  let source = makeSample();           // a canvas, never the raw file
  let sourceName = 'Sample sphere';
  let isSample = true;
  let field = null, fieldKey = '';

  function makeSample() {
    // A lit sphere drawn in stepped greys, with a bold numeral knocked out: enough tone for every pattern to read.
    const S = 800, c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
    const cx = S * 0.5, cy = S * 0.53, R = S * 0.36;
    // soft floor shadow
    for (let k = 0; k < 24; k++) {
      const t = k / 23;
      g.fillStyle = `rgb(${Math.round(242 - 90 * t)},${Math.round(242 - 90 * t)},${Math.round(242 - 90 * t)})`;
      g.beginPath(); g.ellipse(cx + 40, cy + R * 0.98, R * (1.05 - 0.55 * t), R * (0.22 - 0.12 * t), 0, 0, Math.PI * 2); g.fill();
    }
    // sphere: concentric circles from dark rim toward a light point up-left
    const steps = 64;
    for (let k = 0; k < steps; k++) {
      const t = k / (steps - 1);
      const r = R * (1 - t * 0.92);
      const ox = -R * 0.38 * t, oy = -R * 0.4 * t;
      const lum = Math.round(28 + 220 * Math.pow(t, 1.3));
      g.fillStyle = `rgb(${lum},${lum},${lum})`;
      g.beginPath(); g.arc(cx + ox, cy + oy, r, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  function fitCanvas(img, max = 2400) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    c._natural = { w, h };
    return c;
  }

  async function loadFile(file) {
    const err = $('fileError');
    err.hidden = true;
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      err.textContent = `“${file.name}” isn't an image. Try a PNG, JPG or WebP.`;
      err.hidden = false;
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      source = fitCanvas(img);
      URL.revokeObjectURL(url);
      sourceName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'Pasted image';
      isSample = false;
      fieldKey = '';
      updateSourceUI();
      schedule();
      toast('Image loaded');
    } catch (e) {
      err.textContent = "Couldn't read that file. Try a PNG, JPG or WebP.";
      err.hidden = false;
    }
  }

  function updateSourceUI() {
    $('srcName').textContent = sourceName;
    $('docName').textContent = sourceName;
    const nat = source._natural || { w: source.width, h: source.height };
    $('srcMeta').textContent = `${nat.w.toLocaleString()} × ${nat.h.toLocaleString()} px`;
    $('sampleBtn').hidden = isSample;
    const t = $('srcThumb'), g = t.getContext('2d');
    g.clearRect(0, 0, t.width, t.height);
    const k = Math.max(t.width / source.width, t.height / source.height);
    const w = source.width * k, h = source.height * k;
    g.imageSmoothingQuality = 'high';
    g.drawImage(source, (t.width - w) / 2, (t.height - h) / 2, w, h);
    document.title = `${sourceName} · Ten Print`;
  }

  /* ---------- Geometry and tone field ---------- */
  function dims() {
    const L = parseInt(state.size, 10);
    const sw = source.width, sh = source.height;
    const W = sw >= sh ? L : Math.round((L * sw) / sh);
    const H = sw >= sh ? Math.round((L * sh) / sw) : L;
    return { W, H };
  }

  function getField(W, H) {
    const s = W / state.across;
    const cols = state.across;
    const rows = Math.max(1, Math.ceil(H / s - 1e-6));
    const key = [cols, rows, W, H, state.contrast, state.invert, source.width, source.height, sourceName].join('|');
    if (key === fieldKey && field) return field;
    const c = document.createElement('canvas');
    c.width = cols; c.height = rows;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    // The image fills H/s rows; any overhang of the last row reads as paper.
    g.drawImage(source, 0, 0, source.width, source.height, 0, 0, cols, H / s);
    const data = g.getImageData(0, 0, cols, rows).data;
    const n = cols * rows;
    const v = new Float32Array(n), rgb = new Uint8ClampedArray(n * 3);
    const cf = Math.pow(1 + state.contrast / 100, 2);   // 0 … 4
    for (let i = 0; i < n; i++) {
      const r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
      let lum = ((0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255) * a + (1 - a);
      lum = (lum - 0.5) * cf + 0.5;
      lum = lum < 0 ? 0 : lum > 1 ? 1 : lum;
      if (state.invert) lum = 1 - lum;
      v[i] = lum;
      rgb[i * 3] = r; rgb[i * 3 + 1] = gg; rgb[i * 3 + 2] = b;
    }
    field = { cols, rows, s, v, rgb };
    fieldKey = key;
    return field;
  }

  function renderOptions() {
    return {
      influence: state.influence / 100,
      toneWeight: state.toneWeight / 100,
      cutoff: state.cutoff >= 100 ? 2 : state.cutoff / 100,
      balance: state.balance / 100,
      weight: state.weight / 100,
      seed: state.seed | 0,
      colorMode: state.colorMode,
      ink: state.ink,
      ink2: state.ink2,
    };
  }

  const currentPattern = () => PATTERNS.find((p) => p.id === state.pattern);

  /* ---------- p5.js sketch ---------- */
  let comparing = false;
  let lastTiles = 0;
  let pInst = null;

  const sketch = (p) => {
    p.setup = () => {
      const { W, H } = dims();
      p.createCanvas(W, H);
      p.pixelDensity(1);
      p.noLoop();
      p.canvas.setAttribute('role', 'img');
      p.canvas.setAttribute('aria-label', 'Generated pattern');
    };
    p.draw = () => {
      const { W, H } = dims();
      if (p.width !== W || p.height !== H) p.resizeCanvas(W, H, true);
      p.background(comparing ? '#ffffff' : state.bg);
      const ctx = p.drawingContext;
      if (comparing) {
        ctx.drawImage(source, 0, 0, W, H);
        return;
      }
      if (state.underlay > 0) {
        ctx.save(); ctx.globalAlpha = state.underlay / 100;
        ctx.drawImage(source, 0, 0, W, H);
        ctx.restore();
      }
      const capMap = { round: p.ROUND, butt: p.SQUARE, square: p.PROJECT };
      p.strokeCap(capMap[state.cap] || p.ROUND);
      p.noFill();
      const P = currentPattern();
      if (P.fill) p.noStroke();
      const F = getField(W, H);
      lastTiles = renderPattern(p5Pen(p), P, F, renderOptions());
      updateReadouts(W, H, F);
    };
  };

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (pInst) pInst.redraw();
      save();
    });
  }

  function updateReadouts(W, H, F) {
    $('tileCount').textContent = `${lastTiles.toLocaleString()} tiles`;
    $('dims').textContent = `${F.cols} × ${F.rows} grid · ${W.toLocaleString()} × ${H.toLocaleString()} px`;
  }

  /* ---------- Pattern picker ---------- */
  function buildPatterns() {
    const host = $('patterns');
    host.innerHTML = '';
    PATTERNS.forEach((P, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pat';
      b.setAttribute('role', 'radio');
      b.dataset.id = P.id;
      b.title = `${P.name} (${idx + 1})`;
      b.innerHTML = `<canvas width="104" height="104" aria-hidden="true"></canvas>
        <span><span class="pat-name">${P.name}</span><span class="pat-rule">${P.rule}</span></span>`;
      b.addEventListener('click', () => setPattern(P.id, true));
      b.addEventListener('keydown', (e) => {
        const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const next = PATTERNS[(idx + dir + PATTERNS.length) % PATTERNS.length];
        setPattern(next.id, true);
      });
      host.appendChild(b);
    });
    drawThumbs();
  }

  function drawThumbs() {
    const sample = thumbField();
    document.querySelectorAll('.pat').forEach((b) => {
      const P = PATTERNS.find((x) => x.id === b.dataset.id);
      const c = b.querySelector('canvas'), g = c.getContext('2d');
      g.fillStyle = state.bg; g.fillRect(0, 0, c.width, c.height);
      g.lineCap = state.cap;
      const o = { ...renderOptions(), influence: 0, toneWeight: 0, cutoff: 2, weight: P.fill ? 0.1 : 0.14 };
      if (o.colorMode === 'image') o.colorMode = 'ink';
      renderPattern(ctxPen(g), P, sample, o);
    });
  }

  function thumbField() {
    const cols = 8, rows = 8, n = cols * rows;
    const v = new Float32Array(n).fill(0.5), rgb = new Uint8ClampedArray(n * 3);
    return { cols, rows, s: 104 / 8, v, rgb };
  }

  function setPattern(id, focus) {
    state.pattern = id;
    document.querySelectorAll('.pat').forEach((b) => {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    const P = currentPattern();
    $('ruleLine').innerHTML = P.code
      ? `<code>${P.code}</code>`
      : `${P.name}: ${P.rule.charAt(0).toLowerCase() + P.rule.slice(1)}.`;
    const wf = $('weightField');
    wf.classList.toggle('is-off', P.fill);
    $('weight').disabled = P.fill;
    $('weightNote').hidden = !P.fill;
    $('capField').disabled = P.fill;
    $('capField').classList.toggle('is-off', P.fill);
    schedule();
  }

  /* ---------- Controls ---------- */
  const RANGES = ['across', 'weight', 'influence', 'toneWeight', 'contrast', 'cutoff', 'underlay', 'balance'];
  const fmt = {
    across: (v) => `${v}`,
    weight: (v) => `${v}%`,
    influence: (v) => `${v}%`,
    toneWeight: (v) => `${v}%`,
    contrast: (v) => (v > 0 ? `+${v}` : `${v}`),
    cutoff: (v) => (v >= 100 ? 'Keep all' : `${v}%`),
    underlay: (v) => (v === 0 ? 'Off' : `${v}%`),
    balance: (v) => (v === 0 ? 'Even' : v > 0 ? `+${v}` : `${v}`),
  };

  function syncControls() {
    RANGES.forEach((k) => { $(k).value = state[k]; $('o-' + k).textContent = fmt[k](+state[k]); });
    $('invert').checked = !!state.invert;
    $('seed').value = state.seed;
    $('size').value = state.size;
    $('bg').value = state.bg; $('ink').value = state.ink; $('ink2').value = state.ink2;
    document.querySelectorAll('input[name="cap"]').forEach((r) => { r.checked = r.value === state.cap; });
    document.querySelectorAll('input[name="colorMode"]').forEach((r) => { r.checked = r.value === state.colorMode; });
    syncColourUI();
  }

  function syncColourUI() {
    $('ink2Wrap').classList.toggle('is-off', state.colorMode !== 'two');
    $('ink').closest('.swatch').classList.toggle('is-off', state.colorMode === 'image');
    document.querySelectorAll('.preset').forEach((b) => {
      const P = PRESETS[+b.dataset.i];
      b.setAttribute('aria-pressed', String(P.bg === state.bg && P.ink === state.ink && P.ink2 === state.ink2));
    });
  }

  function buildPresets() {
    const host = $('presets');
    PRESETS.forEach((P, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.dataset.i = i;
      b.setAttribute('aria-label', `${P.name} colours`);
      b.title = P.name;
      b.innerHTML = `<svg viewBox="0 0 40 40" preserveAspectRatio="none" aria-hidden="true">
        <rect width="40" height="40" fill="${P.bg}"/>
        <path d="M-2 22 18 2M10 42 42 10" stroke="${P.ink}" stroke-width="5" stroke-linecap="round"/>
        <path d="M22 42 42 22" stroke="${P.ink2}" stroke-width="5" stroke-linecap="round"/></svg>`;
      b.addEventListener('click', () => {
        state.bg = P.bg; state.ink = P.ink; state.ink2 = P.ink2;
        syncControls(); drawThumbs(); schedule();
      });
      host.appendChild(b);
    });
  }

  function bindControls() {
    RANGES.forEach((k) => {
      const el = $(k);
      el.addEventListener('input', () => {
        state[k] = +el.value;
        $('o-' + k).textContent = fmt[k](state[k]);
        schedule();
      });
      el.addEventListener('dblclick', () => {
        state[k] = DEFAULTS[k]; el.value = state[k];
        $('o-' + k).textContent = fmt[k](state[k]);
        schedule();
      });
      el.title = 'Double-click to reset';
    });
    $('invert').addEventListener('change', (e) => { state.invert = e.target.checked; schedule(); });
    $('seed').addEventListener('input', (e) => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isNaN(n)) { state.seed = Math.max(0, Math.min(999999, n)); schedule(); }
    });
    $('size').addEventListener('change', (e) => { state.size = e.target.value; schedule(); });
    document.querySelectorAll('input[name="cap"]').forEach((r) => r.addEventListener('change', () => { state.cap = r.value; drawThumbs(); schedule(); }));
    document.querySelectorAll('input[name="colorMode"]').forEach((r) => r.addEventListener('change', () => { state.colorMode = r.value; syncColourUI(); drawThumbs(); schedule(); }));
    ['bg', 'ink', 'ink2'].forEach((k) => $(k).addEventListener('input', (e) => { state[k] = e.target.value; syncColourUI(); drawThumbs(); schedule(); }));
    $('controls').addEventListener('submit', (e) => e.preventDefault());

    $('seedBtn').addEventListener('click', reroll);
    $('shuffleBtn').addEventListener('click', shuffleAll);
    $('resetBtn').addEventListener('click', () => {
      const keep = { pattern: state.pattern };
      state = { ...DEFAULTS, ...keep };
      syncControls(); drawThumbs(); setPattern(state.pattern); schedule();
      toast('Variations reset');
    });

    $('fileInput').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
    $('sampleBtn').addEventListener('click', () => {
      source = makeSample(); sourceName = 'Sample sphere'; isSample = true; fieldKey = '';
      $('fileError').hidden = true;
      updateSourceUI(); schedule();
    });

    $('pngBtn').addEventListener('click', exportPNG);
    $('svgBtn').addEventListener('click', exportSVG);

    // Compare: hold the button, or hold C
    const cmp = $('compareBtn');
    const on = () => { if (!comparing) { comparing = true; cmp.setAttribute('aria-pressed', 'true'); schedule(); } };
    const off = () => { if (comparing) { comparing = false; cmp.setAttribute('aria-pressed', 'false'); schedule(); } };
    cmp.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => cmp.addEventListener(ev, off));
    cmp.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); on(); } });
    cmp.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') off(); });

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'radio' && e.target.type !== 'checkbox';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportPNG(); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // Space shuffles everywhere except where it has its own job (the compare button, text fields).
      if (e.key === ' ' && e.target.id !== 'compareBtn' && e.target.type !== 'checkbox') { e.preventDefault(); if (!e.repeat) shuffleAll(); return; }
      if (k === 'r') { reroll(); }
      else if (k === 'c' && !e.repeat) { on(); }
      else if (/^[1-9]$/.test(k) && PATTERNS[+k - 1]) { setPattern(PATTERNS[+k - 1].id); }
    });
    document.addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'c') off(); });

    // Drag and drop anywhere, paste from clipboard
    let depth = 0;
    const veil = $('dropVeil');
    window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; veil.hidden = false; e.preventDefault(); } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) veil.hidden = true; });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; veil.hidden = true;
      loadFile(e.dataTransfer.files[0]);
    });
    window.addEventListener('paste', (e) => {
      const item = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith('image/'));
      if (item) { const f = item.getAsFile(); if (f) loadFile(new File([f], 'Pasted image.png', { type: f.type })); }
    });
  }
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

  function reroll() {
    state.seed = Math.floor(Math.random() * 999999);
    $('seed').value = state.seed;
    schedule();
  }

  /* Space: a new seed plus fresh variations, kept inside ranges that always read well.
     Pattern, colours, output size, cut-off and underlay stay as the user set them. */
  const SHUFFLE_RANGES = {
    across: [16, 120],
    weight: [6, 30],
    influence: [0, 80],
    toneWeight: [40, 100],
    contrast: [-10, 60],
    balance: [-20, 20],
  };
  function shuffleAll() {
    for (const [k, [lo, hi]] of Object.entries(SHUFFLE_RANGES)) {
      state[k] = Math.round(lo + Math.random() * (hi - lo));
    }
    state.seed = Math.floor(Math.random() * 999999);
    syncControls();
    schedule();
    toast(`Seed ${state.seed} · ${state.across} tiles across`);
  }

  /* ---------- Export ---------- */
  const fileBase = () => `${sourceName.replace(/[^\w-]+/g, '-').toLowerCase()}-${state.pattern}-${state.seed}`;

  function exportPNG() {
    if (!pInst) return;
    if (comparing) { comparing = false; pInst.redraw(); }
    pInst.saveCanvas(fileBase(), 'png');
    toast('PNG saved');
  }

  function exportSVG() {
    const { W, H } = dims();
    const pen = svgPen();
    const P = currentPattern();
    renderPattern(pen, P, getField(W, H), renderOptions());
    const svg = pen.toString(W, H, state.bg, state.cap);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase()}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(state.underlay > 0 ? 'SVG saved (without the source underlay)' : 'SVG saved');
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- Start ---------- */
  buildPresets();
  buildPatterns();
  syncControls();
  setPattern(state.pattern);
  updateSourceUI();
  bindControls();

  if (typeof p5 === 'undefined') {
    $('ruleLine').textContent = "p5.js didn't load. Check your connection and reload.";
  } else {
    pInst = new p5(sketch, $('canvasHost'));
  }
})();
