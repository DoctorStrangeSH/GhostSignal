# Case pack authoring contract

This document describes the current Ghost Signal 1.0 case-data architecture. It is deliberately compatible with the existing classic-script runtime; adding a case must not require converting the whole application to ES modules or changing `app.js`.

## Package layout

Recurring world characters live in `assets/data/shared/` and are loaded once, immediately after `core-init.js`. Each investigation owns a folder under `assets/data/cases/`:

```text
shared/
  npcs.js              # recurring NPC profiles used by multiple investigations
  dialogues/
    bartender.js       # default dialogue for Joe
    sergeant.js        # default dialogue for Mills

case-XXX/
  index.js          # CASE_XXX metadata and gameplay configuration
  locations.js      # locations registered by this case
  npcs.js           # NPCs owned by this case
  objects.js        # evidence and interactable objects
  evidence.js       # evidence-chain definitions
  endings.js        # endings registered for this case
  story.js          # authored chapter/prologue/epilogue text
  dialogues/
    *.js            # dialogue trees for this case
```

The current runtime still loads classic scripts from `index.html`. Add a new pack's scripts after `assets/data/core-init.js` and before `assets/data/cases/case-index.js`. Preserve dependency order:

1. `assets/data/shared/npcs.js` and `assets/data/shared/dialogues/*.js` once, before any case pack; then each case's `locations.js`, `npcs.js`, and `objects.js`
2. `evidence.js` and `endings.js`
3. `story.js` and all dialogue files
4. The pack's `index.js` declaring `CASE_XXX`
5. Add `"case-XXX": CASE_XXX` to `case-index.js`

The existing packs are the reference for exact data shapes. Do not load the template file itself in production.

## Ownership rules

- `CASE_XXX.id` must equal its key in `CASES_INDEX`.
- A case's `locations` and `npcs` list only the IDs that can participate in that investigation.
- `startLocation` must be one of the case's available locations and must exist in the location registry.
- IDs in the shared location, NPC, object, dialogue, evidence-chain and ending registries are global. `registerData()` merges by ID; a duplicate silently overwrites the previous definition. Treat duplicate IDs as a data-integrity bug, not as a way to override another case.
- Reuse shared city locations and recurring characters; do not copy their definitions into a new case.
- Keep evidence chains and endings case-owned: each registered chain and ending must carry the matching `caseId`.
- Case-specific dialogue selection belongs in `CASE_XXX.npcDialogueOverrides`. The key must be an NPC listed in that case; the value must identify a dialogue authored for that same NPC. Do not add a `case:case-XXX` special condition to an NPC definition owned by another investigation.
- Use existing per-case state namespaces and serializers. Never clear or replace long-term player/NPC profiles when starting a new case.
- A fresh run must call `LocationManager.beginCase(caseData)`, which removes only unlocks tracked by the previous case and clears case visits before applying the new case's default locations. Permanent rewards and the shared city baseline survive.
- Case progression gates must call `unlockCaseLocation()`; story or account-wide rewards must call `unlockLocation()`. Do not use the permanent method for a warrant, clue, or case-only condition.
- Save restoration must use `setActiveCase()` instead of `beginCase()`. Keep both `permanentUnlockedLocations` and `caseUnlockedLocations` in the serialized location state. Legacy saves without ownership metadata are preserved conservatively: existing unlocks are treated as permanent rather than silently removed.

## Shared-character rules

The bartender and sergeant are recurring characters used by both existing investigations. Their canonical profiles live in `assets/data/shared/npcs.js`; their default dialogues live in `assets/data/shared/dialogues/`. These files load once before both case packs. Case-specific dialogue, reactions, and evidence remain owned by the consuming case and belong in that case's data. Never redeclare a shared NPC or duplicate a shared default dialogue inside an individual case pack.

## Validation before a case is accepted

Run:

```bash
npm run check
npm run validate:data
npm test
```

The data validator checks references, active NPC ownership, case-specific dialogue overrides, evidence reachability, ending coverage, and narrative/dialogue conditions. Add a regression test whenever a new runtime behavior or serialization field is introduced.

## Adding a future case

A new case is not part of the 1.0 release merely because its files exist. First complete the two-case end-to-end pass and verify that the shared-character ownership debt is resolved. Then add the new pack and validate that starting it cannot mutate the other cases' active state or long-term profile data.
