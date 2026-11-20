// Original, tileable relief and roughness samples for the two leather presets.
// Pixel buffers are immutable and shared. Every assembly owns its texture wrappers.
import * as THREE from 'three';

const swatches = new Map();
const size = 128;
const wrap = (n, count) => ((n % count) + count) % count;

function sampleLeather(kind) {
  if (swatches.has(kind)) return swatches.get(kind);
  const natural = kind === 'leather';
  const cols = natural ? 9 : 12,
    rows = natural ? 13 : 15;
  let seed = natural ? 25487 : 89311;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cells = Array.from({ length: cols * rows }, () => [
    0.12 + 0.76 * random(),
    0.12 + 0.76 * random(),
    random(),
  ]);
  const heights = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2,
        v = (y / size) * Math.PI * 2;
      const gx = (x * cols) / size + 0.24 * Math.sin(2 * v + Math.sin(u + v));
      const gy = (y * rows) / size + 0.3 * Math.sin(u - v + 0.8 * Math.sin(2 * u));
      const ix = Math.floor(gx),
        iy = Math.floor(gy);
      let nearest = Infinity,
        second = Infinity,
        cell = 0;
      for (let j = iy - 1; j <= iy + 1; j++) {
        for (let i = ix - 1; i <= ix + 1; i++) {
          const site = cells[wrap(j, rows) * cols + wrap(i, cols)];
          const dx = i + site[0] - gx,
            dy = j + site[1] - gy,
            d = dx * dx + dy * dy;
          if (d < nearest) {
            second = nearest;
            nearest = d;
            cell = site[2];
          } else if (d < second) second = d;
        }
      }
      const distance = Math.sqrt(second) - Math.sqrt(nearest);
      const ridge = Math.exp(-distance * distance * (natural ? 35 : 48));
      const index = y * size + x,
        pore = random();
      heights[index] =
        -(natural ? 0.74 : 0.53) * ridge +
        0.15 * cell +
        0.08 * Math.sin(u + v * 2) +
        (pore < 0.055 ? -0.17 : 0.026 * pore);
      const rough = Math.round(205 + 24 * ridge + 13 * cell + 8 * pore);
      roughness.set([rough, rough, rough, 255], index * 4);
    }
  }
  const height = (x, y) => heights[wrap(y, size) * size + wrap(x, size)];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = height(x - 1, y) - height(x + 1, y);
      const dy = height(x, y - 1) - height(x, y + 1);
      const len = Math.hypot(dx, dy, 1);
      const channel = (v) => Math.round(127.5 * (1 + v / len));
      normal.set([channel(dx), channel(dy), channel(1), 255], (y * size + x) * 4);
    }
  const swatch = { normal, roughness };
  swatches.set(kind, swatch);
  return swatch;
}

export function leatherMap(kind, channel) {
  const pixels = sampleLeather(kind)[channel];
  let texture;
  // glTF packs roughness and metalness together via a 2D canvas. Supply a
  // drawable raster for that channel so a separate merchant metalness map also works.
  if (channel === 'roughness' && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'),
      img = ctx.createImageData(size, size);
    img.data.set(pixels);
    ctx.putImageData(img, 0, 0);
    texture = new THREE.CanvasTexture(canvas);
    texture.flipY = false;
  } else texture = new THREE.DataTexture(pixels, size, size);
  texture.name = 'Template leather ' + channel + ' · ' + kind;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
