import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '..');
const source = readFileSync(path.join(root, 'src/app.js'), 'utf8');
const injectionPoint = '  drawCatalog();\n  updateUI();\n})();';
assert.ok(source.includes(injectionPoint), 'test hook anchor remains available');
const instrumented = source.replace(
  injectionPoint,
  '  drawCatalog();\n  updateUI();\n  globalThis.__fitHarness = { state, startCamera, stopCamera, renderLoop, changeViewMode };\n})();'
);
let imagesDrawn = 0;
let trackStops = 0;
const inputs = [];

const context2d = {};
for (const name of [
  'drawImage', 'clearRect', 'setTransform', 'beginPath', 'moveTo', 'lineTo',
  'closePath', 'fill', 'stroke', 'translate', 'rotate', 'arc', 'ellipse',
  'roundRect', 'fillText', 'fillRect', 'quadraticCurveTo', 'scale', 'save', 'restore'
]) {
  context2d[name] = () => { if (name === 'drawImage') imagesDrawn++; };
}
class MockElement {
  constructor(type) {
    this.type = type;
    this.listeners = {};
    const names = new Set();
    this.classList = {
      add: (name) => names.add(name),
      remove: (name) => names.delete(name),
      toggle: (name, enabled) => enabled ? names.add(name) : names.delete(name),
      contains: (name) => names.has(name)
    };
    this.style = {};
    this.clientWidth = 640;
    this.clientHeight = 480;
    this.width = 300;
    this.height = 150;
    this.currentTime = 1.2;
    this.videoWidth = 640;
    this.videoHeight = 480;
    this.readyState = 4;
    this.textContent = '';
  }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  setAttribute() {}
  append() {}
  getContext() { return context2d; }
  play() { return Promise.resolve(); }
  pause() {}
  click() {}
  toDataURL() { return 'data:image/png;base64,AA=='; }
}
const elements = new Map();
const select = (id) => {
  if (!elements.has(id)) elements.set(id, new MockElement(id));
  return elements.get(id);
};
const track = { stop() { trackStops++; } };
const mockStream = { getTracks() { return [track]; }, getVideoTracks() { return [track]; } };
const sandbox = {
  document: { querySelector: select, createElement: (type) => new MockElement(type) },
  navigator: { mediaDevices: { getUserMedia: async () => mockStream } },
  window: { isSecureContext: true, devicePixelRatio: 1, location: { search: '' }, addEventListener() {} },
  performance: { now: () => 555 },
  devicePixelRatio: 1,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  console,
  URLSearchParams
};
runInNewContext(instrumented, sandbox);
const app = sandbox.__fitHarness;
assert.equal(app.state.viewMode, 'sync', 'synchronized mode is the default');
const pose = Array.from({ length: 33 }, () => ({ x: .5, y: .5 }));
pose[11] = { x: .3, y: .35 };
pose[12] = { x: .7, y: .35 };
pose[23] = { x: .35, y: .75 };
pose[24] = { x: .65, y: .75 };
app.state.models.pose = {
  detectForVideo(image) {
    inputs.push(image.type);
    return { landmarks: [pose] };
  },
  close() {}
};
await app.startCamera();
app.renderLoop(100);
assert.equal(app.state.engine, 'ready');
assert.equal(app.state.syncFrameReady, true, 'first analyzed frame is displayed');
assert.equal(inputs.at(-1), 'canvas', 'model analyzes the captured canvas frame');
assert.ok(select('#camera-layers').classList.contains('synced'), 'video switches to synchronized output');
assert.ok(imagesDrawn >= 2, 'source frame and composited result are drawn');

app.changeViewMode('fast');
app.renderLoop(220);
assert.equal(inputs.at(-1), '#camera-video', 'fast mode reads live video element');
assert.equal(select('#camera-layers').classList.contains('synced'), false, 'fast mode shows regular video');

app.changeViewMode('sync');
app.state.models.pose.detectForVideo = () => { throw Error('synthetic failure'); };
select('#camera-video').currentTime = 2;
app.renderLoop(320);
assert.equal(app.state.engine, 'error');
assert.ok(app.state.stream, 'video remains open when synchronized inference fails');
assert.equal(select('#camera-layers').classList.contains('synced'), false, 'failure falls back to live preview');

app.stopCamera();
assert.equal(app.state.stream, null);
assert.equal(trackStops, 1, 'camera tracks close on explicit stop');
console.log('PASS: synchronized frame composition, fast fallback, errors and camera lifecycle (mock browser).');
