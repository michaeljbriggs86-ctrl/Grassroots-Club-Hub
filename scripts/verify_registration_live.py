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
    for name in ("register.html", "registration.js", "registration.css", "cloud.js",
                 "player-onboarding.js", "service-worker.js", "index.html", "shooters-hill-logo.png"):
        source = ROOT / ("cloudflare/web-app/service-worker.js" if name == "service-worker.js"
                         else "app/src/main/assets/" + name)
        status, url, headers, body = fetch(SITE + "/" + name)
        digest = hashlib.sha256(body).hexdigest()
        match = status == 200 and body == source.read_bytes()
        evidence["assets"].append({"path": name, "status": status, "url": url,
                                   "sha256": digest, "source_match": match})
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
    )
    for name, target, method, payload, expected, message in checks:
        status, url, headers, body = fetch(target, method=method, payload=payload)
        result = json.loads(body)
        passed = status == expected and (message is None or result.get("error") == message)
        if name.startswith("mail-"):
            passed = passed and "no-store" in headers.get("Cache-Control", headers.get("cache-control", ""))
        evidence["guards"].append({"name": name, "status": status, "response": result, "passed": passed})
        if not passed:
            problems.append(name + ": unexpected response")
        print(("PASS" if passed else "FAIL"), name, status)

    (out / "readback.json").write_text(json.dumps(evidence, indent=2) + "\n")
    if problems:
        raise SystemExit("; ".join(problems))
    print("PASS exact public assets and unauthenticated guards; no mail, accounts, applications or access writes")


if __name__ == "__main__":
    main()
