# Changelog

All notable changes to Joe's PF2e Stuff are documented here. Versioning is date-based (`YYYY.MM.DD`).

## 2026.08.09

### Added
- **Nimble Dodge prompt** (`nimble-dodge.js`): before an attack roll resolves, prompts an eligible target's owner (or the GM) to spend the Nimble Dodge reaction for a +2 circumstance bonus to AC against that attack. Checks feat ownership, in-combat, not encumbered, and once-per-round use; applies the boosted AC to the in-flight roll and reverts the toggle afterward. Requires libWrapper.
  - **Nimble Dodge Prompt** setting (world, default on) to enable/disable the feature live.
  - **Nimble Dodge: GM Only** setting (world, default off): when enabled, only the GM is prompted, never the target's owner.
- `lib-wrapper` declared as a required module relationship in `module.json`.

## 2026.07.24

### Fixed
- **Timer Alarm** — end-of-timer sound now uses `foundry.audio.AudioHelper.play` instead of the removed bare `AudioHelper` global, fixing `AudioHelper is not defined` on v13+.

## 2026.07.18

### Added
- **Hide Effects Panel** setting (per-client, default on) — toggles the effects-panel override CSS live, no reload needed. Controls both the icon-hiding and the panel repositioning.

## 2026.07.17

### Added
- GitHub release pipeline (source-controlled compendium packs compiled in CI).
- Started with release date versioning theme
- `README.md`.

### Removed
- Non-functional Audio Auto Mix feature.
