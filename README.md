# Ten Print

Turn any image into a 10 PRINT maze and six related tile patterns. Upload a picture, choose a pattern,
adjust the sliders, then export a PNG or SVG.

```basic
10 PRINT CHR$(205.5+RND(1)); : GOTO 10
```

The patterns start from that one line of Commodore 64 BASIC. Each cell of a grid gets a random diagonal,
`╱` or `╲`, and the cells join up into a maze. Ten Print lets your image take part in that choice. Dark
and light areas can steer which way each tile turns and how thick it is drawn.

Built with plain HTML, CSS and JavaScript, using [p5.js 2](https://beta.p5js.org/) for drawing.
There's no build step and no dependencies to install.

## Running it

The page loads three local scripts, so serve the folder rather than opening `index.html` from disk.
Any static server works. The repo includes a tiny one for Node:

```powershell
node .claude/serve.mjs . 5178
```

Then open <http://localhost:5178>.

You need an internet connection because p5.js (`p5@2.0.3`, from jsDelivr) and the IBM Plex fonts
load from a CDN. If p5.js fails to load, the page says so under the canvas.

## Using it

1. **Add an image.** Use **Upload image**, drop a file anywhere on the page, or paste from the
   clipboard. It accepts PNG, JPG, WebP, GIF and AVIF. The image never leaves your browser. Until you
   add one, a built-in sample sphere is shown.
2. **Pick a pattern** from the left panel.
3. **Adjust the sliders** on the right, or press **Space** to shuffle them.
4. **Export** with **Export PNG** or **SVG**.

Hold the eye button (or the **C** key) to see the original image in place of the pattern.

### Patterns

| Pattern | Rule |
| --- | --- |
| 10 PRINT | Each cell is one diagonal, `╱` or `╲` |
| Truchet arcs | Two quarter circles meet at the edge midpoints |
| Double arcs | Truchet with two lanes, so the paths braid |
| Half squares | A filled triangle in one of four corners |
| Right-angle maze | Each cell walls its top or its left side |
| Four strokes | One of `╱ ╲ │ ─` in every cell |
| Hitomezashi | Running stitches, one coin toss per row and column |

### Controls

**Tiles**
- **Tiles across:** grid density, from 8 to 240.
- **Line weight:** stroke thickness as a percentage of a tile. It has no effect on Half squares,
  which are filled shapes.
- **Line ends:** round, flat or square caps.

**Image**
- **Image steers direction:** at 0%, tile directions are purely random. At 100%, the image's light
  and dark areas decide them. Hitomezashi ignores this because its stitches are set per row and column.
- **Tone sets thickness:** makes lines thicker in dark areas and thinner in light ones. For Half
  squares it changes the triangle size.
- **Contrast:** stretches or flattens the image's tones before they're read.
- **Drop tiles lighter than:** leaves out tiles in areas brighter than this level.
- **Show source beneath:** draws the original image under the pattern, at this opacity.
- **Invert tones:** swaps light and dark.

**Chance**
- **Balance:** tips the random choice towards one tile direction.
- **Seed:** the random layout. The same seed with the same settings always gives the same pattern.

**Colour**
- Five presets: Paper, Blueprint, Riso, Night and Moss.
- **Ink comes from:** one ink, two inks (one per tile direction), or the image's own colours.
- Pickers for the paper, ink and second ink colours.

**Output**
- **Long side:** 1,080, 1,600, 2,400 or 3,200 px. The other side follows the image's proportions.
- **Reset all variations** restores the defaults but keeps your chosen pattern.

Double-click any slider to reset just that slider. Your settings are saved in the browser and come back
the next time you open the page.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | New seed and new values for six sliders: tiles across, line weight, image steers direction, tone sets thickness, contrast and balance |
| R | New seed only, keeping every slider as it is |
| 1–7 | Switch pattern |
| C (hold) | Show the source image |
| Ctrl+S / Cmd+S | Export PNG |
| Arrow keys | Move through the pattern list when it has focus |

Space doesn't shuffle while you're typing in the seed box or the output-size list, when the compare
(eye) button is focused, or when the Invert tones switch is focused. Those keep their normal Space
behaviour.

## Export

- **PNG** saves the canvas at the chosen output size through p5's `saveCanvas`.
- **SVG** rebuilds the pattern as vector paths, grouped by colour and stroke width, so it opens cleanly in
  Illustrator, Inkscape or Figma. It leaves out the source-image underlay.

Files are named after the image, the pattern and the seed, for example `sample-sphere-slash-1982.svg`.

## Files

| File | What's in it |
| --- | --- |
| `index.html` | Page structure: top bar, source and pattern panel, canvas, controls |
| `style.css` | Styling and the layouts for tablet and phone |
| `patterns.js` | The seven pattern definitions, the shared renderer, and three "pens" that draw the same tiles to the p5 canvas, the pattern previews and SVG |
| `app.js` | Image loading and sampling, the p5 sketch, controls, shortcuts and export |
| `.claude/serve.mjs` | A minimal static file server for local use |

### Adding a pattern

Add an entry to `PATTERNS` in `patterns.js`:

```js
{
  id: 'mine',
  name: 'My pattern',
  rule: 'One-line description shown in the picker',
  states: 2,      // how many tile variants the image or chance can choose between
  fill: false,    // true for filled shapes (turns off line weight and line ends)
  tile(pen, x, y, s, k, w, c, m) {
    // Draw one cell at (x, y) with side s.
    // k = chosen variant (0 … states-1), w = stroke width, c = colour,
    // m = tone multiplier (use it to scale filled shapes).
    // Draw with pen.line(...), pen.arc(...) and pen.tri(...).
  },
}
```

It then appears in the picker, works with every control, and exports to SVG with no other changes.

## Performance

Typical settings redraw instantly. The heaviest combination (240 tiles across at 3,200 px, Double arcs,
colour from the image) takes about 0.4 s per redraw.
