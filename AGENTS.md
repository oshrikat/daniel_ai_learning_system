# AGENTS.md - Agent Workflow & Modular Architecture Map

- NEVER scan the whole repository or read `data/curriculum_accounting.js` / `data/curriculum_general.js` unless explicitly instructed.
- The monolithic `app.js` has been retired into `archive/app.js.bak` and removed from the project root. NEVER recreate or edit `app.js` in the root directory.
- Plans must be ultra-concise: bullet points only, no code blocks in plan mode.
- Edit ONLY the specific single-responsibility module under `src/` relevant to the task, then run `node -c <module_path>` once to verify syntax and stop immediately.

## Clean Project Root Layout
- `index.html` — Main application shell & Admin Portal UI (loads `data/*.js` + 11 `src/` modules).
- `styles.css` — Styling, animations, and responsive layout.
- `server.py` — Lightweight local Python HTTP server + `/api/env`, `/api/state`, `/api/backup`.
- `data/` — Static curriculum data (`curriculum_general.js`, `curriculum_accounting.js`).
- `src/` — 11 single-responsibility application modules (see below).
- `docs/` — Architecture & specification documentation (`LESSON_ENGINE_SPEC.md`, `architecture_explanation.md`, `README_HE.md`, `plan.md`).
- `archive/` — Retired monolithic backup (`archive/app.js.bak`, git-ignored).

## Modular Architecture Map (`src/` — 11 Files, 3,603 Lines)
1. `src/state/store.js` (331 lines): Constants (`STORAGE_KEY = 'DANIEL_AI_V3_CLEAN'`), `TRACKS`, `appState`, `cleanApiKey`, `syncEnvKeysFromServer`, `performSmartMergeAndMigration`, and `saveAppState`.
2. `src/services/uiServices.js` (197 lines): `SoundService`, `showToast(message, type)`, Shabbat lock, and Calm Mode modal helpers.
3. `src/services/ai/geminiService.js` (48 lines): `stripThinkTags` and `callGeminiAPI(model, apiKey, prompt, options)` (Tier 1 Primary).
4. `src/services/ai/groqService.js` (57 lines): `callGrokAPI(apiKey, prompt, explicitModel, options)` with Hebrew-only system guard (Tier 2 Secondary).
5. `src/services/ai/openRouterService.js` (23 lines): `callOpenRouterAPI(apiKey, prompt, explicitModel)` (Tier 3 Backup).
6. `src/services/ai/aiOrchestrator.js` (463 lines): `callMultiTierAI(prompt, options)` and `AIService` (`testGemini`, `testGroq`, `testOpenRouter`, `generateLessonWithFallback`, `cleanAndParseJSON`).
7. `src/components/blockEngine.js` (690 lines): `renderBlock` dispatcher, `renderScaleBlock` (Stable - DO NOT EDIT), `renderJournalGridBlock`, `renderSpreadsheetBlock`, `renderExerciseBlock`, and `renderAiEvalBlock`.
8. `src/controllers/roadmapController.js` (283 lines): `showView`, `renderTrackTabs`, `renderRoadmap`, and cluster/unit card rendering.
9. `src/controllers/unitPlayerController.js` (651 lines): `renderUnitPlayer(unitId)` (Dynamic Block Engine + 5-question Exercise Stepper + `ai_eval_qa` completion gate + Legacy 4-step player + Checkpoint tests).
10. `src/controllers/adminController.js` (806 lines): `initAdminPortal`, `renderAdminOverview`, `renderAdminCurriculum`, `renderAdminNotes`, and `renderAdminSettings`.
11. `src/main.js` (54 lines): `DOMContentLoaded` bootstrapper.