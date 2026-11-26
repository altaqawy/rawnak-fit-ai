"""Serve the Fusion Studio locally; this does not start FASHN or upload files."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

def main():
    root = Path(__file__).resolve().parent.parent
    if not (root / "studio" / "fusion-lab.html").is_file():
        raise SystemExit("Extract the complete RAWNAK repository ZIP before launching.")
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        address = f"http://127.0.0.1:{server.server_port}/studio/fusion-lab.html"
        print(f"Fusion Studio: {address}\nKeep this window open. Ctrl+C stops the server.", flush=True)
        webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
