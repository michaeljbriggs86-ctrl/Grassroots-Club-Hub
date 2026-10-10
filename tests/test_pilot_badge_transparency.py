"""Exterior transparency preserves enclosed white artwork and native gates."""
import io
from pathlib import Path
import sys
import unittest
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from pilot_badge_transparency import transparent_png


class ExteriorTransparencyTest(unittest.TestCase):
    def test_enclosed_white_crest_and_colour_survive(self):
        source = Image.new('RGB', (512, 512), 'white')
        draw = ImageDraw.Draw(source)
        draw.rectangle((80, 80, 432, 432), fill='black')
        draw.rectangle((100, 100, 412, 412), fill='white')
        draw.rectangle((150, 150, 180, 380), fill=(0, 140, 70))
        encoded = io.BytesIO()
        source.save(encoded, format='PNG')
        result = Image.open(io.BytesIO(transparent_png(encoded.getvalue())))
        self.assertEqual(result.size, source.size)
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(result.getpixel((250, 250)), (255, 255, 255, 255))
        self.assertEqual(result.getpixel((160, 250)), (0, 140, 70, 255))
        self.assertEqual(result.getpixel((90, 250)), (0, 0, 0, 255))

    def test_other_small_jpegs_do_not_gain_the_slade_exception(self):
        source = Image.new('RGB', (199, 199), 'white')
        encoded = io.BytesIO()
        source.save(encoded, format='JPEG')
        with self.assertRaisesRegex(ValueError, 'below the reviewed resolution gate'):
            transparent_png(encoded.getvalue())


if __name__ == '__main__':
    unittest.main()
