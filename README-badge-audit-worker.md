# PitchKind bulk club-badge audit worker

Status: candidate review tooling only.

It does not change the production app, canonical Selkent directory, or any
club-badge verification/rights status automatically.

Outputs:
- badge-manifest.json
- badge-errors.json
- badge-review.html
- assets/ exact acquired bytes
- summary.json

Review buckets:
A = exact bytes acquired + technical pass + strong identity + explicit project-approved rights -> visual review
B = identity and rights passed, but asset is too small
C = identity/provenance needs human review; all fallback-substituted assets are forced here
D = no candidate
E = rights hold; asset cannot reach A until rights_status is explicitly allowed
F = acquisition or technical failure

Rights are fail-closed. The current explicit allow-set is only:
- project_approved_asset

All other rights values, including legal_basis_not_reviewed, are held in E.
