# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AcquireDesk is a CRM for tracking business acquisition opportunities (Nuxt 4 full-stack app, SQLite via better-sqlite3). Setup, env vars and feature overview are in `README.md`.

## Commands

```bash
npm install            # also runs `nuxt prepare` (regenerates .nuxt/ types)
npm run dev            # dev server on http://localhost:3000 (default login admin / changeme)
npm run build          # production build → .output/
node .output/server/index.mjs   # run production build
```

There is no test suite, linter script, or typecheck script configured. `typescript.strict` is `false` in `nuxt.config.ts`.

## Architecture

**Startup.** `server/plugins/init.ts` (Nitro plugin) runs on every server start: `runMigrations()` → `seedDatabase()` → `startCronJobs()`. There is no migration framework:
- `server/db/migrate.ts` is a single `CREATE TABLE IF NOT EXISTS` block. Schema changes to existing tables are added as `try { db.exec('ALTER TABLE ... ADD COLUMN ...') } catch {}` lines at the end of that function.
- `server/db/seed.ts` creates the admin user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` if missing, and inserts sample businesses only when the `businesses` table is empty.
- To reset data, delete `db/crm.db*` and restart.

**Database access.** `getDb()` in `server/db/database.ts` returns a lazily created singleton (WAL mode, foreign keys ON). API handlers import it by relative path (e.g. `../../../db/database`) and write raw synchronous SQL with `db.prepare(...).run/get/all`. No ORM. Timestamps are written as `new Date().toISOString()`; booleans are stored as `0/1`.

**Data model.** `businesses` is the central entity. Per-business one-to-one tables (`business_case`, `growth_plan`, `working_capital`, `valuation`) have a `UNIQUE business_id`. Their GET/PATCH routes back the tabs on `app/pages/businesses/[id].vue`. One-to-many: `risk_checklist`, `interactions`, `attachments`, and `next_steps`, which uses `parent_id` for subtasks and `status` of `pending`/`done`/`skipped`. Everything cascades on business delete.

**API routes.** These follow Nitro file conventions under `server/api/` (`[id].patch.ts`, `[id]/risks.post.ts`, and so on). Typical handler shape:
1. `getUserSession(event)` and throw 401 if there's no user. Each handler repeats this even though `server/middleware/auth.ts` already guards `/api/*` except `/api/auth/*`.
2. Validate the body with a Zod schema via `safeParse`, then throw 400 on failure.
3. Run raw SQL and return the row.

Admin-only routes (`server/api/settings/users*`) check `session.user.role === 'admin'`.

Side effect to preserve: `PATCH /api/businesses/:id` inserts a `stage_change` row into `interactions` when the stage changes.

**Shared code.** Zod schemas and TS types live in `app/shared/schemas/` and `app/shared/types/`, not at a root `shared/` as the README says. Both client and server import them as `~/shared/...`. Enums such as pipeline stages (`BusinessStageEnum`) and categories are defined there and must stay in sync with the DB values.

**Auth.** Sessions come from `nuxt-auth-utils`. Passwords are hashed with scrypt in `server/utils/auth.ts`, stored as `scrypt$N$r$p$salt$hash`. Legacy `salt:sha256` hashes are still accepted and upgraded on the next successful login, so always hash through `hashUserPassword`. Failed logins are throttled in memory (`server/utils/loginRateLimit.ts`): 5 per username and 20 per IP per 15 minutes, then 429. The visitor IP comes from `TRUSTED_IP_HEADER` (`cf-connecting-ip` in production). `app/middleware/auth.ts` is a named (non-global) route middleware that no page currently uses, so pages are not guarded on the client. Server guard: `server/middleware/auth.ts`, which also leaves `/uploads/*` public.

**Frontend.** Nuxt 4 `app/` directory, Pinia stores (`app/stores/`), composables for business/next-step logic (`app/composables/`), and data fetched mostly with `$fetch`. Rich-text fields (business case, growth plan, interaction bodies) are HTML produced by Tiptap (`TiptapEditor.vue`) and rendered by `RichText.vue`. Base UI components are hand-written in `app/components/ui/`. `nuxt.config.ts` sets `pathPrefix: false`, so components register by filename alone (`ui/Button.vue` → `<Button>`, not `<UiButton>`). Component filenames must therefore be unique across all subfolders.

**Dark mode.** `@nuxtjs/color-mode` puts `dark` on `<html>` (Tailwind `darkMode: 'class'`). The setting follows the OS until changed with `ThemeToggle.vue`, which is in both layouts. Dark token values are under `.dark` in `app/assets/css/main.css`. Prefer the theme tokens (`bg-card`, `text-muted-foreground`, …). When using a palette colour, add a dark variant alongside it. The convention is `bg-X-100 dark:bg-X-500/15`, `text-X-800 dark:text-X-300` and `border-X-300 dark:border-X-500/40`; gray maps to `muted` tokens. Chart.js can't read CSS, so `dashboard.vue` picks chart colours from `useColorMode()`.

**Other server pieces.**
- File uploads are written to `UPLOAD_DIR` (`./uploads`) and served at runtime by `server/routes/uploads/[...path].get.ts`. They can't be Nitro public assets, because those are copied in at build time.
- `GET /api/health` is the public Kamal health check.
- PDF and CSV exports use pdfmake and papaparse, under `server/api/businesses/**/export/`.
- `server/utils/cron.ts` runs a daily job at 08:00 that emails follow-up reminders through Nodemailer (`server/utils/email.ts`).

**Config.** Server code reads environment variables directly through `process.env` (`DATABASE_URL`, `UPLOAD_DIR`, `ADMIN_*`, `SMTP_*`, `APP_URL`). The `runtimeConfig` values in `nuxt.config.ts` are not used. Session encryption uses `NUXT_SESSION_PASSWORD` (nuxt-auth-utils), not `NUXT_SESSION_SECRET`.

**Deployment.** Kamal 2 (`config/deploy.yml`, `.kamal/secrets` from Bitwarden, `Dockerfile`, `bin/docker-entrypoint`); see `docs/deploy.md`. It runs a single container, and the SQLite DB and uploads live on the `mficrm_data` volume at `/data`. The runtime image contains only `.output`: Nitro bundles server dependencies, including better-sqlite3's native binding.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
