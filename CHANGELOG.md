# Changelog

All notable changes to Joe's PF2e Stuff are documented here. Versioning is date-based (`YYYY.MM.DD`).

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
