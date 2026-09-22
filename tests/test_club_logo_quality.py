import importlib.util
import pathlib
import tempfile
import unittest
import zlib
import struct

MODULE = pathlib.Path(__file__).parents[1] / "verification" / "verify_club_logo_quality.py"
spec = importlib.util.spec_from_file_location("logoq", MODULE)
logoq = importlib.util.module_from_spec(spec)
spec.loader.exec_module(logoq)


def write_png(path: pathlib.Path, w: int, h: int):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(
            ">I", zlib.crc32(kind + data) & 0xffffffff
        )
    raw = b"".join(b"\x00" + (b"\x00\x00\x00" * w) for _ in range(h))
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


class ClubLogoQualityTests(unittest.TestCase):
    def test_floor_is_512_for_current_gate(self):
        self.assertEqual(logoq.required_raster_short_edge(128), 512)

    def test_48px_raster_fails(self):
        with tempfile.TemporaryDirectory() as td:
            p = pathlib.Path(td) / "logo.png"
            write_png(p, 48, 48)
            self.assertTrue(logoq.check_asset(p, 512))

    def test_512px_raster_passes(self):
        with tempfile.TemporaryDirectory() as td:
            p = pathlib.Path(td) / "logo.png"
            write_png(p, 512, 512)
            self.assertEqual(logoq.check_asset(p, 512), [])

    def test_png_extension_magic_mismatch_fails(self):
        with tempfile.TemporaryDirectory() as td:
            p = pathlib.Path(td) / "logo.png"
            p.write_bytes(b"not-a-png")
            self.assertTrue(logoq.check_asset(p, 512))

    def test_svg_with_embedded_raster_fails(self):
        with tempfile.TemporaryDirectory() as td:
            p = pathlib.Path(td) / "logo.svg"
            p.write_text('<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AA=="/></svg>')
            ok, _ = logoq.svg_is_true_vector(p)
            self.assertFalse(ok)

    def test_true_vector_svg_passes(self):
        with tempfile.TemporaryDirectory() as td:
            p = pathlib.Path(td) / "logo.svg"
            p.write_text('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>')
            ok, _ = logoq.svg_is_true_vector(p)
            self.assertTrue(ok)

    def test_default_scan_includes_unsupported_club_logo_file(self):
        with tempfile.TemporaryDirectory() as td:
            root = pathlib.Path(td)
            assets = root / "app/src/main/assets/club-logos"
            assets.mkdir(parents=True)
            p = assets / "future-logo.webp"
            p.write_bytes(b"RIFF")
            scanned = logoq.scan_default_assets(root)
            self.assertIn(p, scanned)
            self.assertTrue(logoq.check_asset(p, 512))


if __name__ == "__main__":
    unittest.main()
