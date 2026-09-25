import copy, importlib.util, json, tempfile, unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "verification" / "verify_pilot_scope.py"
spec = importlib.util.spec_from_file_location("pilotscope", MODULE_PATH)
pilotscope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilotscope)

BASE_OVERRIDE = {
    "override_scope": "shooters_hill_pilot",
    "override_status": "ACTIVE",
    "scope_definition": {
        "max_clubs_in_active_roster": 1,
        "permitted_club_ids": [499],
        "distribution": "private pilot testers only, no public/app-store release, no monetization",
    },
    "overridden_clubs": [],
}
BASE_ROSTER = {
    "active_non_demo_clubs": [{"club_id": 499, "club_name": "Shooters Hill AFC"}],
    "distribution": {
        "audience": "private_pilot_testers_only",
        "named_pilot_testers": ["Mike Briggs"],
        "public_release": False,
        "app_store_release": False,
        "monetization": False,
        "ads": False,
        "sponsorship": False,
        "paid_distribution": False,
    },
}

class PilotScopeTests(unittest.TestCase):
    def assert_blocked(self, override, roster):
        with self.assertRaises(pilotscope.PilotScopeError) as cm:
            pilotscope.verify_scope(override, roster)
        self.assertIn("Pilot rights override no longer covers current scope", str(cm.exception))

    def test_current_shooters_hill_private_pilot_passes(self):
        out = pilotscope.verify_scope(copy.deepcopy(BASE_OVERRIDE), copy.deepcopy(BASE_ROSTER))
        self.assertTrue(out["scope_verified"])
        self.assertEqual(out["active_club_ids"], [499])

    def test_second_non_permitted_club_blocks(self):
        r=copy.deepcopy(BASE_ROSTER)
        r["active_non_demo_clubs"].append({"club_id":545,"club_name":"Bexley Borough FC"})
        self.assert_blocked(copy.deepcopy(BASE_OVERRIDE), r)

    def test_roster_size_over_max_blocks(self):
        o=copy.deepcopy(BASE_OVERRIDE); o["scope_definition"]["permitted_club_ids"]=[499,545]
        r=copy.deepcopy(BASE_ROSTER); r["active_non_demo_clubs"].append({"club_id":545})
        self.assert_blocked(o,r)

    def test_expired_override_blocks(self):
        o=copy.deepcopy(BASE_OVERRIDE); o["override_status"]="EXPIRED"
        self.assert_blocked(o,copy.deepcopy(BASE_ROSTER))

    def test_public_or_commercial_distribution_blocks(self):
        for key in ("public_release","app_store_release","monetization","ads","sponsorship","paid_distribution"):
            with self.subTest(key=key):
                r=copy.deepcopy(BASE_ROSTER); r["distribution"][key]=True
                self.assert_blocked(copy.deepcopy(BASE_OVERRIDE),r)

    def test_outside_named_pilot_audience_blocks(self):
        r=copy.deepcopy(BASE_ROSTER); r["distribution"]["audience"]="public"
        self.assert_blocked(copy.deepcopy(BASE_OVERRIDE),r)

    def test_empty_named_tester_list_blocks(self):
        r=copy.deepcopy(BASE_ROSTER); r["distribution"]["named_pilot_testers"]=[]
        self.assert_blocked(copy.deepcopy(BASE_OVERRIDE),r)

    def test_overridden_club_not_in_permitted_scope_blocks(self):
        o = copy.deepcopy(BASE_OVERRIDE)
        o["overridden_clubs"] = [{
            "club_id": 999,
            "rights_status_at_override": "legal_basis_not_reviewed",
            "reason": "test",
        }]
        self.assert_blocked(o, copy.deepcopy(BASE_ROSTER))

    def test_only_unreviewed_rights_can_be_overridden(self):
        good=copy.deepcopy(BASE_OVERRIDE)
        good["scope_definition"]["permitted_club_ids"]=[499,238]
        good["overridden_clubs"]=[{
            "club_id":238,
            "rights_status_at_override":"legal_basis_not_reviewed",
            "reason":"manual curation, pilot use only",
        }]
        out=pilotscope.verify_scope(good,copy.deepcopy(BASE_ROSTER))
        self.assertEqual(out["overridden_club_ids"],[238])
        bad=copy.deepcopy(good)
        bad["overridden_clubs"][0]["rights_status_at_override"]="explicit_site_reproduction_restriction_review_required"
        self.assert_blocked(bad,copy.deepcopy(BASE_ROSTER))

    def test_runtime_marker_contains_source_hashes(self):
        with tempfile.TemporaryDirectory() as td:
            td=Path(td); op=td/"override.json"; rp=td/"roster.json"; js=td/"runtime.js"
            op.write_text(json.dumps(BASE_OVERRIDE)+"\n",encoding="utf-8")
            rp.write_text(json.dumps(BASE_ROSTER)+"\n",encoding="utf-8")
            runtime=pilotscope.build_runtime(op,rp)
            pilotscope.emit_runtime_js(runtime,js)
            text=js.read_text("utf-8")
            self.assertIn("scope_verified",text)
            self.assertIn("override_sha256",text)
            self.assertIn("roster_sha256",text)

if __name__=="__main__":
    unittest.main()
