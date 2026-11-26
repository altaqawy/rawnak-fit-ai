"""Validate provenance of approved GLB template assets; does not download or export assets."""
import hashlib
import json
import re
import struct
from pathlib import Path
from urllib.parse import urlparse

def validate_asset(record, root):
    required = {"id", "category", "file", "license", "source", "sha256"}
    if not isinstance(record, dict) or set(record) != required:
        raise ValueError("Invalid asset metadata")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", record["id"]):
        raise ValueError("Invalid asset ID")
    if record["category"] not in {"bag", "top", "bottom", "dress", "watch", "glasses", "material"}:
        raise ValueError("Invalid category")
    if record["license"] not in {"CC0-1.0", "OWNED"}:
        raise ValueError("Only verified CC0 or owned assets accepted in distributable template registry")
    source = urlparse(record["source"])
    if source.scheme != "https" or not source.hostname:
        raise ValueError("HTTPS provenance link required")
    base = Path(root).resolve()
    path = (base / record["file"]).resolve()
    if not path.is_relative_to(base) or path.suffix.lower() != ".glb" or not path.is_file():
        raise ValueError("Invalid or missing local GLB")
    if not 20 <= path.stat().st_size <= 100 * 1024 * 1024:
        raise ValueError("Invalid GLB size")
    raw = path.read_bytes()
    magic, version, size = struct.unpack_from("<4sII", raw)
    if magic != b"glTF" or version != 2 or size != len(raw):
        raise ValueError("Invalid GLB header")
    if hashlib.sha256(raw).hexdigest() != record["sha256"]:
        raise ValueError("Asset checksum mismatch")
    return record["id"]

def validate_registry(path):
    path = Path(path)
    records = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("Expected asset list")
    ids = [validate_asset(record, path.parent) for record in records]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate asset ID")
    return ids

if __name__ == "__main__":
    print("Validated:", validate_registry(Path(__file__).parent / "assets.json"))
