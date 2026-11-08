# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AcquireDesk is a CRM for tracking business acquisition opportunities (Nuxt 4 full-stack app, PostgreSQL via Prisma 7). Setup, env vars and feature overview are in `README.md`.

## Commands

```bash
npm install            # also runs `prisma generate` and `nuxt prepare`
npm run db:up          # local Postgres 16 in Docker (host port 5433, docker/docker-compose.yml)
npm run db:migrate     # apply migrations; after a schema change: npm run db:migrate -- --name <change>
npm run dev            # dev server on http://localhost:3000 (default login admin / changeme)
npm run db:studio      # browse the database
npm run build          # production build → .output/
node .output/server/index.mjs   # run production build
```

There is no test suite, linter script, or typecheck script configured. `typescript.strict` is `false` in `nuxt.config.ts`.

## Architecture

**Schema and migrations.** The schema is `prisma/schema.prisma`, and migrations live in `prisma/migrations/`. Change the schema, run `npm run db:migrate -- --name <change>`, then `npm run db:generate`. Prisma 7's `migrate dev` no longer regenerates the client, so new models are otherwise `undefined` at runtime. Production applies pending migrations in `bin/docker-entrypoint` before the server starts, so migrations must be backwards compatible with the release still running. The generated client goes to `server/generated/prisma` (gitignored, created on `npm install`).

**Startup.** `server/plugins/init.ts` (Nitro plugin) runs `seedDatabase()` then `startCronJobs()`. `server/db/seed.ts` creates the admin user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` if missing, and inserts sample businesses only when the `businesses` table is empty and not in production (override with `SEED_SAMPLE_DATA=1`/`0`). In production it won't create the admin when `ADMIN_PASSWORD` is missing or `changeme`. To reset local data, run `npm run db:reset`.

**Database access.** Import `prisma` from `server/db/prisma.ts` by relative path. That file also provides:
- `idParam(event, name)`: parses a numeric route param, 404 otherwise.
- `orNotFound(write)`: turns Prisma's "missing row" and "missing foreign key" errors (P2025/P2003) into a 404.
- `toDate()` / `today()`: for date-only columns.

Things to preserve:
- **Names.** Models keep the original snake_case table and column names, because the API returns rows as-is and the frontend reads those names.
- **Joined columns.** Joins are flattened into the old aliased shape (`assigned_username`, `username`/`user_email`, `business_name`, `step_id`…) by helpers in `server/utils/rows.ts` and `server/utils/dueSteps.ts`.
- **Date-only columns** (`date_listed`, `follow_up_date`, `due_date`) are `@db.Date`. A client extension returns them as `'YYYY-MM-DD'` strings, which date inputs and due-date logic rely on. Write them with `toDate()`.
- **Timestamps** are `timestamptz` and serialise as ISO strings.
- **Search** must be case-insensitive (`mode: 'insensitive'`); SQLite's `LIKE` was.
- **Deleting a user** sets their references to NULL (`onDelete: SetNull`). Deleting a business cascades to everything under it.

**Data model.** `businesses` is the central entity. Per-business one-to-one tables (`business_case`, `growth_plan`, `working_capital`, `valuation`) have a `UNIQUE business_id`. Their GET/PATCH routes back the tabs on `app/pages/businesses/[id].vue`. One-to-many: `risk_checklist`, `interactions`, `attachments`, and `next_steps`, which uses `parent_id` for subtasks and `status` of `pending`/`done`/`skipped`. Everything cascades on business delete, except `forms.business_id`, which is set to NULL. A company's **documents** are its business-level attachments (no `interaction_id` or `form_submission_id`): PDF, CSV, XLSX and XLS only (`DOCUMENT_EXTENSIONS`), uploaded on create (`/businesses/new`) or from the Documents tab (`/api/businesses/[id]/documents`).

**AI assistance** (epic `mficrm-b6g`) runs the Claude Code CLI headless (`claude -p`), signed in with a Claude subscription rather than an API key, as in study-buddy. Everything is in `server/utils/ai.ts`. Each request is one CLI run, with no tools, MCP, settings, slash commands or saved session, in an empty temp working directory, so no CLAUDE.md is loaded. The run gets an environment allowlist: no `DATABASE_URL` or other app secrets. The prompt goes in on stdin as one `stream-json` user message, and the answer comes back as `stream-json` (`--include-partial-messages` for chat). `CLAUDE_MODEL` defaults to `claude-sonnet-5-5`. `CLAUDE_HOME` is the CLI's `HOME`, where its login lives: `/data/claude-home` in production, and unset locally, so your own login works (on macOS it's in the Keychain). `CLAUDE_BIN` overrides the binary; tests use a fake. `GET /api/ai/status` (`claudeStatus()`, which runs `claude auth status --json`, cached) tells the UI whether to show the AI buttons. Settings → Claude shows it, with "Check now" and the sign-in command. A failed call that says "Not logged in" marks it signed out at once.
- **Request layout.** Every request has the same prefix: the system prompt (`--system-prompt`), then the company's documents, with a cache breakpoint after the last one. That breakpoint **must use `ttl: '1h'`**: the CLI adds its own 1-hour breakpoints, and a 5-minute one before them is a 400. PDFs go as base64 document blocks, CSV as text, and Excel is converted to CSV per sheet with SheetJS (installed from the official cdn.sheetjs.com tarball, not npm). Task instructions and the company's current details (`businessContext()`) come after the documents, so they don't break the cache.
- **Structured answers** use `--json-schema` built from the Zod schemas in `app/shared/ai.ts` (`z.toJSONSchema`), and are parsed with Zod again. Choice fields there are plain strings, checked afterwards in our own code.
- **Errors.** `checkResult()` turns CLI results into readable HTTP errors: not signed in → 503, usage limit or overloaded → 429, API 400 → 422, refusal or `max_tokens` → 422, timeout → 504, and Stop → 499.

The features:
- `POST /api/ai/prefill`: reads files sent with the request; nothing is stored.
- `POST /api/businesses/[id]/ai/summary`: stores JSON in `businesses.ai_summary`.
- `POST /api/businesses/[id]/ai/form`: drafts a form. `draftToFormSchema()` (`server/utils/aiForms.ts`) normalises it, and it is saved as a draft form with `business_id`.
- **Company chat** (epic `mficrm-bwv`): `ai_chats` holds conversations per company, shared with the team; `messages` is a JSON array of `ChatMessage`.
  - `POST /api/businesses/[id]/chats/ask` saves the question, streams the answer as plain text (conversation id in `X-Chat-Id`), and saves the answer when it ends. That includes a partial answer marked `Stopped` when the browser closes the request, or one with an error. A failure mid-stream ends with `AI_STREAM_ERROR_MARKER`.
  - The CLI takes one message per run, so earlier turns go into the prompt as a `<conversation_so_far>` transcript (`server/utils/chats.ts`), along with the company's details and notes.
  - A question still unanswered for less than 3 minutes blocks another in the same conversation (409).
  - The answer cites documents as `[name.pdf, p. 3]`. `renderChatMarkdown()` (`app/utils/chatMarkdown.ts`: marked, then DOMPurify) turns those into links to `/uploads/…#page=3`. Never render model output as raw HTML without that sanitising.
  - Saved prompts (`ai_prompts`, team-wide, `{{company}}`-style placeholders, defaults inserted by a migration) are edited at Settings → Chat prompts.

