#!/usr/bin/env python3
"""PitchKind club-logo technical quality gate (club-logo-q1).

Default repository scan:
  * app/src/main/assets/shooters-hill-logo.png
  * every file under app/src/main/assets/club-logos/

This gate deliberately checks technical suitability only. Correct identity,
provenance, and rights/use remain separate catalogue gates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
import sys
from pathlib import Path

GATE_VERSION = "club-logo-q1"
DEFAULT_MAX_RENDER_CSS_PX = 128
DEFAULT_MIN_SCALE_FACTOR = 4
DEFAULT_RASTER_FLOOR = 512
PILOT_RASTER_FLOOR = 192
PILOT_RIGHTS_NOTE = "Rights bypassed for protected pilot; public, marketing and wider-use permission not established."
RASTER_EXTS = {".png", ".jpg", ".jpeg"}
VECTOR_EXTS = {".svg"}


def required_raster_short_edge(max_render_css_px: int) -> int:
    return max(DEFAULT_RASTER_FLOOR, max_render_css_px * DEFAULT_MIN_SCALE_FACTOR)


def png_size(path: Path) -> tuple[int, int] | None:
    b = path.read_bytes()[:24]
    if len(b) < 24 or b[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", b[16:24])


def jpeg_size(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        return None
    i = 2
    sof = {
        0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
        0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
    }
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data):
            break
        marker = data[i]
        i += 1
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if i + 2 > len(data):
            break
        seglen = int.from_bytes(data[i:i+2], "big")
        if seglen < 2 or i + seglen > len(data):
            break
        if marker in sof and seglen >= 7:
            h = int.from_bytes(data[i+3:i+5], "big")
            w = int.from_bytes(data[i+5:i+7], "big")
            return w, h
        i += seglen
    return None


def raster_size(path: Path) -> tuple[int, int] | None:
    ext = path.suffix.lower()
    if ext == ".png":
        return png_size(path)
    if ext in {".jpg", ".jpeg"}:
        return jpeg_size(path)
    return None


def svg_is_true_vector(path: Path) -> tuple[bool, str]:
    try:
        text = path.read_text("utf-8")
    except UnicodeDecodeError:
        return False, "SVG is not UTF-8 text"
    if not re.search(r"<svg\b", text, flags=re.I):
        return False, "missing <svg> root"
    if re.search(r"<image\b", text, flags=re.I) or re.search(r"data:image/", text, flags=re.I):
        return False, "contains embedded raster image"
    if not re.search(r"<(?:path|circle|ellipse|rect|polygon|polyline|line|use|text)\b", text, flags=re.I):
        return False, "no vector drawing elements found"
    return True, "true vector structure"


def scan_default_assets(root: Path) -> list[Path]:
    assets = root / "app/src/main/assets"
    found: list[Path] = []
    shooters = assets / "shooters-hill-logo.png"
    if shooters.exists():
        found.append(shooters)

    club_dir = assets / "club-logos"
    if club_dir.exists():
        for p in sorted(club_dir.rglob("*")):
            if not p.is_file():
                continue
            if p.name.startswith(".") or p.name == ".gitkeep":
                continue
            # Include unsupported extensions so they fail closed rather than
            # silently escaping the technical-quality gate.
            found.append(p)
    return found


def check_asset(path: Path, min_short_edge: int) -> list[str]:
    errors: list[str] = []
    ext = path.suffix.lower()
    if not path.exists():
        return [f"missing asset: {path}"]

    if ext in RASTER_EXTS:
        size = raster_size(path)
        if size is None:
            errors.append(f"{path}: extension/magic mismatch or unsupported raster bytes")
            return errors
        w, h = size
        if min(w, h) < min_short_edge:
            errors.append(
                f"{path}: {w}x{h} FAIL; shortest edge {min(w,h)}px < required {min_short_edge}px"
            )
        else:
            print(f"PASS {path}: {w}x{h} raster")
    elif ext in VECTOR_EXTS:
        ok, reason = svg_is_true_vector(path)
        if not ok:
            errors.append(f"{path}: SVG FAIL; {reason}")
        else:
            print(f"PASS {path}: {reason}")
    else:
        errors.append(f"{path}: unsupported club-logo format {ext or '(none)'}")
    return errors


def check_pilot_exception(path: Path, manifest: dict, club_id: int, max_render_css_px: int) -> list[str]:
    """D2 is an exact-file exception, never a lower global q1 floor."""
    if manifest.get('schema_version') != 1 or manifest.get('scope') != 'private_pilot':
        return ['unsupported private-pilot manifest']
    badges = manifest.get('badges')
    if not isinstance(badges, list) or any(not isinstance(r, dict) for r in badges):
        return ['pilot badges must be a list of admission records']
    rows = [r for r in badges if r.get('club_id') == club_id]
    if len(rows) != 1 or rows[0].get('logo_status') != 'pilot_verified':
        return ['one exact pilot_verified admission is required']
    row = rows[0]
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != row.get('logo_sha256'):
        return ['pilot exception asset SHA-256 mismatch']
    size = raster_size(path)
    if not size:
        return ['pilot exception requires a supported raster; raster SVG wrappers do not qualify']
    waiver = row.get('pilot_quality_exception') or {}
    if not isinstance(waiver, dict):
        return ['pilot exception must be an object']
    if (waiver.get('scope') != 'shooters_hill_protected_pilot' or
            waiver.get('max_render_css_px') != 128 or not 0 < max_render_css_px <= 128 or
            waiver.get('quality_note') != 'below q1' or waiver.get('no_upscaling') is not True or
            (waiver.get('native_width'), waiver.get('native_height')) != size or
            row.get('rights_note') != PILOT_RIGHTS_NOTE):
        return ['pilot exception needs exact native pixels, below q1, no upscaling, 128px slot and rights note']
    if not PILOT_RASTER_FLOOR <= min(size) < DEFAULT_RASTER_FLOOR:
        return ['pilot exception shortest edge must be 192 through 511 native pixels']
    return check_asset(path, PILOT_RASTER_FLOOR)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="Repository root for default scan")
    ap.add_argument("--asset", action="append", default=[], help="Specific asset to check; repeatable")
    ap.add_argument("--max-render-css-px", type=int, default=DEFAULT_MAX_RENDER_CSS_PX)
    ap.add_argument('--pilot-manifest', type=Path, help='D2: exact-file private-pilot allowlist')
    ap.add_argument('--club-id', type=int, help='D2: canonical club ID in that allowlist')
    args = ap.parse_args()
    if args.max_render_css_px <= 0:
        ap.error('--max-render-css-px must be positive')
    if args.pilot_manifest or args.club_id is not None:
        if not args.pilot_manifest or args.club_id is None or len(args.asset) != 1:
            ap.error('D2 requires --pilot-manifest, --club-id and exactly one --asset')
        try:
            errors = check_pilot_exception(Path(args.asset[0]), json.loads(args.pilot_manifest.read_text()),
                                           args.club_id, args.max_render_css_px)
        except (OSError, ValueError, TypeError) as exc:
            errors = [str(exc)]
        for error in errors:
            print('FAIL: ' + error, file=sys.stderr)
        if not errors:
            print('PASS: protected pilot exact-file D2 exception; below q1, not public clearance')
        return int(bool(errors))

    min_short_edge = required_raster_short_edge(args.max_render_css_px)
    root = Path(args.root).resolve()
    assets = [Path(x).resolve() for x in args.asset] if args.asset else scan_default_assets(root)

    print(
        f"{GATE_VERSION}: raster floor={min_short_edge}px "
        f"(max_render_css_px={args.max_render_css_px}, scale={DEFAULT_MIN_SCALE_FACTOR}x)"
    )
    if not assets:
        print("FAIL: no club-logo assets found", file=sys.stderr)
        return 1

    errors: list[str] = []
    for asset in assets:
        errors.extend(check_asset(asset, min_short_edge))

    if errors:
        print("\nTechnical club-logo quality failures:", file=sys.stderr)
        for e in errors:
            print(f"- {e}", file=sys.stderr)
        print(
            "\nDo not upscale a low-resolution source to make it pass; "
            "obtain a genuine higher-resolution or vector asset.",
            file=sys.stderr,
        )
        return 1

    print(f"\nPASS: {len(assets)} club-logo asset(s) satisfy {GATE_VERSION} technical quality.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
