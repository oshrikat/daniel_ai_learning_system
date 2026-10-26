# AGENTS.md - Agent Workflow & Modular Architecture Map

- NEVER scan the whole repository or read `data/curriculum_accounting.js` / `data/curriculum_general.js` unless explicitly instructed.
- The monolithic `app.js` and `styles.css` have been retired into `archive/` (`archive/app.js.bak`, `archive/styles.css.bak`). NEVER recreate or edit monolithic files in the root directory.
- Plans must be ultra-concise: bullet points only, no code blocks in plan mode.
- Edit ONLY the specific single-responsibility module under `src/` relevant to the task, then run `node -c <module_path>` once to verify syntax and stop immediately.

## Clean Project Root Layout
- `index.html` — Main application shell & UI host (loads `styles/*.css`, `data/*.js`, 6 `src/db/` repository modules + `src/` application modules).
- `styles/` — Modular CSS styling (`main.css`, `blocks.css`, `tutor-chat.css`).
- `server/` — Lightweight local Python HTTP server (`server/server.py` + `/api/env`, `/api/state`, `/api/backup`).
- `data/` — Static curriculum data (`curriculum_general.js`, `curriculum_accounting.js`, `daniel_state.json`).
- `src/db/` — 3-Tier Database Repository Layer (zero vendor lock-in, instant `0ms` local write-through cache + debounced cloud sync).
- `src/` — Single-responsibility application modules (see below).
- `docs/` — Architecture & specification documentation (`README.md`, `LESSON_ENGINE_SPEC.md`, `architecture_explanation.md`, `README_HE.md`, `plan.md`).
- `archive/` — Retired backups (`archive/app.js.bak`, `archive/styles.css.bak`, git-ignored).

## 3-Tier Database Repository Layer (`src/db/` — 6 Files)
1. `src/db/IDatabaseRepo.js`: `IDatabaseRepo` unified repository contract (`init`, `testConnection`, `loadFullState`, `saveFullState`, `getAll`, `getById`, `add`, `update`, `delete`) + `fetchWithTimeout`.
2. `src/db/local/LocalRepo.js`: `LocalRepo` (`0ms` `localStorage` cache + background `server.py` `/api/state` mirror).
3. `src/db/github/GithubRepo.js`: `GithubRepo` (private/secret GitHub Gist cloud backend `daniel_ai_cloud_state.json` with auto-discovery & first-sync creation).
4. `src/db/firebase/FirebaseRepo.js`: `FirebaseRepo` (Firebase Realtime Database REST backend `${databaseUrl}/daniel_state.json`).
5. `src/db/custom/CustomRestRepo.js`: `CustomRestRepo` (5-minute swap adapter for any generic `GET` / `POST` / `PUT` JSON REST endpoint).
6. `src/db/DatabaseManager.js`: `DatabaseManager` write-through orchestrator (`saveFullState` / `saveState`, 1.2s debounced cloud sync, `purgeUnitImages`, `migrateToProvider`).

## Modular Application Map (`src/` — 18 Files)
1. `src/state/store.js`: Constants (`STORAGE_KEY = 'DANIEL_AI_V3_CLEAN'`), `TRACKS` (including Track 3 `study_help`), `appState` (with `dbConfig`, `deletedUnitIds`, `unitOverrides`, `studyHelpStats`), `performSmartMergeAndMigration`, auto-purging `saveAppState` wired to `DatabaseManager`, and `syncCloudDatabaseOnStartup`.
2. `src/services/uiServices.js`: `SoundService`, `showToast(message, type)`, Shabbat lock, and Calm Mode modal helpers.
3. `src/services/pdf/pdfExtractor.js`: Client-side PDF/Image lesson extractor (up to 15 pages, Y-coordinate line-break preservation, JPEG page snapshots).
4. `src/services/ai/geminiService.js`: `stripThinkTags` and `callGeminiAPI(model, apiKey, prompt, options)` with 35s `AbortController` timeout (Tier 1 Multimodal Primary).
5. `src/services/ai/groqService.js`: `callGrokAPI(apiKey, prompt, explicitModel, options)` with 25s timeout & Hebrew-only system guard (Tier 2 Fast Socratic Tutor).
6. `src/services/ai/openRouterService.js`: `callOpenRouterAPI(apiKey, prompt, explicitModel)` (Tier 3 Backup).
7. `src/services/ai/aiOrchestrator.js`: `callMultiTierAI`, `callGroqPreferredAI`, `AIService` (`parseHomeworkCardText`, `evaluateSocraticHomeworkStep`, `generateHomeworkSummaryExamFromCard`, `evaluateAccountingSummaryExamAnswer`, `generateLessonWithFallback`, etc.).
8. `src/components/scaleBlock.js`: `renderScaleBlock` (LOCKED MODULE: Interactive Balance Scale - DO NOT EDIT).
9. `src/components/journalGridBlock.js`: `renderJournalGridBlock` (Double-entry journal ledger drag/drop & dropdown table).
10. `src/components/exerciseStepper.js`: `renderExerciseBlock` (Interactive multiple-choice exercise question stepper).
11. `src/components/aiEvalBlock.js`: `renderAiEvalBlock` (Open-ended question with empowering AI evaluation).
12. `src/components/blockEngine.js`: Dispatcher `renderBlock` + lightweight blocks (`renderTextBlock`, `renderCompareBlock`, `renderCalloutBlock`, `renderChecklistBlock`, `renderSpreadsheetBlock`).
13. `src/components/globalAiBubble.js`: `GlobalAiAssistant` system-wide floating AI assistant bubble (`#global-ai-assistant-fab`) & RTL chat drawer (`#global-ai-assistant-drawer`) with async screen-context handoff, visible loading dialog, quick starter chips, and `callGroqPreferredAI` routing.
14. `src/controllers/roadmapController.js`: `showView`, `renderTrackTabs`, `renderRoadmap`, and Accounting Summary Exams zone.
15. `src/controllers/studyHelpController.js`: Track 3 Daily Lesson Hub, `BeatGenerator` multi-stage pipeline, `UnitBeatCursor` phased mastery loop & WhatsApp Groq Private Tutor, Stage 4 Grounded Homework & Table Solver, auto-purge on completion, and Summary Exam generator.
16. `src/controllers/unitPlayerController.js`: `renderUnitPlayer(unitId)` (Dynamic Block Engine + Exercise Stepper + `ai_eval_qa` completion gate + Summary Exam Player + Checkpoint tests).
17. `src/controllers/adminController.js`: `initAdminPortal`, `renderAdminOverview`, `renderAdminCurriculum`, `renderAdminNotes`, `renderAdminSettings`, and 5-minute 3-Tier Database Switcher UI.
18. `src/main.js`: `DOMContentLoaded` bootstrapper (including `GlobalAiAssistant.init()`).
