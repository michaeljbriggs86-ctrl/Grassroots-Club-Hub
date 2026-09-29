"""Reproduce the reviewed exterior-only transparency PNG from official art."""
import io

import numpy as np
from PIL import Image
from scipy import ndimage


def transparent_png(original_bytes):
    original = Image.open(io.BytesIO(original_bytes))
    if original.width < 512 or original.height < 512:
        raise ValueError('original badge is below the reviewed resolution gate')
    arr = np.array(original.convert('RGBA'))
    rgb = arr[..., :3]
    old_alpha = arr[..., 3].copy()
    low, high = rgb.min(2), rgb.max(2)
    possible = (low >= 145) & ((high - low) <= 45)
    border = np.zeros(possible.shape, bool)
    border[[0, -1], :] = True
    border[:, [0, -1]] = True
    seed = border & possible
    if not seed.any():
        raise ValueError('no neutral outer field touches the badge border')
    exterior = ndimage.binary_propagation(seed, mask=possible, structure=np.ones((3, 3)))
    arr[exterior, 3] = 0
    edge = ndimage.binary_dilation(exterior, iterations=1) & ~exterior
    neutral = (rgb.max(2) - rgb.min(2) <= 45) & (rgb.min(2) >= 85)
    edge &= neutral & (old_alpha == 255)
    coverage = 255 - rgb.min(2).astype(np.int16)
    edge &= (coverage > 0) & (coverage < 255)
    arr[edge, 3] = coverage[edge].astype(np.uint8)
    alpha = arr[..., 3].astype(np.int32)
    selected = edge & (alpha > 0)
    if selected.any():
        values = rgb[selected].astype(np.int32)
        a = alpha[selected][:, None]
        arr[selected, :3] = np.uint8(np.clip(
            (values * 255 - (255 - a) * 255 + a // 2) // a, 0, 255))
    image = Image.fromarray(arr, 'RGBA')
    out = io.BytesIO()
    image.save(out, format='PNG', optimize=True)
    return out.getvalue()
