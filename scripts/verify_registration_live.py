#!/usr/bin/env python3
"""Read-only first-party registration deployment checks. No email or account writes."""
from __future__ import annotations

import hashlib
import difflib
import json
import os
import subprocess
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://shootershillafc.app"
AUTH = "https://obntycksmkcnkprrcutg.supabase.co"
# Exact hosting addition observed on the existing main page, 15 October 2026.
# Registration must remain byte-exact and prohibit this third-party script.
MAIN_BEACON = b'''<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v4bc70e2c01a94c73b74392e4234840661791215815920" integrity="sha512-L0ha0OXavK/8okipN9F8BtP84dg9DUhPERbBXzwI6dgTA55d2+yweo3pn5CSFYs45/r8md2+xvUPtTdvTNRfjA==" data-cf-beacon='{"version":"2024.11.0","token":"10a09a2b669849c9b6d21b5eade55991","r":1,"spa":2}' crossorigin="anonymous"></script>\n'''


def fetch(url: str, *, method: str = "GET", payload: bytes | None = None):
    request = Request(url, method=method, data=payload, headers={
        "User-Agent": "PitchKind-deployment-verification/1.0",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
    })
    try:
        response = urlopen(request, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.geturl(), dict(response.headers), response.read()


def main():
    evidence = {"source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                "event_commit": os.environ.get("GITHUB_SHA", "local"), "assets": [], "guards": []}
    problems = []
    out = ROOT / "registration-live-review"
    out.mkdir(exist_ok=True)
    for name in ("register.html", "registration.js", "registration.css", "cloud.js", "kickoff-updates.js", "notifications.css", "app.js",
                 "player-onboarding.js", "service-worker.js", "index.html", "shooters-hill-logo.png",
                 "app-design-system.css", "static-feed-overlay.js"):
        source = ROOT / ("cloudflare/web-app/service-worker.js" if name == "service-worker.js"
                         else "app/src/main/assets/" + name)
        status, url, headers, body = fetch(SITE + "/" + name)
        digest = hashlib.sha256(body).hexdigest()
        expected = source.read_bytes()
        known_main_beacon = name == "index.html" and body == expected.replace(b"</body>", MAIN_BEACON + b"</body>", 1)
        match = status == 200 and (body == expected or known_main_beacon)
        evidence["assets"].append({"path": name, "status": status, "url": url,
                                   "sha256": digest, "source_match": match, "known_main_beacon": known_main_beacon})
        if name == "register.html":
            policy = {k.lower(): v for k, v in headers.items()}
            csp = policy.get("content-security-policy", "")
            cache = policy.get("cache-control", "")
            protected = all(item in csp for item in ("default-src 'none'", "script-src 'self';", "frame-ancestors 'none'", "https://obntycksmkcnkprrcutg.supabase.co")) and all(item in cache for item in ("no-store", "no-transform"))
            evidence["registration_policy"] = {"csp": csp, "cache_control": cache, "passed": protected}
            if not protected:
                problems.append("Registration policy is missing")
        if not match:
            problems.append(name + ": deployed bytes differ")
            if name.endswith(".html"):
                (out / name).write_bytes(body)
                difference = "".join(difflib.unified_diff(source.read_text().splitlines(True), body.decode().splitlines(True), fromfile="source/" + name, tofile="served/" + name))
                (out / (name + ".diff")).write_text(difference)
                print(difference[:12000])
        print(("PASS" if match else "FAIL"), name, status, digest)

    # Invalid tickets are rejected before redemption; no delivery job is created.
    checks = (
        ("mail-get", SITE + "/__registration_mail", "GET", None, 405, "Method not allowed"),
        ("mail-invalid-ticket", SITE + "/__registration_mail", "POST", b'{"ticket":"invalid"}',
         400, "Invalid delivery ticket"),
        ("edge-no-auth", AUTH + "/functions/v1/registration-invite", "POST", b"{}", 401, None),
        ("kickoff-mail-get", SITE + "/__kickoff_mail", "GET", None, 405, "Method not allowed"),
        ("kickoff-mail-invalid-lease", SITE + "/__kickoff_mail", "POST", b'{"id":"invalid","claim_token":"invalid"}', 400, "Invalid delivery lease"),
        ("kickoff-edge-no-auth", AUTH + "/functions/v1/kickoff-dispatch", "POST", b"{}", 401, "Unauthorised"),
    )
    for name, target, method, payload, expected, message in checks:
        status, url, headers, body = fetch(target, method=method, payload=payload)
        result = json.loads(body)
        passed = status == expected and (message is None or result.get("error") == message)
        if name.startswith(("mail-", "kickoff-mail-")):
            passed = passed and "no-store" in headers.get("Cache-Control", headers.get("cache-control", ""))
        evidence["guards"].append({"name": name, "status": status, "response": result, "passed": passed})
        if not passed:
            problems.append(name + ": unexpected response")
        print(("PASS" if passed else "FAIL"), name, status)

    (out / "readback.json").write_text(json.dumps(evidence, indent=2) + "\n")
    if problems:
        raise SystemExit("; ".join(problems))
    print("PASS registration policy, source assets (only the observed main-page hosting beacon allowed), and unauthenticated guards; no mail, accounts, applications or access writes")


if __name__ == "__main__":
    main()
