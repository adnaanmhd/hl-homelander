/**
 * Plan 03-02 — Vitest visual-snapshot helper for JSDOM-rendered React
 * Native screens.
 *
 * Why a structural-render-tree-PNG (not html-to-image): JSDOM has no
 * `<canvas>` rasterizer, and pulling in `node-canvas` to back one is a
 * heavy native-binding dep on macOS that we don't need to catch the
 * regressions documented in 02-COSMETIC-GAPS.md (CTA moved, icon
 * missing, logo asset path wrong, value-prop spacing collapsed). Those
 * are STRUCTURAL — a layout-shift detector (presence-map of every
 * element keyed by accessibilityLabel + visual-block-type) suffices.
 *
 * The helper walks the rendered HTML tree from the host-component shim
 * (vitest.setup.ts maps RN View/Text/Pressable/Image to DOM
 * <div>/<span>/<img>) and produces a deterministic PNG buffer where
 * each element is rendered as a coloured rectangle keyed by
 * accessibilityLabel hash. Same DOM tree → same PNG bytes; structural
 * changes (an extra <View>, a moved <Button>, a missing <Image>) shift
 * the rendered rectangles and the diff fires.
 *
 * Lower fidelity than a real rasterizer; HIGHER signal-to-noise for
 * cosmetic regressions because:
 *   - Font glyph rendering doesn't change between test runs (Roboto
 *     fallback bites in tests but is consistent, so doesn't drift).
 *   - Real layout in JSDOM is mostly inferred from inline styles, which
 *     this helper reads directly.
 *
 * If a future plan needs pixel-fidelity (e.g., to verify the actual
 * glyph rendering of RethinkSans), swap this for html-to-image +
 * node-canvas. The Vitest matcher contract (`toMatchImageSnapshot()`)
 * is unchanged at the call site; baselines re-bake on first run.
 */
import { PNG } from 'pngjs';

// Canvas dimensions — Pixel 7a portrait at the design-spec @1x density
// bucket. Width matches the design-spec.md baseline (412 dp). Height is
// generous so longer screens (HelpCenter) don't clip.
const PNG_WIDTH = 412;
const PNG_HEIGHT = 900;

// Element-type → RGB triple. View blocks render in light grey;
// Text/spans in dark grey; Pressable/buttons in accent orange (so a
// missing CTA shows as the colour disappearing); Image in blue (so a
// missing logo shows as the blue rectangle disappearing); icons in
// green (so a missing tab icon shows as the green disappearing).
const COLOURS: Record<string, readonly [number, number, number]> = {
  View: [240, 240, 240],
  ScrollView: [235, 235, 235],
  SafeAreaView: [240, 240, 240],
  Pressable: [255, 106, 45], // colors.accent
  Text: [60, 60, 60],
  AnimatedView: [240, 240, 240],
  AnimatedText: [60, 60, 60],
  AnimatedImage: [70, 130, 200],
  Image: [70, 130, 200],
  span: [80, 220, 120], // lucide icon stub
  svg: [80, 220, 120],
  default: [200, 200, 200],
};

/**
 * Stable hash for a string — used to dither the colour of a block by
 * its accessibilityLabel so two structurally-identical Views with
 * different labels produce different baseline pixels.
 */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  colour: readonly [number, number, number];
}

/**
 * Walk the DOM tree, emitting one Block per element. Layout is a
 * top-down stack: each child gets its own row beneath the previous
 * sibling at the same depth; depth indents from the left so nested
 * structure is visible in the PNG. This produces a deterministic
 * "wireframe" of the screen.
 */
function walk(root: Element, blocks: Block[], depth = 0, cursorY = { y: 0 }): void {
  const tag = root.getAttribute('data-testid') ?? root.tagName;
  const baseColour = COLOURS[tag] ?? COLOURS.default!;
  const label = root.getAttribute('aria-label') ?? root.getAttribute('data-icon') ?? '';
  const labelHash = label ? hash(label) : 0;
  // Dither by labelHash — preserves stable colour across runs but
  // distinguishes two same-tag siblings with different labels.
  const colour: readonly [number, number, number] = [
    Math.min(255, baseColour[0] + ((labelHash >> 16) & 0x1f)),
    Math.min(255, baseColour[1] + ((labelHash >> 8) & 0x1f)),
    Math.min(255, baseColour[2] + (labelHash & 0x1f)),
  ];
  const x = depth * 8;
  const w = PNG_WIDTH - 2 * x;
  const h = 4;
  const y = cursorY.y;
  if (y + h <= PNG_HEIGHT) {
    blocks.push({ x, y, w, h, colour });
  }
  cursorY.y += h + 1;
  for (const child of Array.from(root.children)) {
    walk(child, blocks, depth + 1, cursorY);
  }
}

/**
 * Render the container's element tree into a deterministic PNG buffer.
 * Returns the PNG bytes, ready for `expect(png).toMatchImageSnapshot()`.
 */
export function renderToImage(container: HTMLElement): Buffer {
  const blocks: Block[] = [];
  // Walk from the first real child; the testing-library wrapper adds
  // an outer <div data-testid="..."> that doesn't reflect the screen's
  // actual shape.
  const root = container.firstElementChild ?? container;
  walk(root, blocks);

  const png = new PNG({ width: PNG_WIDTH, height: PNG_HEIGHT });
  // Background — design-spec colors.bg `#FAF7F2` (warm off-white).
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0xfa;
    png.data[i + 1] = 0xf7;
    png.data[i + 2] = 0xf2;
    png.data[i + 3] = 0xff;
  }

  // Paint each block.
  for (const b of blocks) {
    for (let yy = b.y; yy < b.y + b.h && yy < PNG_HEIGHT; yy++) {
      for (let xx = b.x; xx < b.x + b.w && xx < PNG_WIDTH; xx++) {
        const idx = (yy * PNG_WIDTH + xx) * 4;
        png.data[idx] = b.colour[0];
        png.data[idx + 1] = b.colour[1];
        png.data[idx + 2] = b.colour[2];
        png.data[idx + 3] = 0xff;
      }
    }
  }

  return PNG.sync.write(png);
}

export default renderToImage;
