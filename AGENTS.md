# AGENTS.md - Agent Workflow & Modular Architecture Map

- NEVER scan the whole repository or read `data/curriculum_accounting.js` / `data/curriculum_general.js` unless explicitly instructed.
- The monolithic `app.js` and `styles.css` have been retired into `archive/` (`archive/app.js.bak`, `archive/styles.css.bak`). NEVER recreate or edit monolithic files in the root directory.
- Plans must be ultra-concise: bullet points only, no code blocks in plan mode.
- Edit ONLY the specific single-responsibility module under `src/` relevant to the task, then run `node -c <module_path>` once to verify syntax and stop immediately.

## Clean Project Root Layout
- `index.html` — Main application shell & UI host (loads `styles/*.css`, `data/*.js` + 15 `src/` modules).
- `styles/` — Modular CSS styling (`main.css`, `blocks.css`, `tutor-chat.css`).
- `server/` — Lightweight local Python HTTP server (`server/server.py` + `/api/env`, `/api/state`, `/api/backup`).
- `data/` — Static curriculum data (`curriculum_general.js`, `curriculum_accounting.js`, `daniel_state.json`).
- `src/` — 15 single-responsibility application modules (see below).
- `docs/` — Architecture & specification documentation (`README.md`, `LESSON_ENGINE_SPEC.md`, `architecture_explanation.md`, `README_HE.md`, `plan.md`).
- `archive/` — Retired backups (`archive/app.js.bak`, `archive/styles.css.bak`, git-ignored).

## Modular Architecture Map (`src/` — 15 Files)
1. `src/state/store.js`: Constants (`STORAGE_KEY = 'DANIEL_AI_V3_CLEAN'`), `TRACKS` (including Track 3 `study_help`), `appState`, `cleanApiKey`, `syncEnvKeysFromServer`, `performSmartMergeAndMigration`, and `saveAppState`.
2. `src/services/uiServices.js`: `SoundService`, `showToast(message, type)`, Shabbat lock, and Calm Mode modal helpers.
3. `src/services/ai/geminiService.js`: `stripThinkTags` and `callGeminiAPI(model, apiKey, prompt, options)` (Tier 1 Primary).
4. `src/services/ai/groqService.js`: `callGrokAPI(apiKey, prompt, explicitModel, options)` with Hebrew-only system guard (Tier 2 Secondary).
5. `src/services/ai/openRouterService.js`: `callOpenRouterAPI(apiKey, prompt, explicitModel)` (Tier 3 Backup).
6. `src/services/ai/aiOrchestrator.js`: `callMultiTierAI(prompt, options)`, `AIService` (`askStudyHelper`, `parseHomeworkCardText`, `evaluateSocraticHomeworkStep`, `generateHomeworkSummaryExamFromCard`, `evaluateAccountingSummaryExamAnswer`, `generateLessonWithFallback`, etc.).
7. `src/components/scaleBlock.js`: `renderScaleBlock` (LOCKED MODULE: Interactive Balance Scale - DO NOT EDIT).
8. `src/components/journalGridBlock.js`: `renderJournalGridBlock` (Double-entry journal ledger drag/drop & dropdown table).
9. `src/components/exerciseStepper.js`: `renderExerciseBlock` (Interactive multiple-choice exercise question stepper).
10. `src/components/aiEvalBlock.js`: `renderAiEvalBlock` (Open-ended question with empowering AI evaluation).
11. `src/components/blockEngine.js`: Dispatcher `renderBlock` + lightweight blocks (`renderTextBlock`, `renderCompareBlock`, `renderCalloutBlock`, `renderChecklistBlock`, `renderSpreadsheetBlock`).
12. `src/controllers/roadmapController.js`: `showView`, `renderTrackTabs`, `renderRoadmap`, Track 3 Study Help workspace, homework card uploader, accounting summary exam card.
13. `src/controllers/unitPlayerController.js`: `renderUnitPlayer(unitId)` (Dynamic Block Engine + Exercise Stepper + `ai_eval_qa` completion gate + Daily Study Card Socratic Player + Summary Exam Player + Checkpoint tests).
14. `src/controllers/adminController.js`: `initAdminPortal`, `renderAdminOverview`, `renderAdminCurriculum`, `renderAdminNotes`, and `renderAdminSettings`.
15. `src/main.js`: `DOMContentLoaded` bootstrapper.
