"""The Teviot cutout removes only exterior blue, preserving crest artwork."""
import io
from pathlib import Path
import sys
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from pilot_badge_transparency import circular_blue_field_png, transparent_blue_exterior_png


class BlueExteriorTest(unittest.TestCase):
    def test_circular_field_retains_source_crest_and_blue_interior(self):
        original = Image.new('RGB', (1024, 1055), (23, 54, 145))
        draw = ImageDraw.Draw(original)
        draw.ellipse((100, 25, 925, 1020), outline=(255, 205, 10), width=10)
        source = io.BytesIO()
        original.save(source, format='PNG')
        result = Image.open(io.BytesIO(circular_blue_field_png(source.getvalue())))
        self.assertEqual(result.size, (1280, 1280))
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(result.getpixel((640, 0))[3], 0)
        self.assertEqual(result.getpixel((640, 50)), (23, 54, 145, 255))
        self.assertEqual(result.getpixel((640, 640)), (23, 54, 145, 255))
        for xy in ((100, 527), (512, 25), (925, 527), (512, 1020)):
            self.assertEqual(result.getpixel((xy[0] + 128, xy[1] + 112)),
                             (*original.getpixel(xy), 255))

    def test_circular_field_rejects_changed_source(self):
        source = io.BytesIO()
        Image.new('RGB', (1024, 1055), 'white').save(source, format='PNG')
        with self.assertRaisesRegex(ValueError, 'blue field differs'):
            circular_blue_field_png(source.getvalue())

    def test_connected_background_is_removed_but_inner_blue_remains(self):
        original = Image.new('RGB', (600, 600), (4, 9, 230))
        draw = ImageDraw.Draw(original)
        draw.ellipse((10, 10, 590, 590), fill=(222, 2, 14))
        draw.ellipse((55, 55, 545, 545), fill=(4, 52, 132))
        source = io.BytesIO()
        original.save(source, format='PNG')
        result = Image.open(io.BytesIO(transparent_blue_exterior_png(source.getvalue())))
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(result.getpixel((300, 5))[3], 0)
        self.assertEqual(result.getpixel((300, 15)), (222, 2, 14, 255))
        self.assertEqual(result.getpixel((300, 300)), (4, 52, 132, 255))

    def test_wrong_background_fails_closed(self):
        source = io.BytesIO()
        Image.new('RGB', (600, 600), 'white').save(source, format='PNG')
        with self.assertRaisesRegex(ValueError, 'does not isolate'):
            transparent_blue_exterior_png(source.getvalue())


if __name__ == '__main__':
    unittest.main()
