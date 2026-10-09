import copy, hashlib, pathlib, tempfile, unittest
from test_club_logo_quality import logoq, write_png

class PilotExceptionTests(unittest.TestCase):
    def test_exact_file_and_scope_boundaries(self):
        with tempfile.TemporaryDirectory() as td:
            p=pathlib.Path(td)/'badge.png';write_png(p,192,200)
            row={'club_id':372,'logo_status':'pilot_verified','logo_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
                 'rights_note':logoq.PILOT_RIGHTS_NOTE,'pilot_quality_exception':{'scope':'shooters_hill_protected_pilot',
                 'max_render_css_px':128,'native_width':192,'native_height':200,'quality_note':'below q1','no_upscaling':True}}
            manifest={'schema_version':1,'scope':'private_pilot','badges':[row]}
            self.assertEqual(logoq.check_pilot_exception(p,manifest,372,128),[])
            self.assertTrue(logoq.check_asset(p,512))
            for field,value in [('logo_sha256','0'*64),('logo_status','placeholder_monogram'),('rights_note','')]:
                changed=copy.deepcopy(manifest);changed['badges'][0][field]=value
                self.assertTrue(logoq.check_pilot_exception(p,changed,372,128))
            changed=copy.deepcopy(manifest);changed['scope']='public'
            self.assertTrue(logoq.check_pilot_exception(p,changed,372,128))
            self.assertTrue(logoq.check_pilot_exception(p,manifest,372,129))
            changed=copy.deepcopy(manifest);changed['badges'][0]['pilot_quality_exception']['native_width']=160
            self.assertTrue(logoq.check_pilot_exception(p,changed,372,128))
            write_png(p,191,200);row['logo_sha256']=hashlib.sha256(p.read_bytes()).hexdigest();row['pilot_quality_exception']['native_width']=191
            self.assertTrue(logoq.check_pilot_exception(p,manifest,372,128))

if __name__=='__main__':unittest.main()
