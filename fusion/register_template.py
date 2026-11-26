"""Register a locally reviewed GLB with its Studio-generated entry. No downloads."""
import argparse
import json
import shutil
import tempfile
from pathlib import Path
from asset_registry import validate_asset, validate_registry

def register(entry_path, glb_path, root):
    root = Path(root).resolve()
    manifest = root / "assets.json"
    entries = json.loads(manifest.read_text(encoding="utf-8"))
    validate_registry(manifest)
    entry = json.loads(Path(entry_path).read_text(encoding="utf-8"))
    if not isinstance(entry, dict):
        raise ValueError("Invalid Studio entry")
    asset_id = entry.get("id", "")
    import re
    if not isinstance(asset_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", asset_id):
        raise ValueError("Invalid asset ID")
    if entry.get("file") != f"local-assets/{asset_id}.glb":
        raise ValueError("Unexpected asset path")
    if any(e["id"] == asset_id for e in entries):
        raise ValueError("Asset ID already exists; use a new versioned ID")
    source = Path(glb_path).resolve()
    if source.suffix.lower() != ".glb" or not source.is_file() or not 28 <= source.stat().st_size <= 20*1024*1024:
        raise ValueError("Select the original GLB, maximum 20 MB")
    target = root / entry["file"]
    target.parent.mkdir(exist_ok=True)
    if not target.resolve().is_relative_to(root) or target.exists():
        raise ValueError("Target exists or escapes asset directory")
    # Validate staged file against metadata before it can enter the registry.
    with tempfile.TemporaryDirectory(dir=root) as tmp:
        stage = Path(tmp)
        staged = stage / entry["file"]
        staged.parent.mkdir()
        shutil.copyfile(source, staged)
        validate_asset(entry, stage)
        new_manifest = stage / "assets.json"
        new_manifest.write_text(json.dumps([*entries, entry], indent=2)+"\n",encoding="utf-8")
        # Exclusive creation prevents overwriting existing assets.
        created = False
        try:
            with target.open("xb") as out:
                created = True
                with staged.open("rb") as src:
                    shutil.copyfileobj(src, out)
            new_manifest.replace(manifest)
        except Exception:
            if created:
                target.unlink(missing_ok=True)
            raise
    return asset_id

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("entry", help="JSON downloaded from Studio")
    p.add_argument("glb", help="Original reviewed GLB")
    args = p.parse_args()
    print("Registered:", register(args.entry,args.glb,Path(__file__).parent))
