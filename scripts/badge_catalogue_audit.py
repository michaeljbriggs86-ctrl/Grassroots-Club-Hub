#!/usr/bin/env python3
"""PitchKind bulk club-badge acquisition/audit worker.

Verification/readiness tooling only. It does not create a competing club database
and never promotes a third-party badge to production VERIFIED automatically.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import html
import json
import re
import shutil
from dataclasses import dataclass, asdict
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from PIL import Image

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "Chrome/126 Safari/537.36 PitchKindBadgeAudit/1.0"
)
IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
DEFAULT_TIMEOUT = 20
DEFAULT_MIN_SHORT_EDGE = 512

RASTER_MIME_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/avif": ".avif",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
}
VECTOR_MIME_EXT = {"image/svg+xml": ".svg"}
ALL_IMAGE_MIME_EXT = {**RASTER_MIME_EXT, **VECTOR_MIME_EXT}
RIGHTS_READY_STATUSES = {"project_approved_asset"}

LOGO_WORDS = re.compile(r"(?:logo|crest|badge|shield|emblem|club[-_ ]?mark)", re.I)
BAD_WORDS = re.compile(
    r"(?:sponsor|partner|advert|banner|hero|background|cookie|gdpr|powered|"
    r"league[-_ ]?logo|fa[-_ ]?logo|facebook|instagram|twitter|youtube)",
    re.I,
)

@dataclass
class Acquisition:
    club_id: int | str
    club_name: str
    input_status: str
    identity_status: str
    rights_status: str
    source_type: str
    candidate_url: str
    final_url: str = ""
    http_status: int | None = None
    mime_type: str = ""
    extension: str = ""
    file_size_bytes: int | None = None
    sha256: str = ""
    width: int | None = None
    height: int | None = None
    vector_true: bool | None = None
    technical_quality_status: str = "not_checked"
    review_bucket: str = ""
    asset_path: str = ""
    error: str = ""
    discovered_alternatives: list[str] | None = None
    fallback_used: bool = False

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sniff_mime(data: bytes, content_type: str = "") -> str:
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data.startswith(b"\x00\x00\x01\x00"):
        return "image/x-icon"
    if (
        len(data) >= 12
        and data[4:8] == b"ftyp"
        and data[8:12] in {b"avif", b"avis", b"mif1", b"msf1"}
    ):
        return "image/avif"
    stripped = data.lstrip()
    if stripped.startswith(b"<svg") or b"<svg" in stripped[:1000]:
        return "image/svg+xml"
    if ct in ALL_IMAGE_MIME_EXT:
        return ct
    return ct

def image_dimensions(path: Path, mime_type: str) -> tuple[int | None, int | None]:
    if mime_type == "image/svg+xml":
        text = path.read_text("utf-8", errors="replace")
        w = re.search(r'\bwidth=["\']\s*([0-9.]+)', text, re.I)
        h = re.search(r'\bheight=["\']\s*([0-9.]+)', text, re.I)
        if w and h:
            return int(float(w.group(1))), int(float(h.group(1)))
        vb = re.search(
            r'\bviewBox=["\']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)',
            text, re.I
        )
        if vb:
            return int(float(vb.group(1))), int(float(vb.group(2)))
        return None, None
    with Image.open(path) as im:
        return int(im.width), int(im.height)

def svg_is_true_vector_bytes(data: bytes) -> bool:
    text = data.decode("utf-8", errors="replace")
    if not re.search(r"<svg\b", text, re.I):
        return False
    if re.search(r"<image\b", text, re.I) or re.search(r"data:image/", text, re.I):
        return False
    return bool(re.search(
        r"<(?:path|circle|ellipse|rect|polygon|polyline|line|use|text)\b",
        text, re.I
    ))

def technical_quality(
    mime_type: str,
    data: bytes,
    width: int | None,
    height: int | None,
    min_short_edge: int,
) -> tuple[str, bool | None]:
    if mime_type == "image/svg+xml":
        ok = svg_is_true_vector_bytes(data)
        return ("pass_true_vector" if ok else "fail_svg_embedded_or_nonvector"), ok
    if mime_type not in RASTER_MIME_EXT:
        return "fail_unsupported_format", None
    if not width or not height:
        return "fail_dimensions_unknown", None
    if min(width, height) < min_short_edge:
        return f"fail_low_resolution_{width}x{height}", None
    return f"pass_raster_{width}x{height}", None

def score_image_url(url: str, alt: str = "") -> int:
    text = f"{url} {alt}"
    score = 0
    if LOGO_WORDS.search(text):
        score += 8
    if BAD_WORDS.search(text):
        score -= 10
    if re.search(
        r"(?:thumbnail|thumb|favicon|apple-touch|w=(?:[1-4]?\d\d)|h=(?:[1-4]?\d\d))",
        text, re.I
    ):
        score -= 5
    if re.search(r"(?:1200|1600|1920|2048|2500|original|full)", text, re.I):
        score += 3
    if url.lower().endswith((".svg", ".png")):
        score += 2
    return score

def extract_page_image_urls(page_url: str, body: str) -> list[str]:
    soup = BeautifulSoup(body, "html.parser")
    scored: dict[str, int] = {}

    def add(raw: str | None, alt: str = ""):
        if not raw:
            return
        raw = raw.strip()
        if not raw or raw.startswith(("data:", "javascript:")):
            return
        full = urljoin(page_url, raw)
        if not full.startswith(("http://", "https://")):
            return
        scored[full] = max(scored.get(full, -999), score_image_url(full, alt))

    for meta in soup.select('meta[property="og:image"],meta[name="twitter:image"]'):
        add(meta.get("content"), "social preview")
    for link in soup.select('link[rel~="icon"],link[rel="apple-touch-icon"]'):
        add(link.get("href"), "icon")
    for img in soup.find_all("img"):
        classes = img.get("class") or []
        alt = " ".join(filter(None, [
            img.get("alt"), img.get("title"), " ".join(classes) if classes else ""
        ]))
        add(img.get("src"), alt)
        add(img.get("data-src"), alt)
        srcset = img.get("srcset") or img.get("data-srcset")
        if srcset:
            for bit in srcset.split(","):
                add(bit.strip().split(" ")[0], alt)

    return [
        u for u, score in sorted(scored.items(), key=lambda kv: (-kv[1], kv[0]))
        if score >= 0
    ][:20]

def browser_page_image_urls(page_url: str, timeout_ms: int = 25000) -> list[str]:
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=USER_AGENT, viewport={"width": 1280, "height": 900})
            page.goto(page_url, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(1000)
            rows = page.eval_on_selector_all(
                "img",
                """els => els.map(e => ({
                    src: e.currentSrc || e.src || '',
                    alt: [e.alt || '', e.title || '', e.className || ''].join(' ')
                }))"""
            )
            metas = page.eval_on_selector_all(
                'meta[property="og:image"],meta[name="twitter:image"]',
                "els => els.map(e => e.content || '')"
            )
            browser.close()
    except Exception:
        return []

    scored: dict[str, int] = {}
    for row in rows:
        u = row.get("src") or ""
        if u.startswith(("http://", "https://")):
            scored[u] = max(
                scored.get(u, -999),
                score_image_url(u, row.get("alt") or "")
            )
    for u in metas:
        if u.startswith(("http://", "https://")):
            scored[u] = max(scored.get(u, -999), score_image_url(u, "social preview"))
    return [
        u for u, score in sorted(scored.items(), key=lambda kv: (-kv[1], kv[0]))
        if score >= 0
    ][:20]

def fetch_bytes(
    session: requests.Session,
    url: str,
    timeout: int,
) -> tuple[bytes, requests.Response]:
    with session.get(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": IMAGE_ACCEPT},
        timeout=timeout,
        allow_redirects=True,
        stream=True,
    ) as response:
        response.raise_for_status()
        chunks: list[bytes] = []
        total = 0
        for chunk in response.iter_content(64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > MAX_DOWNLOAD_BYTES:
                raise ValueError(f"download exceeds {MAX_DOWNLOAD_BYTES} bytes")
            chunks.append(chunk)
        return b"".join(chunks), response

def source_alternatives(
    session: requests.Session,
    source_url: str,
    timeout: int,
    browser_fallback: bool,
) -> list[str]:
    if not source_url:
        return []
    urls: list[str] = []
    try:
        response = session.get(
            source_url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"},
            timeout=timeout,
            allow_redirects=True,
        )
        if response.ok and "html" in (response.headers.get("content-type") or "").lower():
            urls = extract_page_image_urls(response.url, response.text)
    except Exception:
        pass
    if not urls and browser_fallback:
        urls = browser_page_image_urls(source_url)
    return urls

def safe_club_id(value) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", str(value))

def review_bucket_for(
    technical_status: str,
    identity_status: str,
    rights_status: str,
    fallback_used: bool,
) -> str:
    # A fallback image is a different asset from the one whose identity may have
    # been reviewed. It must always return to human identity review.
    if fallback_used:
        return "C_identity_needs_review"
    if identity_status not in {"strong_match", "confirmed"}:
        return "C_identity_needs_review"
    # Rights are fail-closed: only explicitly project-approved assets may reach
    # the ready-for-visual-review bucket. Unknown/unreviewed/disputed rights are
    # held separately even when identity and technical checks pass.
    if rights_status not in RIGHTS_READY_STATUSES:
        return "E_rights_hold"
    if technical_status.startswith("pass_"):
        return "A_ready_visual_review"
    if technical_status.startswith("fail_low_resolution"):
        return "B_identity_good_asset_too_small"
    return "F_technical_failure"

def download_one(
    club: dict,
    assets_dir: Path,
    min_short_edge: int,
    timeout: int,
    browser_fallback: bool,
) -> Acquisition:
    result = Acquisition(
        club_id=club.get("club_id", ""),
        club_name=str(club.get("club_name") or club.get("name") or ""),
        input_status=str(club.get("logo_status") or "missing"),
        identity_status=str(club.get("identity_match_status") or "not_reviewed"),
        rights_status=str(club.get("rights_status") or "legal_basis_not_reviewed"),
        source_type=str(club.get("logo_source") or ""),
        candidate_url=str(club.get("logo_candidate_url") or ""),
        discovered_alternatives=[],
    )

    if not result.candidate_url:
        result.technical_quality_status = "not_applicable_no_candidate"
        result.review_bucket = "D_no_candidate"
        return result

    session = requests.Session()
    data = b""
    response = None
    first_error = ""
    try:
        data, response = fetch_bytes(session, result.candidate_url, timeout)
        result.final_url = response.url
        result.http_status = response.status_code
        result.mime_type = sniff_mime(
            data, response.headers.get("content-type") or ""
        )
        if result.mime_type not in ALL_IMAGE_MIME_EXT:
            raise ValueError(
                f"candidate returned non-image content: {result.mime_type or 'unknown'}"
            )
    except Exception as exc:
        first_error = str(exc)
        alternatives = source_alternatives(
            session,
            str(club.get("official_website") or ""),
            timeout,
            browser_fallback,
        )
        result.discovered_alternatives = alternatives
        for alternative in alternatives[:5]:
            try:
                data, response = fetch_bytes(session, alternative, timeout)
                mime = sniff_mime(
                    data, response.headers.get("content-type") or ""
                )
                if mime in ALL_IMAGE_MIME_EXT:
                    result.final_url = response.url
                    result.http_status = response.status_code
                    result.mime_type = mime
                    result.fallback_used = True
                    result.error = (
                        f"input candidate failed ({first_error}); "
                        "source-page alternative acquired for human review"
                    )
                    break
            except Exception:
                continue
        if not data or result.mime_type not in ALL_IMAGE_MIME_EXT:
            result.error = f"download failed: {first_error}"
            result.technical_quality_status = "not_checked_download_failed"
            result.review_bucket = "F_download_failed"
            return result

    result.extension = ALL_IMAGE_MIME_EXT[result.mime_type]
    result.file_size_bytes = len(data)
    result.sha256 = sha256_bytes(data)
    filename = (
        f"{safe_club_id(result.club_id)}_{result.sha256[:12]}"
        f"{result.extension}"
    )
    path = assets_dir / filename
    path.write_bytes(data)
    result.asset_path = f"assets/{filename}"

    try:
        result.width, result.height = image_dimensions(path, result.mime_type)
    except Exception as exc:
        result.error = (
            (result.error + "; " if result.error else "")
            + f"dimension parse failed: {exc}"
        )

    status, vector = technical_quality(
        result.mime_type,
        data,
        result.width,
        result.height,
        min_short_edge,
    )
    result.technical_quality_status = status
    result.vector_true = vector

    result.review_bucket = review_bucket_for(
        status,
        result.identity_status,
        result.rights_status,
        result.fallback_used,
    )
    return result

def write_review_html(results: list[Acquisition], output: Path) -> None:
    cards: list[str] = []
    for r in sorted(results, key=lambda x: (x.review_bucket, x.club_name.lower())):
        image = (
            f'<img src="{html.escape(r.asset_path)}" alt="">'
            if r.asset_path else '<div class="missing">No acquired asset</div>'
        )
        alternatives = ""
        if r.discovered_alternatives:
            alternatives = (
                "<details><summary>Discovered alternatives</summary><ul>"
                + "".join(
                    f"<li><code>{html.escape(u)}</code></li>"
                    for u in r.discovered_alternatives[:10]
                )
                + "</ul></details>"
            )
        cards.append(f"""
        <article class="card bucket-{html.escape(r.review_bucket[:1])}">
          <div class="art">{image}</div>
          <h2>{html.escape(r.club_name)}</h2>
          <div class="id">club_id {html.escape(str(r.club_id))}</div>
          <dl>
            <dt>Bucket</dt><dd>{html.escape(r.review_bucket)}</dd>
            <dt>Identity</dt><dd>{html.escape(r.identity_status)}</dd>
            <dt>Technical</dt><dd>{html.escape(r.technical_quality_status)}</dd>
            <dt>Dimensions</dt><dd>{r.width or "?"} × {r.height or "?"}</dd>
            <dt>MIME</dt><dd>{html.escape(r.mime_type or "?")}</dd>
            <dt>Bytes</dt><dd>{r.file_size_bytes or "?"}</dd>
            <dt>SHA-256</dt><dd><code>{html.escape(r.sha256 or "")}</code></dd>
            <dt>Source</dt><dd>{html.escape(r.source_type or "?")}</dd>
            <dt>Rights</dt><dd>{html.escape(r.rights_status)}</dd>
          </dl>
          <p class="url"><b>Input:</b> {html.escape(r.candidate_url or "—")}</p>
          <p class="url"><b>Final:</b> {html.escape(r.final_url or "—")}</p>
          <p class="err">{html.escape(r.error)}</p>
          {alternatives}
        </article>
        """)
    output.write_text(f"""<!doctype html>