AI routes are rate-limited to 60 requests per user per hour (`server/utils/aiLimits.ts`).

**Company notes and side pane** (epic `mficrm-bwv`). `business_notes` holds one shared rich-text document per company, as Tiptap HTML sanitised with `sanitizeNotes()` (`server/utils/html.ts`). It allows tables, checklists, and images only from `/uploads/<hex>.<img>`.
- **Saving.** `PUT /api/businesses/[id]/notes` takes `base_version` and answers 409 with the current notes when someone saved in between.
- **Images.** Pasted or dropped images are uploaded to `/notes/images` and stored as business attachments. The documents list filters them out by extension.
- **Panel** (`NotesPanel.vue`). It autosaves 800 ms after the last change, one write at a time, retries after 5 s, and polls every 15 s for teammates' saves. A conflict shows "Use their version / Keep mine".
- **Side pane.** `CompanyPane.vue` on the business page holds the Notes | Chat tabs. Its state is in `useCompanyPane()`, and its open state, width and tab are in localStorage. Both panels stay mounted once opened. "Add to notes" in the chat calls the notes panel's inserter. Tiptap packages are pinned at 3.31.3.

**Forms** (public-forms epic `mficrm-xln`) are a separate model. `forms.draft_schema` is the working copy edited at `/forms/[id]`. Publishing snapshots it into an immutable `form_versions` row (`version` 1, 2…), so later edits never change what was sent. Schemas are JSON in the `FormSchema` shape. `app/shared/forms.ts` holds the field types, `FormSchemaDefSchema` (validates definitions) and `buildSubmissionSchema()` (validates answers to a version on the server). `FormRenderer.vue` renders a schema for the builder preview and the public pages with **FormKit**. `app/utils/formkitSchema.ts` converts it into a FormKit schema with client-side rules. User text goes in under `__raw__` keys, because FormKit evaluates strings starting with `$` as expressions. `app/formkit.config.ts` sets Tailwind classes and bundles the icons; there's no FormKit theme stylesheet or CDN request, so it works under the CSP. The renderer's `validate()` shows FormKit's messages. Pages then run the shared Zod check, and the server always validates again. All `@formkit/*` packages are pinned to 2.1.2 through `overrides` in `package.json`. A form may belong to one company (`forms.business_id`). The company's Forms tab lists its forms, and can start one blank or drafted by AI. Published forms can't be deleted, only archived. Links (`form_requests`) point at one form version. The token is 256 random bits in `/f/<token>`, built from `APP_URL`. Only its SHA-256 hash is stored (`server/utils/formRequests.ts`), so the URL appears once, in the create response. `expired` isn't stored: `effectiveStatus()` derives it from `expires_at` (default 14 days). Links are created from the business page's Forms tab or the form builder (`FormLinksPanel.vue`). The public page is `/f/[token]` (layout `public`), served by `/api/public/forms/[token]`. That path is exempt from the session guard and authorised only by the token (`server/utils/publicForms.ts`). It returns only the form itself. Unusable links get 410 with a reason, unknown tokens 404. Submission is one multipart POST: an `answers` JSON part, plus files in parts named `file:<fieldId>`. Answers are validated against the link's version, files are stored as `attachments` with `form_submission_id` (served to logged-in users only), and the link locks atomically on first submit. The endpoints are rate-limited per IP and per token (`server/utils/rateLimit.ts`, in memory), and submissions are capped at 50 MB. Viewing doesn't mark a link opened; the page's script does that, so mail link scanners don't count. A submission on a link tied to a business adds a `form_submission` interaction to its timeline, with the files attached. Answers are viewed at `/forms/submissions/[id]` (`FormAnswersView.vue`), rendered against the link's version.

