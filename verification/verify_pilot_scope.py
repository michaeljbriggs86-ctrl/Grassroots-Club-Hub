#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

FAIL_MESSAGE = (
    "Pilot rights override no longer covers current scope. The rights gate must be "
    "reapplied: obtain proper rights clearance for all overridden clubs before "
    "proceeding, or update pilot_rights_override.json's scope with a new explicit approval."
)
ALLOWED_OVERRIDE_RIGHTS_STATUSES = {"legal_basis_not_reviewed"}

class PilotScopeError(RuntimeError):
    pass

def _fail(detail: str) -> None:
    raise PilotScopeError(f"{FAIL_MESSAGE}\nDETAIL: {detail}")

def _load(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    try:
        data = json.loads(raw)
    except Exception as exc:
        _fail(f"could not parse {path}: {exc}")
    if not isinstance(data, dict):
        _fail(f"{path} must contain a JSON object")
    return data, raw

def verify_scope(override: dict, roster: dict) -> dict:
    if override.get("override_scope") != "shooters_hill_pilot":
        _fail("override_scope is not shooters_hill_pilot")
    if override.get("override_status") != "ACTIVE":
        _fail("override_status is not ACTIVE")

    scope = override.get("scope_definition")
    if not isinstance(scope, dict):
        _fail("scope_definition is missing")
    permitted = [int(x) for x in scope.get("permitted_club_ids", [])]
    max_clubs = int(scope.get("max_clubs_in_active_roster", 0))
    if not permitted or max_clubs < 1:
        _fail("scope has no permitted clubs or invalid max roster")
    if 499 not in permitted:
        _fail("Shooters Hill canonical club_id 499 is not permitted")

    active_rows = roster.get("active_non_demo_clubs")
    if not isinstance(active_rows, list):
        _fail("active_non_demo_clubs is missing")
    active_ids = [int(row.get("club_id")) for row in active_rows]
    if len(active_ids) != len(set(active_ids)):
        _fail("active roster contains duplicate club IDs")
    if len(active_ids) > max_clubs:
        _fail(f"active roster has {len(active_ids)} clubs; max is {max_clubs}")
    outside = sorted(set(active_ids) - set(permitted))
    if outside:
        _fail(f"active roster contains non-permitted club IDs: {outside}")

    distribution = roster.get("distribution")
    if not isinstance(distribution, dict):
        _fail("distribution state is missing")
    if distribution.get("audience") != "private_pilot_testers_only":
        _fail("distribution audience is no longer private pilot testers only")
    testers = distribution.get("named_pilot_testers")
    if not isinstance(testers, list) or not testers or not all(str(x).strip() for x in testers):
        _fail("named pilot tester list is empty or invalid")

    forbidden = ("public_release","app_store_release","monetization","ads","sponsorship","paid_distribution")
    enabled = [name for name in forbidden if distribution.get(name) is True]
    if enabled:
        _fail("forbidden distribution/commercial flags enabled: " + ", ".join(enabled))

    overridden = override.get("overridden_clubs")
    if not isinstance(overridden, list):
        _fail("overridden_clubs must be a list")
    seen, override_ids = set(), []
    for row in overridden:
        if not isinstance(row, dict):
            _fail("each overridden_clubs item must be an object")
        cid = int(row.get("club_id"))
        if cid in seen:
            _fail(f"duplicate overridden club_id {cid}")
        seen.add(cid)
        rights = str(row.get("rights_status_at_override") or "")
        if rights not in ALLOWED_OVERRIDE_RIGHTS_STATUSES:
            _fail(
                f"club_id {cid} has rights_status_at_override={rights!r}; "
                "this pilot mechanism only permits legal_basis_not_reviewed"
            )
        if not str(row.get("reason") or "").strip():
            _fail(f"club_id {cid} has no override reason")
        override_ids.append(cid)

    outside_override = sorted(set(override_ids) - set(permitted))
    if outside_override:
        _fail(
            "overridden club IDs are outside permitted pilot scope: "
            + str(outside_override)
        )

    return {
        "scope_verified": True,
        "override_scope": override["override_scope"],
        "override_status": override["override_status"],
        "active_club_ids": active_ids,
        "permitted_club_ids": permitted,
        "overridden_club_ids": override_ids,
    }

def build_runtime(override_path: Path, roster_path: Path) -> dict:
    override, override_raw = _load(override_path)
    roster, roster_raw = _load(roster_path)
    runtime = verify_scope(override, roster)
    runtime["override_sha256"] = hashlib.sha256(override_raw).hexdigest()
    runtime["roster_sha256"] = hashlib.sha256(roster_raw).hexdigest()
    return runtime

def emit_runtime_js(runtime: dict, path: Path) -> None:
    payload = json.dumps(runtime, separators=(",", ":"), sort_keys=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "window.__PITCHKIND_PILOT_RIGHTS=Object.freeze(" + payload + ");\n",
        encoding="utf-8",
        newline="\n",
    )

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--override", default="app/src/main/assets/pilot_rights_override.json")
    parser.add_argument("--roster", default="verification/pilot_active_roster.json")
    parser.add_argument("--emit-runtime-js", default="")
    args = parser.parse_args()
    try:
        runtime = build_runtime(Path(args.override), Path(args.roster))
        if args.emit_runtime_js:
            emit_runtime_js(runtime, Path(args.emit_runtime_js))
    except PilotScopeError as exc:
        print(str(exc))
        return 2
    print("Pilot rights scope: PASS")
    print("Active non-demo club IDs:", runtime["active_club_ids"])
    print("Permitted pilot club IDs:", runtime["permitted_club_ids"])
    print("Rights-overridden badge club IDs:", runtime["overridden_club_ids"])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
