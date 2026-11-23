/* Ten Print — pattern definitions and pens.
   Every pattern draws one cell through a "pen", so the same code renders
   to the p5 canvas, to the small picker previews and to SVG export. */

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;

/* Stable random per cell: changing a slider never reshuffles the layout. */
function cellRand(i, j, seed, salt = 0) {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(j + 1, 668265263) ^ Math.imul(seed + 7 + salt * 911, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const PATTERNS = [
  {
    id: 'slash',
    name: '10 PRINT',
    rule: 'Each cell is one diagonal, ╱ or ╲',
    code: '10 PRINT CHR$(205.5+RND(1)); : GOTO 10',
    states: 2,
    fill: false,
    tile(pen, x, y, s, k, w, c) {
      if (k === 0) pen.line(x, y + s, x + s, y, w, c);
      else pen.line(x, y, x + s, y + s, w, c);
    },
  },
  {
    id: 'arcs',
    name: 'Truchet arcs',
    rule: 'Two quarter circles meet at the edge midpoints',
    states: 2,
    fill: false,
    tile(pen, x, y, s, k, w, c) {
      const r = s / 2;
      if (k === 0) {
        pen.arc(x, y, r, 0, HALF, w, c);
        pen.arc(x + s, y + s, r, Math.PI, Math.PI * 1.5, w, c);
      } else {
        pen.arc(x + s, y, r, HALF, Math.PI, w, c);
        pen.arc(x, y + s, r, Math.PI * 1.5, TAU, w, c);
      }
    },
  },
  {
    id: 'weave',
    name: 'Double arcs',
    rule: 'Truchet with two lanes, so the paths braid',
    states: 2,
    fill: false,
    tile(pen, x, y, s, k, w, c) {
      const a = s / 3, b = (2 * s) / 3;
      if (k === 0) {
        pen.arc(x, y, a, 0, HALF, w, c); pen.arc(x, y, b, 0, HALF, w, c);
        pen.arc(x + s, y + s, a, Math.PI, Math.PI * 1.5, w, c); pen.arc(x + s, y + s, b, Math.PI, Math.PI * 1.5, w, c);
      } else {
        pen.arc(x + s, y, a, HALF, Math.PI, w, c); pen.arc(x + s, y, b, HALF, Math.PI, w, c);
        pen.arc(x, y + s, a, Math.PI * 1.5, TAU, w, c); pen.arc(x, y + s, b, Math.PI * 1.5, TAU, w, c);
      }
    },
  },
  {
    id: 'triangles',
    name: 'Half squares',
    rule: 'A filled triangle in one of four corners',
    states: 4,
    fill: true,
    tile(pen, x, y, s, k, w, c, m) {
      const d = s * Math.min(1, m);
      if (d < 0.4) return;
      if (k === 0) pen.tri(x, y, x + d, y, x, y + d, c);
      else if (k === 1) pen.tri(x + s, y, x + s - d, y, x + s, y + d, c);
      else if (k === 2) pen.tri(x + s, y + s, x + s - d, y + s, x + s, y + s - d, c);
      else pen.tri(x, y + s, x + d, y + s, x, y + s - d, c);
    },
  },
  {
    id: 'maze',
    name: 'Right-angle maze',
    rule: 'Each cell walls its top or its left side',
    states: 2,
    fill: false,
    tile(pen, x, y, s, k, w, c) {
      if (k === 0) pen.line(x, y, x + s, y, w, c);
      else pen.line(x, y, x, y + s, w, c);
    },
  },
  {
    id: 'fourway',
    name: 'Four strokes',
    rule: 'One of ╱ ╲ │ ─ in every cell',
    states: 4,
    fill: false,
    tile(pen, x, y, s, k, w, c) {
      const h = s / 2;
      if (k === 0) pen.line(x, y + s, x + s, y, w, c);
      else if (k === 1) pen.line(x, y, x + s, y + s, w, c);
      else if (k === 2) pen.line(x + h, y, x + h, y + s, w, c);
      else pen.line(x, y + h, x + s, y + h, w, c);
    },
  },
  {
    id: 'stitch',
    name: 'Hitomezashi',
    rule: 'Running stitches, one coin toss per row and column',
    states: 2,
    fill: false,
    rowcol: true,
    tile(pen, x, y, s, k, w, c, m, i, j, bits) {
      if (((i + bits.row(j)) & 1) === 0) pen.line(x, y, x + s, y, w, c);
      if (((j + bits.col(i)) & 1) === 0) pen.line(x, y, x, y + s, w, c);
    },
  },
];

/* ---------- Pens ---------- */

function ctxPen(ctx) {
  return {
    line(x1, y1, x2, y2, w, c) {
      if (w < 0.05) return;
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    },
    arc(cx, cy, r, a0, a1, w, c) {
      if (w < 0.05) return;
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    },
    tri(x1, y1, x2, y2, x3, y3, c) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
    },
  };
}

/* p5.js pen: colours are cached as p5.Color objects so the inner loop stays quick. */
function p5Pen(p) {
  const cache = new Map();
  const col = (c) => {
    let v = cache.get(c);
    if (!v) { v = p.color(c); cache.set(c, v); }
    return v;
  };
  let lastStroke = null, lastW = -1, lastFill = null;
  return {
    line(x1, y1, x2, y2, w, c) {
      if (w < 0.05) return;
      if (c !== lastStroke) { p.stroke(col(c)); lastStroke = c; }
      if (w !== lastW) { p.strokeWeight(w); lastW = w; }
      p.line(x1, y1, x2, y2);
    },
    arc(cx, cy, r, a0, a1, w, c) {
      if (w < 0.05) return;
      if (c !== lastStroke) { p.stroke(col(c)); lastStroke = c; }
      if (w !== lastW) { p.strokeWeight(w); lastW = w; }
      p.arc(cx, cy, r * 2, r * 2, a0, a1);
    },
    tri(x1, y1, x2, y2, x3, y3, c) {
      if (c !== lastFill) { p.fill(col(c)); lastFill = c; }
      p.triangle(x1, y1, x2, y2, x3, y3);
    },
  };
}

/* SVG pen: groups segments by colour and width into a few long paths. */
function svgPen() {
  const strokes = new Map();
  const fills = new Map();
  const f = (n) => Math.round(n * 100) / 100;
  const push = (map, key, d) => { const a = map.get(key); if (a) a.push(d); else map.set(key, [d]); };
  return {
    line(x1, y1, x2, y2, w, c) {
      if (w < 0.05) return;
      push(strokes, c + '|' + f(w), `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`);
    },
    arc(cx, cy, r, a0, a1, w, c) {
      if (w < 0.05) return;
      const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0);
      const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1);
      push(strokes, c + '|' + f(w), `M${f(sx)} ${f(sy)}A${f(r)} ${f(r)} 0 0 1 ${f(ex)} ${f(ey)}`);
    },
    tri(x1, y1, x2, y2, x3, y3, c) {
      push(fills, c, `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}Z`);
    },
    toString(W, H, bg, cap) {
      let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
      out += `<rect width="${W}" height="${H}" fill="${bg}"/>`;
      for (const [key, ds] of strokes) {
        const [c, w] = key.split('|');
        out += `<path d="${ds.join('')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="${cap}"/>`;
      }
      for (const [c, ds] of fills) out += `<path d="${ds.join('')}" fill="${c}"/>`;
      return out + '</svg>';
    },
  };
}

