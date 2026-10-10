"""Reproduce the reviewed exterior-only transparency PNG from official art."""
import io
import hashlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage


def circular_blue_field_png(original_bytes):
    """Keep GNG's original blue field and artwork, rounding only its outer edge."""
    original = Image.open(io.BytesIO(original_bytes))
    if original.size != (1024, 1055) or original.mode != 'RGB':
        raise ValueError('GNG original dimensions or mode differ from reviewed artwork')
    rgb = np.asarray(original)
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]))
    if np.max(np.abs(border.astype(np.int16) - (23, 54, 145))) > 8:
        raise ValueError('GNG blue field differs from reviewed artwork')
    # Extend only the source's nearly uniform blue border into a square.
    # Every pixel of the original lettering and crest stays at its exact value.
    square = np.pad(rgb, ((112, 113), (128, 128), (0, 0)), mode='edge')
    scale = 4
    mask = Image.new('L', (1280 * scale, 1280 * scale), 0)
    ImageDraw.Draw(mask).ellipse((10 * scale, 10 * scale,
                                  1270 * scale - 1, 1270 * scale - 1), fill=255)
    alpha = np.asarray(mask.resize((1280, 1280), Image.Resampling.LANCZOS))
    result = np.dstack((square, alpha))
    out = io.BytesIO()
    Image.fromarray(result, 'RGBA').save(out, format='PNG', optimize=True)
    return out.getvalue()


SLADE_GREEN_ORIGINAL_SHA256 = '3740606def7455603cb1d60f59a7e3151431b1d9024480cdf9cc1c8bca75a180'


def transparent_png(original_bytes):
    original = Image.open(io.BytesIO(original_bytes))
    # The existing D2 record admits this exact 199px original, never an
    # enlarged copy. Keep the general resolution gate for every other input.
    slade = (original.size == (199, 199) and original.format == 'JPEG' and
             hashlib.sha256(original_bytes).hexdigest() == SLADE_GREEN_ORIGINAL_SHA256)
    if not slade and (original.width < 512 or original.height < 512):
        raise ValueError('original badge is below the reviewed resolution gate')
    arr = np.array(original.convert('RGBA'))
    rgb = arr[..., :3]
    old_alpha = arr[..., 3].copy()
    low, high = rgb.min(2), rgb.max(2)
    possible = (low >= (190 if slade else 145)) & ((high - low) <= (35 if slade else 45))
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


def transparent_blue_exterior_png(original_bytes):
    """Remove only the blue field connected to the outside of a round crest."""
    original = Image.open(io.BytesIO(original_bytes))
    if original.width < 512 or original.height < 512:
        raise ValueError('original badge is below the reviewed resolution gate')
    arr = np.array(original.convert('RGBA'))
    red, green, blue = (arr[..., channel].astype(np.int16) for channel in range(3))
    possible = (blue > red * 1.30) & (blue > green * 1.30) & (blue > 75)
    border = np.zeros(possible.shape, bool)
    border[[0, -1], :] = True
    border[:, [0, -1]] = True
    exterior = ndimage.binary_propagation(border & possible, mask=possible,
                                          structure=np.ones((3, 3)))
    fraction = exterior.mean()
    if not 0.02 < fraction < 0.45 or exterior[original.height // 2, original.width // 2]:
        raise ValueError('blue exterior mask does not isolate the crest')
    alpha = np.where(exterior, 0, 255).astype(np.uint8)
    softened = np.asarray(Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(.55)))
    edge = ndimage.binary_dilation(exterior, iterations=2)
    arr[exterior, 3] = 0
    arr[edge & ~exterior, 3] = np.minimum(arr[edge & ~exterior, 3], softened[edge & ~exterior])
    out = io.BytesIO()
    Image.fromarray(arr, 'RGBA').save(out, format='PNG', optimize=True)
    return out.getvalue()


def transparent_green_exterior_png(original_bytes):
    """Remove Phoenix's connected green square without changing the round crest."""
    original = Image.open(io.BytesIO(original_bytes))
    if min(original.size) < 512:
        raise ValueError('original badge is below the reviewed resolution gate')
    arr = np.array(original.convert('RGBA'))
    red, green, blue = (arr[..., channel].astype(np.int16) for channel in range(3))
    possible = (green > red * 1.55) & (green > blue * 1.30) & (green > 60)
    border = np.zeros(possible.shape, bool)
    border[[0, -1], :] = True
    border[:, [0, -1]] = True
    exterior = ndimage.binary_propagation(border & possible, mask=possible,
                                          structure=np.ones((3, 3)))
    if (not 0.45 < exterior.mean() < 0.65 or
            exterior[original.height // 2, original.width // 2]):
        raise ValueError('green exterior mask does not isolate the crest')
    alpha = np.where(exterior, 0, 255).astype(np.uint8)
    softened = np.asarray(Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(.55)))
    edge = ndimage.binary_dilation(exterior, iterations=2)
    arr[exterior, 3] = 0
    arr[edge & ~exterior, 3] = np.minimum(arr[edge & ~exterior, 3], softened[edge & ~exterior])
    out = io.BytesIO()
    Image.fromarray(arr, 'RGBA').save(out, format='PNG', optimize=True)
    return out.getvalue()


def trim_transparent_padding_png(original_bytes):
    """Remove empty transparent canvas, leaving a small clear crest margin."""
    original = Image.open(io.BytesIO(original_bytes)).convert('RGBA')
    if min(original.size) < 512:
        raise ValueError('original badge is below the reviewed resolution gate')
    alpha = original.getchannel('A')
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError('badge has no visible artwork')
    left, top, right, bottom = bounds
    if min(right - left, bottom - top) < 512:
        raise ValueError('visible badge is below the reviewed resolution gate')
    margin = round(max(right - left, bottom - top) * .02)
    side = max(right - left, bottom - top) + margin * 2
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2
    box = (center_x - side // 2, center_y - side // 2,
           center_x - side // 2 + side, center_y - side // 2 + side)
    if box[0] < 0 or box[1] < 0 or box[2] > original.width or box[3] > original.height:
        raise ValueError('crest margin exceeds original canvas')
    out = io.BytesIO()
    original.crop(box).save(out, format='PNG', optimize=True)
    return out.getvalue()
