# RAWNAK Fusion V2 — local research lab

This branch extends Alpha 1.8 without changing its camera, bag builder, or 3D engine. The new still-image lab calls the real upstream FASHN API (not a placeholder image). It is not a real-time video model. No model weights or BlenderKit assets are bundled.

## License gate
FASHN VTON 1.5 code and main model are Apache-2.0. Its default human parser inherits the NVIDIA SegFormer license; commercial use must be resolved independently. Therefore the lab is deliberately local, research-only, disabled unless explicitly enabled. Do not expose this server to customers, a public tunnel, or a production reverse proxy. CatV2TON is not integrated because of noncommercial licensing concerns. 
For Blendkit (formerly BlenderKit) only verified CC0 or owned assets may be admitted to our distributable template registry. Royalty-free is not the same as unrestricted asset redistribution. The registry validates metadata and file checksums, not the truth of license claims; a human must verify the source page and retain evidence.

## Run locally (Windows PowerShell, Python 3.10+)
1. Clone this branch and the upstream project separately.
2. In the upstream clone, create a virtual environment and follow its official installation instructions:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -e .
   python scripts/download_weights.py --weights-dir ./weights
   ```
   On CPU-only installations follow upstream guidance for replacing onnxruntime-gpu with onnxruntime. The model may require a stronger GPU than a 4 GB laptop GPU; CPU inference may be slow or impractical. First inference may download parser weights.
3. In the same activated environment, switch to this repository:
   ```powershell
   $env:RAWNAK_RESEARCH_ONLY="1"
   $env:RAWNAK_WEIGHTS="C:\path\to\fashn-vton-1.5\weights"
   python fusion/server.py
   ```
4. Open http://127.0.0.1:8765 . Select authorized person and garment photos, choose tops/bottoms/one-pieces, consent, and generate. Images are processed in local process memory; save output only by explicit download. No cloud inference endpoint is connected. Model downloads may contact upstream hosts.
5. Use only for private research while license clearance and GPU benchmarking are pending.

## Template pipeline
Choose CC0 or owned garment/bag template, record original source URL and license evidence, prepare in Blender, export GLB, and add a manifest entry to fusion/assets.json:
id, category, file (relative to fusion), license (CC0-1.0 or OWNED), source (HTTPS URL), sha256.
Run python fusion/asset_registry.py. Empty registry is intentional: no external asset has yet been verified/downloaded. GLB header and checksum checks are not mesh/rig/material QA. Actual integration with the existing bag builder is a subsequent task.

## Verification
Adapter code and UI integration created, model not installed or executed; no quality or performance claim. Full inherited CI remains unverified. 
Upstream: https://github.com/fashn-AI/fashn-vton-1.5
Parser terms: https://github.com/fashn-AI/fashn-human-parser
Assets: https://www.blendkit.com/docs/licenses/

## V2.1 — Blender template intake
Open Auto Studio → Blender / GLB Import (studio/template-intake.html). Export the reviewed Blender object as a self-contained glTF Binary (.glb) with triangulated geometry, embedded textures, no unsupported compression extensions, max 20 MB / 250k estimated triangles / 60 meshes. The Studio checks the file, opens a local Three.js preview and exports a provenance JSON with SHA-256. Keep the original GLB. Run:

```powershell
python fusion/register_template.py path/to/template.json path/to/original.glb
python fusion/asset_registry.py
```

The CLI copies the verified file to local-assets and updates the registry without overwriting an existing ID; run sequentially. It does not publish the asset, verify actual legal rights, or retarget rigging. No actual Blendkit assets are bundled. Blender export docs: https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html

FASHN adapter now distinguishes flat-lay product photos from model photos and checks all three required weight files before reporting available. Upstream documentation: https://github.com/fashn-AI/fashn-vton-1.5

Validation: three Studio intake checks passed in a synthetic JS harness with mocked URL, encoding and digest; UI scripts parsed. Real browser rendering, actual SHA-256 runtime, Python CI and model inference remain unverified. Local Git clone failed due to DNS. No production deployment.

## V2.2 — modular template editor
In Auto Studio → Blender / GLB Import, load a GLB or select the original low-detail nine-part bag test fixture. The fixture is generated locally by Three.js and exported to GLB, then passes through the same intake as an uploaded asset. It is not an externally sourced bag or a photorealistic model. The editor enumerates existing mesh nodes, suggests roles from names, permits manual semantic role and mobility annotations, and edits static leaf mesh local scale (50–200%) and visibility. Animated/skinned/morph/parent geometry is locked conservatively. Mobility tags are metadata, not movement or physics. Separate mesh parts are required; a single mesh is not automatically segmented. Export the original GLB and separate checksum-bound parts JSON; import the plan only against the identical original asset. Edits do not alter the original or publish an edited GLB. Live try-on and Bag Builder retargeting remain future work.

Candidate external CC0 models (source pages reviewed, files not downloaded or imported):
- Quaternius Bag: https://poly.pizza/m/Wq1JPPqHZS
- Quaternius Bag Open: https://poly.pizza/m/rJuZexcuhU
- accidentallyc Duffel Bag: https://poly.pizza/m/rysPhwuIP4

These are low-poly examples, not detailed handbags; verify the original files and current rights before registering. No external binaries have been committed. Four modular editor synthetic tests passed; UI modules parsed and literal UI IDs were found. Full CI remains failing; WebGL preview, sample GLB exporter and actual AI inference remain unverified. No production deployment.

## V2.3 — multi-view bag recommendations
Bag Builder → Product photos: upload references, confirm each view, then open Construct the model. Fusion V2.3 compares front/back silhouette profiles and approximate foreground colors across distinct linked photos, ranks the existing nine bag families, and abstains on inconsistent or insufficient evidence. The merchant may explicitly record material, closure, handle/strap counts, compartment and pocket counts against eligible confirmed views. Conflicting observations are not applied. Select individual suggestions and apply to the existing parametric Bag Builder; absolute measurements are never inferred or changed. Accepted changes enter normal undo/redo and source-evidence history; observations are session-level and must be reconfirmed after opening a saved project. No AI segmentation or invisible internal geometry is claimed. No external model weights or BlenderKit assets have been downloaded.

Five recommendation tests passed in a synthetic JavaScript harness; UI source parsed and new UI IDs checked. Real browser/camera, FASHN inference and full CI remain unverified; previous CI runs failed. No merge or production deployment.

## V2.4 — interactive Fusion Studio
Download and extract the complete repository branch ZIP. On Windows double-click RUN_FUSION.bat (Python 3 required); or run python fusion/launch_studio.py from the repository root. It opens the local Studio on 127.0.0.1 at an available port. The existing parametric BagViewer and its vendored Three.js render the bag, allow rotation and part inspection, opening/strap previews, measured specification and GLB export. Upload up to eight images, confirm views, run the geometric recommendations and apply suggested style/color. The AI button optionally downloads the U²-Netp ONNX runtime and weights; the latter are checked against SHA-256 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8. Product images stay in browser memory. AI isolation needs Internet on first use, secure localhost/HTTPS, and browser WASM support. Inspect the cutout and explicitly apply to the silhouette analyzer. A selected material swatch may be used as the existing repeat texture; mark only real swatch photos as material. No true depth/hidden-part inference is claimed. No remote image inference or FASHN video generation is included. FASHN remains a separate research lab. The AI weights are not bundled.
Sources: U²-Net (Apache-2.0): https://github.com/xuebinqin/U-2-Net ; rembg ONNX release (MIT code): https://github.com/danielgatis/rembg/releases/tag/v0.0.0 ; mirror/checksum: https://huggingface.co/edgetools/u2netp/blob/main/u2netp.onnx ; ONNX Runtime: https://github.com/microsoft/onnxruntime . Review applicable weights/dependency terms before commercial release. The original existing app is not replaced. Full browser rendering, model download and inference are not yet validated; previous CI failed and the local environment cannot clone GitHub via DNS.
