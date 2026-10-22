# Approved Sunday morning graphic assets

Prepared 22 October 2026 for the Shooters Hill AFC visual redesign. The user approved the Sunday morning direction and authorised live-page implementation on 22 October 2026. This is asset preparation; it does not claim independent Claude approval or a live deployment.

- Approved Figma board: [Direction 03 · Sunday morning football · Graphic depth](https://www.figma.com/design/NY8QhcuOWiEcD0pKDTsbP8?node-id=518-10264).
- Current artwork brief and provenance: [Sunday morning graphics v04](https://drive.google.com/file/d/1hYOeHQgJeRKRfs3p05pY-3YBR2pP1vko/view).
- The full generated PNG originals are preserved in the project Drive. The asset table links each original; these production assets were encoded directly from those full-resolution originals, not from Figma preview derivatives.

## Raster assets

All images use WebP quality 90, method 6. Garments retain their full dimensions and exact original alpha-channel bytes. Field images retain their full dimensions. Only the fabric texture is resized, from 1254 × 1254 to 700 × 700 using Lanczos resampling. No compositing, retouching, recolouring or content changes were applied. Lossy WebP changes colour-channel samples through encoding.

The coach shirt is black, the goalkeeper shirt purple, and the outfield shirt green. Numbers, initials and the approved original club badge are added by the UI; none are baked into these blank garments. Coach badge placement is wearer left / viewer right, with initials on the opposite chest. The approved club badge is a separate existing application asset and is not modified here.

| File | Dimensions | Mode | Bytes | Original PNG | Original Drive file |
| --- | --- | --- | ---: | --- | --- |
| `pitch-portrait.webp` | 1122 × 1402 | RGB | 385,782 | `exec-e055a45a-4f39-4705-ab76-6de1cbdfd53f.png` | [Original](https://drive.google.com/file/d/16MZcFSGfZOSdeEGSMVF1ivW_FnXCmv2Q/view) |
| `pitch-wide.webp` | 1672 × 941 | RGB | 345,164 | `exec-bdb0bfc4-a884-4f53-bd10-e664ee7592b9.png` | [Original](https://drive.google.com/file/d/16Inb32klrG0CQ5r_w2CesbGhDwsSmBTB/view) |
| `shirt-coach.webp` | 1211 × 1299 | RGBA | 288,524 | `exec-a29c2c01-4417-4c57-ae5f-d49aed62eb96.png` | [Original](https://drive.google.com/file/d/1v7MMt0siZwIJ0JGfWmglWROUibLb7c3H/view) |
| `shirt-goalkeeper.webp` | 1312 × 1199 | RGBA | 244,680 | `exec-52c59aa0-6770-48b5-b5c2-9b9bc4322a78.png` | [Original](https://drive.google.com/file/d/1Mo9toMy_7SJJNE1s7ZYD_Gmxuq3ZxJTz/view) |
| `shirt-outfield.webp` | 1145 × 1374 | RGBA | 220,012 | `exec-19839ea4-0892-4f29-a201-6a337064efaf.png` | [Original](https://drive.google.com/file/d/1MADtkzeq9xtsQoF4gYyRW8YchumzcBTK/view) |
| `fabric.webp` | 700 × 700 | RGB | 115,206 | `exec-40760316-68b7-4128-9e7c-2a3d58de651c.png` | [Original](https://drive.google.com/file/d/1HbV_-p2-OUINTsG2qMSiJpImhPGluArj/view) |

### SHA-256 checksums

| Asset | Production WebP SHA-256 | Original PNG SHA-256 |
| --- | --- | --- |
| `pitch-portrait.webp` | `2fcc6bd8bb61265ae7782c2939b53a5ca8b83581177d7433eaf0cf2366bf1d86` | `c50908470f6332829493df28248465e14a34b72643c01d5a080aea306f3d6291` |
| `pitch-wide.webp` | `4a6bbd038ae13a723fa9a513c0eca99bad4855090177153f3ac92e485c185cb1` | `84afedcc375466c7c8f32aac5a8e437bc0f8ada897c11411297de6b26cee6cbc` |
| `shirt-coach.webp` | `f587dd578af929f9192ed9f9c3ea39347b4300786872be2f8b0196de3c4ce08f` | `4d824b7dbae7835be7b85d5b1dbd489f8b5351b498fe87a1ed5054f6210f056e` |
| `shirt-goalkeeper.webp` | `e5197ce6e9474f3567e18587dbea93a954821434f33ae9f3995b05f01504313e` | `3339aa9a5a3e2ffe2724afc73e912c2bc42d7dd263f2e539e8cc4c26931b6fcd` |
| `shirt-outfield.webp` | `701997beceba262d39201d9c6dc15e2dd78fcd3cab0f1064ee35e2bd02c98ace` | `4e7198076203756d501e3e40903a762ccc9b3bc0370b555d565bd66e131d1dbc` |
| `fabric.webp` | `b9ebef6ed2ec5c542afa9321800889770830d88b1fde6c039e1772c3bbe4bdb7` | `23742a7f73cd2c90fcac42b68cb5ecebf820d0396836d6a5d8601c260a1f9b4b` |

## Fonts

Full, unmodified TrueType files downloaded on 22 October 2026 from the official [Google Fonts source repository](https://github.com/google/fonts). Each retains its complete accompanying SIL Open Font License 1.1 file. Fonts are self-hosted; no external font service is required.

| File | Family / style | Weight | Bytes | Official source | SHA-256 |
| --- | --- | ---: | ---: | --- | --- |
| `barlow-condensed-bold.ttf` | Barlow Condensed / Bold | 700 | 109,912 | [Google Fonts](https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/BarlowCondensed-Bold.ttf) | `e476562ec9c1e16cf16475895b511f08c804f438cc9a9f80a44ea50a0eeb5b65` |
| `anton-regular.ttf` | Anton / Regular | 400 | 170,812 | [Google Fonts](https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf) | `a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab` |

License files: `barlow-condensed-OFL.txt` and `anton-OFL.txt`. Barlow Condensed Bold supplies editable shirt numbers; Anton supplies approved condensed display headings. Use Inter for body text via the existing application font.

## Verification

Each encoded image was decoded successfully and checked against its intended dimensions and colour mode. All three garment alpha channels were compared byte-for-byte against their original PNG alpha channels. Font metadata was parsed to confirm the Barlow Condensed Bold and Anton Regular family/style identities. These checks verify the files only; integration and rendered-layout verification are separate.
