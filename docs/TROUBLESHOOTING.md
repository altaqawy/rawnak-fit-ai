# Camera incident analysis and regression plan

## P0: camera opens briefly, then turns off

**Verified in old source:** the `startCamera` catch branch shut down tracks after model initialization failed. MediaPipe downloads and camera permission must be independent.

**Implemented in the standalone GitHub app:** show video immediately; initialize tracking asynchronously; on model failure show a retry button and leave video stream running.

**Test:** block `cdn.jsdelivr.net` or `storage.googleapis.com` in dev tools, start the camera, wait 30 seconds. Preview must continue. Restore connection, retry tracking without reopening camera.

## Other community-reported failure modes

| Failure | Evidence | Proposed mitigation |
| --- | --- | --- |
| Double effect setup/cleanup in React StrictMode | React docs | Request camera only on user action; independent cleanup and epoch tokens |
| Slow first model load | MediaPipe issue #5171 | Show video before model loading; cache model assets later |
| WASM/model request failures | MediaPipe issue #6119 | Distinct model error state, retry, self-host pinned files |
| Browser freezing on MediaPipe `close()` | MediaPipe issue #5718 | Dispose only when ending/switching; test each browser; minimize churn |
| VIDEO mode problems in Android WebView | MediaPipe issue #5618 | Prefer real Android Chrome; run WebView compatibility matrix |
| Camera permission/device busy | MDN getUserMedia | Specific error messages, secure origin, detect ended tracks |
| MediaPipe performance on mobile | MediaPipe pose docs | Use lite model, throttle inference, measure CPU/GPU usage |

## Local test matrix

- Windows 10/11: Chrome + Edge, built-in USB webcams
- Android: Chrome + Samsung Internet, front camera
- iOS: Safari, front camera, `playsInline` enabled
- Explicit permission denied, no camera, device in use
- Offline/blocked model downloads with video preview maintained
- Ten camera start/stop cycles
- Twenty rapid garment switches, including face/pose models
- Continuous 10-minute camera session

**Pass criteria (Alpha 0.2):** camera remains live with tracking disabled, can stop and restart without browser refresh, no orphaned camera track after explicit stop, meaningful errors.

## Diagnostic test

Load `/rawnak-fit-ai/diagnostics/camera-only.html` on GitHub Pages, or `/diagnostics/camera-only.html` on localhost. If that isolated page works but the main app does not, diagnose React/MediaPipe instead of blaming the webcam.

## References

- https://react.dev/learn/synchronizing-with-effects
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://github.com/google-ai-edge/mediapipe/issues/5171
- https://github.com/google-ai-edge/mediapipe/issues/6119
- https://github.com/google-ai-edge/mediapipe/issues/5718
- https://github.com/google-ai-edge/mediapipe/issues/5618
- https://docs.lensstudio.com/develop/capabilities/ar/try-on/garment-transfer

## 2026-11-17 — camera confirmed; tracker failed

- Camera-only diagnostics on Edge 157 (Windows): secure context true, track live, resolution 640×480 at 30 fps.
- Main live mirror still showed model loading failure. 60 FPS on screen was render FPS, *not* landmark inference rate.
- Replaced CDN import `0.10.22/+esm` with official `0.10.21/vision_bundle.mjs` and matched WASM version, plus unpkg fallback. Reason: documented jsDelivr version availability issues; device runtime root cause needs new log after deployment.
- Corrected FaceLandmarker results to `result.faceLandmarks`.
- Added [tracking model checks](../diagnostics/tracking.html) and copyable error details under camera. This can isolate ESM vs WASM vs model failures without opening the camera.
- **Next:** validate on user's browser, identify any remaining errors from copied report. Never close a working webcam solely because a model fails.