**API routes.** These follow Nitro file conventions under `server/api/` (`[id].patch.ts`, `[id]/risks.post.ts`, and so on). Typical handler shape:
1. `getUserSession(event)` and throw 401 if there's no user. Each handler repeats this even though `server/middleware/auth.ts` already guards `/api/*` except `/api/auth/*`.
2. Validate the body with a Zod schema via `safeParse`, then throw 400 on failure.
3. Query with Prisma and return the row, flattened into the expected shape where relations are included.

Admin-only routes (`server/api/settings/users*`) check `session.user.role === 'admin'`.

Side effect to preserve: `PATCH /api/businesses/:id` inserts a `stage_change` row into `interactions` when the stage changes.

**Shared code.** Zod schemas and TS types live in `app/shared/schemas/` and `app/shared/types/`, not at a root `shared/` as the README says. Both client and server import them as `~/shared/...`. Enums such as pipeline stages (`BusinessStageEnum`) and categories are defined there and must stay in sync with the DB values.

**Auth.** Sessions come from `nuxt-auth-utils`. Passwords are hashed with scrypt in `server/utils/auth.ts`, stored as `scrypt$N$r$p$salt$hash`. Legacy `salt:sha256` hashes are still accepted and upgraded on the next successful login, so always hash through `hashUserPassword`. Failed logins are throttled in memory (`server/utils/loginRateLimit.ts`): 5 per username and 20 per IP per 15 minutes, then 429. The visitor IP comes from `TRUSTED_IP_HEADER` (`cf-connecting-ip` in production). Pages are guarded by `app/middleware/auth.global.ts`, which uses nuxt-auth-utils' `useUserSession()`. The session is loaded during server rendering, and logged-out visitors are redirected to `/login?redirect=…`; `/login` and the public `/f/*` prefix are exempt. The auth store's `user` is that session's user (typed in `shared/types/auth.d.ts`, the one file in the root `shared/` folder), so server and client render the same user. It refreshes or clears the session on login and logout, so call it rather than hitting the auth API directly. APIs are guarded by `server/middleware/auth.ts`.

