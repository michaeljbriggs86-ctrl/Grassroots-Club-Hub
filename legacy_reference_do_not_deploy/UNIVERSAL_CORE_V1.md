> AI COLLABORATION PROTOCOL NOTE — 2026-09-19  
> STATUS: **WRITTEN** historical reference only; **DO NOT DEPLOY**.  
> Any older “live”/“deployed” wording below is historical and not a current deployment claim.

# Grassroots Club Hub — Universal Core v2.2

This package is club-neutral. No club-specific tenant, team, player, badge, league or fixture examples are included.

## Master directory

The shared Supabase directory contains canonical County FAs, leagues, clubs, teams and aliases. Onboarding searches clubs directly, then loads the club's teams and competition/provider metadata.

The app does **not** ask the user to discover a County FA or league before finding their club. County FA and competition information are attributes of the selected directory records.

When the central directory has no strong club match, the `grassroots-directory` edge function checks the FA Full-Time public club search, normalises the discovered club/team/league records, stores them centrally, then returns the cached results. Repeated searches therefore use the database instead of repeating discovery.

## Onboarding

1. Find my club automatically / Enter manually
2. Club search and selection, or manual club details
3. Branding
4. Team review
5. Age-format rules
6. Club Admin account
7. Review and create

## Provider boundary

`competition_providers` remains the provider abstraction. Directory records carry provider keys and provider IDs so each club/team can use the correct public source without exposing provider mechanics during onboarding.

## Data isolation

Tenant club/team data remains club-scoped. The master directory stores public identity/competition metadata only; it does not contain private squad, parent, player, message, attendance or coaching data.
