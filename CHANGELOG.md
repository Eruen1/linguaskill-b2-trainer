# Changelog

All notable changes to the Linguaskill Business B2 Trainer will be documented in this file.

## [v4.1.0] - 2026-11-11
### Added
- **Dynamic Thinking Budgets per Skill:** Optimized AI generation times tailored specifically to each module's complexity:
  - Writing & Speaking: Fast mode (~3–5s) for instant prompt generation.
  - Reading: Balanced depth (~8–10s) to ensure strict single-word gap validation.
  - Listening: High-depth reasoning (~12–15s) to construct robust B2 distractors and trap options.
- **Live AI Progress Banner:** Added a real-time visual loading banner with second counter and progress bar during AI generation and writing grading.

### Changed
- Migrated API model endpoint to `models/gemini-3.8-flash` with dynamic configuration support.
- Refactored `js/api.js` and `js/app.js` into modular architecture for clean separation of concerns.

## [v4.0.0] - 2026-11-10
### Added
- Modular VS Code & GitHub PWA architecture.
- Secure local UI for Gemini API Key configuration (`localStorage`).
- Service Worker (`sw.js`) and manifest support for offline mobile usage on Android.

## [v3.0.0] - 2026-11-08
### Added
- Live Gemini AI Task Generator (`🎲 Generate New B2 Task`) across all 4 modules.
- Instant AI Writing Grader (`✨ AI Instant B2 Grading`) with estimated Cambridge scores and model upgrades.

## [v2.0.0] - 2026-11-05
### Added
- Full alignment with official Cambridge Linguaskill Business exam structure (Reading, Listening, Writing, Speaking).
- Early submit button (`✓ Submit Early & Next →`) in the Speaking module.

## [v1.0.0] - 2026-11-01
### Added
- Initial prototype with Flashcards, 3D flip, 12-week study plan, and basic timers.