/* ---------- The renderer shared by every pen ----------
   field: { cols, rows, s, v: Float32Array (0 dark … 1 light), rgb: Uint8ClampedArray }
   o: the settings, already normalised to 0…1 where it applies. */
function renderPattern(pen, P, field, o) {
  const { cols, rows, s, v, rgb } = field;
  const n = P.states;
  const inf = o.influence, mod = o.toneWeight, cut = o.cutoff, bal = o.balance;
  const baseW = o.weight * s;
  const bits = {
    row: (j) => (cellRand(0, j, o.seed, 3) + bal < 0.5 ? 1 : 0),
    col: (i) => (cellRand(i, 0, o.seed, 5) + bal < 0.5 ? 1 : 0),
  };
  let tiles = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      const val = v[idx];
      if (val > cut) continue;
      const r = cellRand(i, j, o.seed);
      let t = inf * val + (1 - inf) * r + bal;
      let k = Math.floor(t * n);
      if (k < 0) k = 0; else if (k >= n) k = n - 1;
      const dark = 1 - val;
      const m = Math.max(0, 1 - mod + mod * dark * 1.6);
      let c;
      if (o.colorMode === 'image') {
        const p = idx * 3;
        c = 'rgb(' + (rgb[p] & 0xf8) + ',' + (rgb[p + 1] & 0xf8) + ',' + (rgb[p + 2] & 0xf8) + ')';
      } else if (o.colorMode === 'two') {
        c = k % 2 === 0 ? o.ink : o.ink2;
      } else c = o.ink;
      P.tile(pen, i * s, j * s, s, k, Math.round(baseW * m * 10) / 10, c, m, i, j, bits);
      tiles++;
    }
  }
  return tiles;
}
