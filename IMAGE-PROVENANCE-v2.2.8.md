# Image provenance - v2.2.8

## Authentication and main hero derivatives

Files:
- app/src/main/assets/football-login-adult.jpg
- app/src/main/assets/football-login-player.jpg
- app/src/main/assets/football-login-club.jpg
- app/src/main/assets/football-pitch-hero.jpg

Source: the generated 2048x740 hero files bundled in v2.2.7. Those source files contained the retired 'More Than A Game' accent on the far-right side. Original copies are retained under `legacy_reference_do_not_deploy/retired_hero_art_v2.2.7/`.

Operation for v2.2.8: crop to (left=0, top=162, right=1600, bottom=740), preserving the football/goal/player scene and removing the retired-text region; resize proportionally back to 2048x740 with Lanczos resampling; JPEG quality 94. No text, logo or badge was added. No person identity was introduced.

Tool: Python Pillow.
Generation tool/model/seed for the original v2.2.7 image: not exposed in the retained source package.
Date of derivative: 2026-09-21.

## Logo and launcher imagery

The six `pitchkind-wt_*.svg` files are copied byte-for-byte from the approved Drive assets. They are not redrawn. PNG launcher/PWA files are format/size conversions of `pitchkind-wt_app-icon.svg` using CairoSVG.