<html lang="en-GB"><meta charset="utf-8">
<title>PitchKind club badge audit review</title>
<style>
body{{font-family:system-ui,sans-serif;background:#f4f6f5;color:#111;margin:0;padding:24px}}
h1{{margin:0 0 8px}} .note{{max-width:1000px;margin-bottom:24px;color:#46564c}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}}
.card{{background:#fff;border:1px solid #d8e0da;border-radius:16px;padding:16px;overflow:hidden}}
.art{{height:190px;display:flex;align-items:center;justify-content:center;background:#fafafa;border-radius:12px}}
.art img{{max-width:100%;max-height:180px;object-fit:contain}} .missing{{color:#777}}
h2{{font-size:18px;margin:12px 0 2px}} .id{{font-size:12px;color:#66756d;margin-bottom:10px}}
dl{{display:grid;grid-template-columns:95px 1fr;gap:4px 10px;font-size:12px}} dt{{font-weight:700}}
dd{{margin:0;overflow-wrap:anywhere}} code,.url{{font-size:10px;overflow-wrap:anywhere}} .err{{color:#8a2525;font-size:11px}}
.bucket-A{{border-left:6px solid #168848}} .bucket-B{{border-left:6px solid #d38b00}}
.bucket-C{{border-left:6px solid #7650b5}} .bucket-D,.bucket-F{{border-left:6px solid #a52626}}
</style>
<h1>PitchKind club badge acquisition review</h1>
<p class="note">Machine acquisition only. No third-party badge is promoted to production verified automatically.
Identity/provenance, technical quality and rights/use remain separate gates.</p>
<div class="grid">{''.join(cards)}</div>
</html>""", encoding="utf-8")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--output-dir", default="badge-audit-output")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--min-short-edge", type=int, default=DEFAULT_MIN_SHORT_EDGE)
    parser.add_argument("--max-clubs", type=int, default=0, help="0 = all catalogue rows")
    parser.add_argument("--browser-fallback", action="store_true")
    args = parser.parse_args()

    catalogue = json.loads(Path(args.catalog).read_text("utf-8"))
    clubs = catalogue.get("clubs")
    if not isinstance(clubs, list):
        raise SystemExit("catalog must contain a clubs array")
    if args.max_clubs > 0:
        clubs = clubs[:args.max_clubs]

    out = Path(args.output_dir)
    if out.exists():
        shutil.rmtree(out)
    assets = out / "assets"
    assets.mkdir(parents=True)

    results: list[Acquisition] = []
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, args.workers)
    ) as pool:
        futures = [
            pool.submit(
                download_one,
                club,
                assets,
                args.min_short_edge,
                args.timeout,
                args.browser_fallback,
            )
            for club in clubs
        ]
        for i, future in enumerate(
            concurrent.futures.as_completed(futures), 1
        ):
            result = future.result()
            results.append(result)
            print(
                f"[{i}/{len(futures)}] {result.club_id} {result.club_name}: "
                f"{result.review_bucket} / {result.technical_quality_status}"
            )

    manifest = [
        asdict(r) for r in sorted(results, key=lambda x: str(x.club_id))
    ]
    (out / "badge-manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", "utf-8"
    )
    failures = [
        row for row in manifest
        if row["review_bucket"].startswith(("D_", "F_"))
    ]
    (out / "badge-errors.json").write_text(
        json.dumps(failures, indent=2, ensure_ascii=False) + "\n", "utf-8"
    )

    counts: dict[str, int] = {}
    for result in results:
        counts[result.review_bucket] = counts.get(result.review_bucket, 0) + 1
    summary = {
        "catalog": args.catalog,
        "rows_processed": len(results),
        "min_short_edge": args.min_short_edge,
        "browser_fallback": bool(args.browser_fallback),
        "bucket_counts": dict(sorted(counts.items())),
        "important_boundary": (
            "No third-party badge is automatically promoted to verified "
            "or rights-cleared."
        ),
    }
    (out / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", "utf-8"
    )
    write_review_html(results, out / "badge-review.html")
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