**Frontend.** Nuxt 4 `app/` directory, Pinia stores (`app/stores/`), composables for business/next-step logic (`app/composables/`), and data fetched mostly with `$fetch`. Anything fetched during server rendering (top-level `await` in a page, `useAsyncData`, store actions it calls) must use `useFetch` or `useRequestFetch()`. Plain `$fetch` on the server doesn't forward the session cookie, so it gets a 401 and the client hydrates into the wrong markup. Rich-text fields (business case, growth plan, interaction bodies) are HTML produced by Tiptap (`TiptapEditor.vue`) and rendered by `RichText.vue`. Base UI components are hand-written in `app/components/ui/`. `nuxt.config.ts` sets `pathPrefix: false`, so components register by filename alone (`ui/Button.vue` → `<Button>`, not `<UiButton>`). Component filenames must therefore be unique across all subfolders.

**Dark mode.** `@nuxtjs/color-mode` puts `dark` on `<html>` (Tailwind `darkMode: 'class'`). The setting follows the OS until changed with `ThemeToggle.vue`, which is in both layouts. Dark token values are under `.dark` in `app/assets/css/main.css`. Prefer the theme tokens (`bg-card`, `text-muted-foreground`, …). When using a palette colour, add a dark variant alongside it. The convention is `bg-X-100 dark:bg-X-500/15`, `text-X-800 dark:text-X-300` and `border-X-300 dark:border-X-500/40`; gray maps to `muted` tokens. Chart.js can't read CSS, so `dashboard.vue` picks chart colours from `useColorMode()`.

**Other server pieces.**
- **Uploads** go through `storeUpload()` in `server/utils/files.ts`. It enforces a 20 MB limit, blocks active-content types (html, svg, js…) and stores files in `UPLOAD_DIR` under random names.
- **Serving uploads:** `server/routes/uploads/[...path].get.ts` serves them to logged-in users only, and only files recorded in `attachments`. Images, PDF and plain text display inline; everything else downloads. Responses carry a sandbox CSP.
- Uploads can't be Nitro public assets, because those are copied in at build time.
- `GET /api/health` is the public Kamal health check.
- **Security headers:** `server/middleware/00.security-headers.ts` sets them on every response, with HSTS in production only. `server/plugins/csp.ts` adds a nonce-based CSP to rendered pages, production only. External scripts, connections and fonts are blocked, so any new third-party resource needs a CSP change. Icons are bundled from `@iconify-json/*` (`fallbackToApi: false`) for the same reason.
- **Rich text** is sanitised on write with `sanitizeRichText()` (`server/utils/html.ts`). Escape plain text with `escapeHtml()` before putting it into HTML that is stored.
- PDF and CSV exports use pdfmake and papaparse, under `server/api/businesses/**/export/`.
- `server/utils/cron.ts` runs a daily job at 08:00 that emails follow-up reminders through Nodemailer (`server/utils/email.ts`).

**Config.** Server code reads environment variables directly through `process.env` (`DATABASE_URL`, `UPLOAD_DIR`, `ADMIN_*`, `SMTP_*`, `APP_URL`). The `runtimeConfig` values in `nuxt.config.ts` are not used. Session encryption uses `NUXT_SESSION_PASSWORD` (nuxt-auth-utils), not `NUXT_SESSION_SECRET`. AI: `CLAUDE_MODEL`, `CLAUDE_HOME`, `CLAUDE_BIN`.

**Hydration.** Server-rendered markup must match the client's. `useFormatting()` formats dates with a fixed `en-GB` locale and the `Europe/London` time zone; date-only values are formatted in UTC. Don't use `toLocale*String(undefined, …)`. `ui/Select.vue` marks the chosen `<option selected>`, because server rendering drops a `<select>`'s value.

**Deployment.** Kamal 2 (`config/deploy.yml`, `.kamal/secrets` from Bitwarden, `Dockerfile`, `bin/docker-entrypoint`); see `docs/deploy.md`. Postgres 16 runs as the `db` Kamal accessory (`mficrm-db`), and `DATABASE_URL` is built in `.kamal/secrets`. Nightly backups go to the R2 bucket `mficrm-backups` through two more accessories, `backups` (pg_dump) and `uploads-backup` (volume tarball). Kamal reads `.kamal/secrets` with dotenv, where `#` starts a comment even inside `$(…)`. There is a single app container; uploads live on the `mficrm_data` volume at `/data`. The runtime image keeps the full `/app`, including `node_modules`, because the entrypoint runs the Prisma CLI. It also installs the Claude Code CLI (pinned with `CLAUDE_CODE_VERSION`, auto-updater off). An admin signs it in once with `npm run claude:login` (`claude:status` checks it), and the uploads backup excludes `claude-home/`.


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
