// Normalized image coordinates, origin at top left. A trace describes only
// the visible body contour and carries no metric depth or material inference.
const levels = [0.035, 0.25, 0.5, 0.75, 0.965];
export function tracedEnvelope(points, aspect = 1) {
  if (
    !Array.isArray(points) ||
    points.length < 4 ||
    points.length > 48 ||
    points.some(
      (pt) =>
        !Array.isArray(pt) ||
        pt.length !== 2 ||
        pt.some((v) => !Number.isFinite(v) || v < 0 || v > 1),
    )
  )
    return null;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs),
    yMin = Math.min(...ys),
    yMax = Math.max(...ys);
  if (xMax - xMin < 0.1 || yMax - yMin < 0.1) return null;
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const count = points.length,
    edge = (i) => [points[i], points[(i + 1) % count]];
  let area = 0;
  for (let i = 0; i < count; i++) {
    const [a, b] = edge(i);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.002) return null;
    area += a[0] * b[1] - a[1] * b[0];
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) continue;
      const [c, d] = edge(j);
      if (
        Math.max(a[0], b[0]) < Math.min(c[0], d[0]) ||
        Math.max(c[0], d[0]) < Math.min(a[0], b[0]) ||
        Math.max(a[1], b[1]) < Math.min(c[1], d[1]) ||
        Math.max(c[1], d[1]) < Math.min(a[1], b[1])
      )
        continue;
      if (orient(a, b, c) * orient(a, b, d) <= 0 && orient(c, d, a) * orient(c, d, b) <= 0)
        return null;
    }
  }
  if (Math.abs(area) / 2 < (xMax - xMin) * (yMax - yMin) * 0.18) return null;
  // A small camera roll can turn a straight base into a narrow apparent foot.
  // Level only an extended, nearly collinear lower hem visible in the trace.
  const hem = [];
  for (let i = 0; i < count; i++) {
    const [a, b] = edge(i),
      dx = b[0] - a[0];
    if (Math.min(a[1], b[1]) < yMax - 0.13 * (yMax - yMin) || Math.abs(dx) < 0.12 * (xMax - xMin))
      continue;
    hem.push({ slope: (b[1] - a[1]) / dx, span: Math.abs(dx) });
  }
  const span = hem.reduce((sum, s) => sum + s.span, 0);
  let slope = span ? hem.reduce((sum, s) => sum + s.span * s.slope, 0) / span : 0;
  const roll = Math.atan(slope / (Number.isFinite(aspect) && aspect > 0 ? aspect : 1));
  if (
    span < 0.45 * (xMax - xMin) ||
    Math.abs(roll) > Math.PI / 15 ||
    hem.some((s) => Math.abs(s.slope - slope) > 0.045)
  )
    slope = 0;
  const corrected = points.map(([x, y]) => [x, y - slope * (x - (xMin + xMax) / 2)]);
  const top = Math.min(...corrected.map((p) => p[1])),
    bottom = Math.max(...corrected.map((p) => p[1]));
  const width = (h) => {
    const y = bottom - h * (bottom - top),
      hits = [];
    for (let i = 0; i < count; i++) {
      const a = corrected[i],
        b = corrected[(i + 1) % count];
      if (a[1] > y !== b[1] > y) hits.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    return hits.length >= 2 ? Math.max(...hits) - Math.min(...hits) : 0;
  };
  const max = Math.max(...Array.from({ length: 65 }, (_, i) => width((i + 0.5) / 65)));
  if (max <= 0) return null;
  return {
    method: 'guided-body-trace',
    status: 'candidate',
    confidence: 'merchant-guided',
    widthProfile: levels.map((h) => Math.min(1, Math.max(0.35, width(h) / max))),
  };
}

export function editOutline(img, saved, tr) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('outline-dialog'),
      canvas = dialog.querySelector('canvas'),
      caption = dialog.querySelector('output'),
      ok = dialog.querySelector('[value="accept"]'),
      undo = dialog.querySelector('[data-undo]');
    const points = saved.map((p) => [...p]),
      ctx = canvas.getContext('2d');
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    let cursor = [0.5, 0.5],
      usingKeys = false;
    const draw = () => {
      const w = canvas.width,
        h = canvas.height,
        r = Math.max(3, w * 0.009);
      ctx.drawImage(img, 0, 0, w, h);
      if (points.length) {
        ctx.beginPath();
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(28,128,100,.18)';
        ctx.fill();
        ctx.lineWidth = Math.max(2, r * 0.6);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        for (const [x, y] of points) {
          ctx.beginPath();
          ctx.arc(x * w, y * h, r, 0, Math.PI * 2);
          ctx.fillStyle = '#145c47';
          ctx.fill();
          ctx.stroke();
        }
      }
      if (usingKeys) {
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursor[0] * w, cursor[1] * h, r * 1.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ok.disabled = !tracedEnvelope(points);
      undo.disabled = !points.length;
      caption.textContent = points.length + ' / 48';
    };
    const add = (pt) => {
      if (points.length < 48) points.push(pt);
      draw();
    };
    canvas.onclick = (e) => {
      const b = canvas.getBoundingClientRect();
      usingKeys = false;
      add([(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]);
    };
    canvas.onkeydown = (e) => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
        e.key
      ];
      if (delta) {
        e.preventDefault();
        usingKeys = true;
        cursor = cursor.map((v, i) =>
          Math.min(1, Math.max(0, v + delta[i] * (e.shiftKey ? 0.05 : 0.01))),
        );
        draw();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        add([...cursor]);
      }
    };
    undo.onclick = () => {
      points.pop();
      draw();
    };
    dialog.querySelector('[data-clear]').onclick = () => {
      points.length = 0;
      draw();
    };
    dialog.returnValue = 'cancel';
    dialog.onclose = () => {
      const result =
        dialog.returnValue === 'accept' && tracedEnvelope(points)
          ? points
          : dialog.returnValue === 'remove'
            ? []
            : null;
      canvas.onclick = null;
      canvas.onkeydown = null;
      undo.onclick = null;
      dialog.querySelector('[data-clear]').onclick = null;
      dialog.onclose = null;
      resolve(result);
    };
    dialog.querySelector('[value="remove"]').hidden = !saved.length;
    canvas.setAttribute('aria-label', tr('محيط جسم الشنطة', 'Bag body outline'));
    draw();
    dialog.showModal();
    canvas.focus();
  });
}
