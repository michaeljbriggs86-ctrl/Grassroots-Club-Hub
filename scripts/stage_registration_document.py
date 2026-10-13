#!/usr/bin/env python3
"""Upload the unchanged approved PDF to existing private R2. Never commit the PDF."""
import argparse,hashlib,subprocess
from pathlib import Path
HASH='92cf3f0cde6c6c24690a6a48f75dbbc07b2f06b989f0d5f5e689cd4f8934565e'
p=argparse.ArgumentParser();p.add_argument('pdf',type=Path);p.add_argument('--upload',action='store_true');a=p.parse_args()
b=a.pdf.read_bytes()
if len(b)!=530161 or hashlib.sha256(b).hexdigest()!=HASH:raise SystemExit('STOP: PDF differs from the approved unchanged source')
print('Approved PDF: 530161 bytes; exact SHA256 verified')
if a.upload:
 subprocess.run(['npx','--yes','wrangler@4.142.0','r2','object','put',f'pitchkind-pilot-badges/registration-documents/shooters-hill/{HASH}.pdf','--file',str(a.pdf.resolve()),'--content-type','application/pdf','--remote'],check=True,cwd=Path(__file__).resolve().parents[1]/'cloudflare/web-app')
 print('Private upload completed. Verify authenticated document access before accepting registration.')
else:print('Check only. No remote storage changed. Use --upload with authorised Cloudflare credentials.')
