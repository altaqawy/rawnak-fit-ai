import base64
import hashlib
import io
import os
import struct
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from server import ResearchEngine, parse_request, REQUIRED_WEIGHTS
from asset_registry import validate_asset

def sample():
    data=io.BytesIO()
    Image.new("RGB",(80,100),"red").save(data,format="PNG")
    return base64.b64encode(data.getvalue()).decode()

class FusionTests(unittest.TestCase):
    def test_validation(self):
        p={"person":sample(),"garment":sample(),"category":"tops","consent":True,"photo_type":"flat-lay"}
        category,person,garment,photo_type=parse_request(p)
        self.assertEqual(photo_type,"flat-lay")
        self.assertEqual(category,"tops")
        self.assertEqual(person.size,(80,100))
        for changes in ({"consent":False},{"category":"wrong"},{"person":"bad!!"},{"photo_type":"wrong"}):
            with self.assertRaises(ValueError): parse_request({**p,**changes})
    def test_adapter_and_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in REQUIRED_WEIGHTS:
                file=Path(tmp,name)
                file.parent.mkdir(parents=True,exist_ok=True)
                file.write_bytes(b"mock")
            class Result:
                images=[Image.new("RGB",(80,100),"blue")]
            calls=[]
            def factory(**kwargs):
                def inference(**kw):
                    calls.append((kw["category"],kw["garment_photo_type"]))
                    return Result()
                return inference
            engine=ResearchEngine(tmp,factory=factory)
            im=Image.new("RGB",(80,100))
            with patch.dict(os.environ,{"RAWNAK_RESEARCH_ONLY":"0"}):
                with self.assertRaises(RuntimeError):engine.generate(im,im,"tops")
            with patch.dict(os.environ,{"RAWNAK_RESEARCH_ONLY":"1"}):
                self.assertTrue(engine.generate(im,im,"tops").startswith(b"\x89PNG"))
                self.assertEqual(calls,[("tops","flat-lay")])
                engine.lock.acquire()
                try:
                    with self.assertRaises(BlockingIOError):engine.generate(im,im,"tops")
                finally:engine.lock.release()
    def test_registry(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw=struct.pack("<4sII",b"glTF",2,20)+b"12345678"
            Path(tmp,"sample.glb").write_bytes(raw)
            entry={"id":"sample","category":"bag","file":"sample.glb","license":"CC0-1.0","source":"https://example.com/source","sha256":hashlib.sha256(raw).hexdigest()}
            self.assertEqual(validate_asset(entry,tmp),"sample")
            for changes in ({"license":"royalty-free"},{"sha256":"invalid"},{"file":"../outside.glb"}):
                with self.assertRaises(ValueError):validate_asset({**entry,**changes},tmp)

if __name__=="__main__":unittest.main()
