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

**Auth.** Sessions come from `nuxt-auth-utils`. Password hashing is custom (`salt:sha256` in `server/utils/auth.ts`). Client-side route guard: `app/middleware/auth.ts`. Server guard: `server/middleware/auth.ts`, which also leaves `/uploads/*` public.

**Frontend.** Nuxt 4 `app/` directory, Pinia stores (`app/stores/`), composables for business/next-step logic (`app/composables/`), and data fetched mostly with `$fetch`. Rich-text fields (business case, growth plan, interaction bodies) are HTML produced by Tiptap (`TiptapEditor.vue`) and rendered by `RichText.vue`. Base UI components are hand-written in `app/components/ui/`. `nuxt.config.ts` sets `pathPrefix: false`, so components register by filename alone (`ui/Button.vue` → `<Button>`, not `<UiButton>`). Component filenames must therefore be unique across all subfolders.

**Other server pieces.**
- File uploads are written to `UPLOAD_DIR` (`./uploads`) and served at `/uploads` via `nitro.publicAssets`.
- PDF and CSV exports use pdfmake and papaparse, under `server/api/businesses/**/export/`.
- `server/utils/cron.ts` runs a daily job at 08:00 that emails follow-up reminders through Nodemailer (`server/utils/email.ts`).

**Config.** Environment variables are read in two ways: through `runtimeConfig` in `nuxt.config.ts`, and directly via `process.env` in `database.ts` and `seed.ts`.
