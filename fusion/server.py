"""Local research-only FASHN integration. No public deployment or camera stream."""
from __future__ import annotations
import base64
import binascii
import io
import json
import os
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
MAX_IMAGE = 8 * 1024 * 1024
MAX_REQUEST = 23 * 1024 * 1024
CATEGORIES = frozenset(("tops", "bottoms", "one-pieces"))
PHOTO_TYPES = frozenset(("flat-lay", "model"))
REQUIRED_WEIGHTS = ("model.safetensors", "dwpose/yolox_l.onnx", "dwpose/dw-ll_ucoco_384.onnx")
TOKEN = secrets.token_urlsafe(32)

def parse_request(payload):
    if not isinstance(payload, dict) or set(payload) != {"person", "garment", "category", "consent", "photo_type"}:
        raise ValueError("Invalid request fields")
    if payload["consent"] is not True or not isinstance(payload["category"], str) or payload["category"] not in CATEGORIES:
        raise ValueError("Consent and valid category required")
    photo_type = payload["photo_type"]
    if not isinstance(photo_type, str) or photo_type not in PHOTO_TYPES:
        raise ValueError("Invalid garment photo type")
    return payload["category"], decode_image(payload["person"]), decode_image(payload["garment"]), photo_type

def decode_image(encoded):
    if not isinstance(encoded, str) or len(encoded) > (MAX_IMAGE + 2) // 3 * 4:
        raise ValueError("Image exceeds 8 MB or invalid input")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise ValueError("Invalid image data") from None
    if not data or len(data) > MAX_IMAGE:
        raise ValueError("Image exceeds 8 MB or is empty")
    from PIL import Image, ImageOps
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"} or getattr(image, "n_frames", 1) != 1:
                raise ValueError("Use a single JPEG, PNG or WebP image")
            if image.width < 64 or image.height < 64 or image.width * image.height > 16_000_000:
                raise ValueError("Unsupported image dimensions")
            image = ImageOps.exif_transpose(image).convert("RGB")
            image.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
            return image.copy()
    except (OSError, Image.DecompressionBombError) as exc:
        raise ValueError("Unreadable or oversized image") from exc

class ResearchEngine:
    def __init__(self, weights_dir, *, factory=None):
        self.weights_dir = Path(weights_dir)
        self.factory = factory
        self.pipeline = None
        self.lock = threading.Lock()
    def missing_weights(self):
        return [name for name in REQUIRED_WEIGHTS if not (self.weights_dir / name).is_file() or (self.weights_dir / name).stat().st_size == 0]
    def available(self):
        return os.environ.get("RAWNAK_RESEARCH_ONLY") == "1" and not self.missing_weights()
    def generate(self, person, garment, category, photo_type="flat-lay"):
        if not self.available():
            raise RuntimeError("Research engine disabled or model weights missing")
        if category not in CATEGORIES or photo_type not in PHOTO_TYPES:
            raise ValueError("Unsupported garment category")
        if not self.lock.acquire(blocking=False):
            raise BlockingIOError("One generation is already running")
        try:
            if self.pipeline is None:
                if self.factory is None:
                    from fashn_vton import TryOnPipeline
                    self.factory = TryOnPipeline
                self.pipeline = self.factory(weights_dir=str(self.weights_dir))
            result = self.pipeline(person_image=person, garment_image=garment, category=category, garment_photo_type=photo_type)
            out = io.BytesIO()
            result.images[0].convert("RGB").save(out, format="PNG")
            return out.getvalue()
        finally:
            self.lock.release()

ENGINE = ResearchEngine(os.environ.get("RAWNAK_WEIGHTS", str(HERE / "weights")))

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # no request contents logged
    def valid_host(self):
        return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"
    def send_bytes(self, status, body, mime):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.end_headers()
        self.wfile.write(body)
    def send_json(self, status, data):
        self.send_bytes(status, json.dumps(data).encode(), "application/json")
    def do_GET(self):
        if not self.valid_host():
            return self.send_json(403, {"error": "Local access only"})
        route = urlsplit(self.path).path
        if route == "/status":
            return self.send_json(200, {"ready": ENGINE.available(), "token": TOKEN, "mode": "research-only", "engine": "FASHN VTON 1.5", "missing_weights": ENGINE.missing_weights()})
        files = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"), "/style.css": ("style.css", "text/css; charset=utf-8")}
        if route not in files:
            return self.send_json(404, {"error": "Not found"})
        name, mime = files[route]
        self.send_bytes(200, (HERE / name).read_bytes(), mime)
    def do_POST(self):
        expected = f"http://127.0.0.1:{self.server.server_port}"
        if not self.valid_host() or self.headers.get("Origin") != expected or not secrets.compare_digest(self.headers.get("X-Rawnak-Token", ""), TOKEN):
            return self.send_json(403, {"error": "Local session required"})
        if self.path != "/try-on":
            return self.send_json(404, {"error": "Not found"})
        if not ENGINE.available():
            return self.send_json(503, {"error": "Research engine disabled or missing weights"})
        if self.headers.get_content_type() != "application/json" or self.headers.get("Transfer-Encoding"):
            return self.send_json(415, {"error": "JSON required"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= MAX_REQUEST:
                return self.send_json(413, {"error": "Request too large"})
            self.connection.settimeout(20)
            body = self.rfile.read(size)
            if len(body) != size:
                raise ValueError("Incomplete request")
            payload = json.loads(body)
            category, person, garment, photo_type = parse_request(payload)
            result = ENGINE.generate(person, garment, category, photo_type)
            return self.send_bytes(200, result, "image/png")
        except (ValueError, TypeError, TimeoutError):
            return self.send_json(400, {"error": "Invalid images or request"})
        except BlockingIOError:
            return self.send_json(409, {"error": "Another generation is running"})
        except Exception:
            return self.send_json(500, {"error": "Model inference failed. Check local dependencies, GPU memory and weights."})

if __name__ == "__main__":
    port = int(os.environ.get("RAWNAK_PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"RAWNAK research lab: http://127.0.0.1:{port}")
    server.serve_forever()
