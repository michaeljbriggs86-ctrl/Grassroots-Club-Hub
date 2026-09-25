import importlib.util
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

MODULE = pathlib.Path(__file__).parents[1] / "scripts" / "badge_catalogue_audit.py"
spec = importlib.util.spec_from_file_location("badgeaudit", MODULE)
badgeaudit = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = badgeaudit
spec.loader.exec_module(badgeaudit)

class BadgeCatalogueAuditTests(unittest.TestCase):
    def test_png_magic_sniff(self):
        data = b"\x89PNG\r\n\x1a\n" + b"x" * 32
        self.assertEqual(badgeaudit.sniff_mime(data, "text/plain"), "image/png")

    def test_true_svg_vector_passes(self):
        data = b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>'
        self.assertTrue(badgeaudit.svg_is_true_vector_bytes(data))
        self.assertEqual(
            badgeaudit.technical_quality("image/svg+xml", data, None, None, 512)[0],
            "pass_true_vector",
        )

    def test_raster_wrapped_svg_fails(self):
        data = b'<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AA=="/></svg>'
        self.assertFalse(badgeaudit.svg_is_true_vector_bytes(data))

    def test_320px_raster_is_low_resolution(self):
        status, _ = badgeaudit.technical_quality(
            "image/png", b"x", 320, 320, 512
        )
        self.assertEqual(status, "fail_low_resolution_320x320")

    def test_512px_raster_passes(self):
        status, _ = badgeaudit.technical_quality(
            "image/png", b"x", 512, 700, 512
        )
        self.assertEqual(status, "pass_raster_512x700")

    def test_logo_scoring(self):
        logo = badgeaudit.score_image_url(
            "https://club.test/assets/club-logo-1200.png"
        )
        banner = badgeaudit.score_image_url(
            "https://club.test/assets/sponsor-banner.jpg"
        )
        self.assertGreater(logo, banner)

    def test_html_discovers_logo_first(self):
        body = """
        <html><head><meta property="og:image" content="/hero.jpg"></head>
        <body>
        <img src="/sponsor-banner.jpg" alt="Sponsor">
        <img src="/assets/club-logo-1200.png" alt="Club logo">
        </body></html>
        """
        urls = badgeaudit.extract_page_image_urls(
            "https://club.test/home", body
        )
        self.assertTrue(urls)
        self.assertEqual(
            urls[0], "https://club.test/assets/club-logo-1200.png"
        )


    def test_rights_gate_blocks_unreviewed_asset_from_ready_bucket(self):
        self.assertEqual(
            badgeaudit.review_bucket_for(
                "pass_raster_512x700",
                "strong_match",
                "legal_basis_not_reviewed",
                False,
            ),
            "E_rights_hold",
        )

    def test_project_approved_asset_can_reach_ready_bucket(self):
        self.assertEqual(
            badgeaudit.review_bucket_for(
                "pass_raster_512x700",
                "strong_match",
                "project_approved_asset",
                False,
            ),
            "A_ready_visual_review",
        )

    def test_fallback_asset_forces_identity_review(self):
        class Response:
            url = "https://club.test/assets/fallback-logo.png"
            status_code = 200
            headers = {"content-type": "image/png"}

        with tempfile.TemporaryDirectory() as td, \
             mock.patch.object(
                 badgeaudit,
                 "fetch_bytes",
                 side_effect=[
                     ValueError("primary failed"),
                     (b"\x89PNG\r\n\x1a\n" + b"x" * 64, Response()),
                 ],
             ), \
             mock.patch.object(
                 badgeaudit,
                 "source_alternatives",
                 return_value=["https://club.test/assets/fallback-logo.png"],
             ), \
             mock.patch.object(
                 badgeaudit, "image_dimensions", return_value=(1024, 1024)
             ), \
             mock.patch.object(
                 badgeaudit,
                 "technical_quality",
                 return_value=("pass_raster_1024x1024", None),
             ):
            result = badgeaudit.download_one(
                {
                    "club_id": 2,
                    "club_name": "Fallback FC",
                    "logo_status": "unverified",
                    "identity_match_status": "confirmed",
                    "rights_status": "project_approved_asset",
                    "logo_candidate_url": "https://club.test/missing.png",
                    "official_website": "https://club.test/",
                },
                pathlib.Path(td),
                512, 1, False,
            )
            self.assertTrue(result.fallback_used)
            self.assertEqual(result.identity_status, "confirmed")
            self.assertEqual(result.review_bucket, "C_identity_needs_review")
            self.assertIn("source-page alternative acquired", result.error)

    def test_no_candidate_bucket(self):
        with tempfile.TemporaryDirectory() as td:
            result = badgeaudit.download_one(
                {"club_id": 1, "club_name": "Example", "logo_status": "missing"},
                pathlib.Path(td),
                512, 1, False,
            )
            self.assertEqual(result.review_bucket, "D_no_candidate")

if __name__ == "__main__":
    unittest.main()
