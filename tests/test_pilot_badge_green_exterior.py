"""The Phoenix cutout removes exterior green and preserves the enclosed crest."""
import io
from pathlib import Path
import sys
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from pilot_badge_transparency import transparent_green_exterior_png


class GreenExteriorTest(unittest.TestCase):
    def test_outer_square_is_removed_but_inner_green_and_white_remain(self):
        original = Image.new('RGB', (600, 600), (8, 134, 80))
        draw = ImageDraw.Draw(original)
        draw.ellipse((60, 60, 540, 540), fill='white')
        draw.ellipse((85, 85, 515, 515), fill=(8, 134, 80))
        source = io.BytesIO()
        original.save(source, format='PNG')
        result = Image.open(io.BytesIO(transparent_green_exterior_png(source.getvalue())))
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(result.getpixel((300, 10))[3], 0)
        self.assertEqual(result.getpixel((300, 70)), (255, 255, 255, 255))
        self.assertEqual(result.getpixel((300, 300)), (8, 134, 80, 255))

    def test_wrong_exterior_fails_closed(self):
        source = io.BytesIO()
        Image.new('RGB', (600, 600), 'white').save(source, format='PNG')
        with self.assertRaisesRegex(ValueError, 'does not isolate'):
            transparent_green_exterior_png(source.getvalue())


if __name__ == '__main__':
    unittest.main()
