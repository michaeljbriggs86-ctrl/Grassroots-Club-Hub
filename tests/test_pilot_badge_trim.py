"""Preserve crest pixels while removing only empty transparent canvas."""
import io
from pathlib import Path
import sys
import unittest

from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
from pilot_badge_transparency import trim_transparent_padding_png


class TransparentTrimTest(unittest.TestCase):
    def test_visible_pixels_survive_unchanged_with_clear_margin(self):
        source = Image.new('RGBA', (900, 900), (255, 255, 255, 0))
        source.paste((215, 21, 41, 255), (150, 150, 750, 750))
        encoded = io.BytesIO()
        source.save(encoded, format='PNG')
        trimmed = Image.open(io.BytesIO(trim_transparent_padding_png(encoded.getvalue())))
        self.assertEqual(trimmed.size, (624, 624))
        self.assertEqual(trimmed.getpixel((0, 0))[3], 0)
        self.assertEqual(trimmed.getpixel((12, 12)), (215, 21, 41, 255))
        self.assertEqual(trimmed.getpixel((611, 611)), (215, 21, 41, 255))

    def test_small_visible_art_cannot_pass_by_having_a_large_canvas(self):
        source = Image.new('RGBA', (900, 900), (0, 0, 0, 0))
        source.paste((215, 21, 41, 255), (300, 300, 600, 600))
        encoded = io.BytesIO()
        source.save(encoded, format='PNG')
        with self.assertRaisesRegex(ValueError, 'visible badge is below'):
            trim_transparent_padding_png(encoded.getvalue())


if __name__ == '__main__':
    unittest.main()
