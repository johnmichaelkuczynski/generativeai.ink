---
name: Subject conversion blind spots
description: Non-obvious places that still carry the old course subject after a rebrand
---

When converting the course to a new subject (e.g. Evolutionary → Criminal Psychology), the obvious copy is in `artifacts/*/src/.../video_scenes/SceneN.tsx`. The easily-missed spots that strand old branding:

- `artifacts/<video-artifact>/index.html` — `<title>` plus `og:title`/`og:description` and `twitter:title`/`twitter:description` meta still name the old subject.
- `artifacts/<video-artifact>/YOUTUBE_DESCRIPTION.md` — a full per-artifact description (title options, topic list, hashtags, chapters) themed to the old subject.

**Why:** these files don't render in the app preview and don't show up in a `SceneN.tsx` text grep, so a scene-only conversion passes visual checks while metadata/docs keep the old subject.

**How to apply:** after editing scenes, run a repo-wide sweep for old-subject terms across the whole artifact dir (not just scenes), and check `index.html` + any `*DESCRIPTION*.md`. Keep one canonical YouTube description (repo-root `youtube-description.md`) and treat artifact-local copies as synced mirrors.

Two more easily-missed spots:

- **ALL sibling video/demo artifacts, not just the headline promo.** A subject rebrand must cover every `video`-kind artifact (e.g. `course-promo`, `qr-course-demo`, `diagnostics-demo`) plus their `.replit-artifact/artifact.toml` `title` (canvas/preview labels read from there). Update toml titles via `verifyAndReplaceArtifactToml` (temp `artifact.edit.toml` → validate), never edit the toml in place.
- **Demo videos are intentionally partial screencasts.** The `qr-course-demo` only ever shows a subset of topics (e.g. lectures 1.1–1.5 with a "6 Lectures" label) — that is original format, not a conversion bug. Per the user's "convert in place, keep format/length intact" preference, do NOT expand demo scenes to list every course topic; only re-theme the existing copy. A code review may flag this as "missing topics 1.6–1.8" — that's over-applying the main-app's topic count to a demo and should be declined.

- **`artifact.toml` titles hide from ripgrep because `.replit-artifact/` is a hidden dir.** `rg` skips dot-directories by default, so a repo-wide old-subject grep can return "CLEAN" while all four `artifacts/*/.replit-artifact/artifact.toml` `title` fields still carry the old subject. Always run the branding sweep with `rg --hidden` (and `--glob '!.git/**'`), or explicitly check each `artifact.toml`.

- **Banned framing words also hide inside seeded lecture BODIES, not just titles/metadata.** A tone/audience rebrand (e.g. strip "friendly"/"grown-up"/childish framing) must sweep the multi-paragraph lecture `body` template literals in `artifacts/api-server/src/lib/seed.ts`, where stray words like "friendly sentences" or "its grown-up version" survive a name-only rename. These are user-visible course text. **Why:** seed bodies are long prose, so a name-grep misses framing adjectives buried mid-sentence. **How to apply:** after fixing any seeded copy, you MUST bump `SEED_CONTENT_VERSION` again and restart the API so existing/prod DBs reseed — the earlier bump already wrote the unfixed copy, so a second copy edit needs its own version marker.

- **Open dashboards can retain the previous subject until both reseeding and client refetch complete.** A subject conversion is not verified by changed source or a landing-page screenshot: restart the API, confirm the live overview has the new title with zero incompatible progress/activity, and capture the dashboard itself. Configure course queries to refetch on mount and window focus so an already-open client cannot keep displaying the old curriculum.

**Why:** the visual shell can show the new brand while cached overview/activity responses still expose the former course schedule, grades, and attempts.

**How to apply:** after a subject swap, inspect live `/api/course/overview` and `/api/analytics/activity`, then verify `/dashboard`; if preserving old progress would mix two unrelated subjects, the content-version transaction must clear those dependent records.
