# AcquireDesk — Business Acquisition CRM

A full-featured CRM for tracking business acquisition opportunities from initial discovery through to offer accepted.

## Tech Stack

- **Frontend**: Nuxt 4 (Vue 3 Composition API, TypeScript)
- **Backend**: Nuxt server routes (h3/Nitro)
- **Database**: PostgreSQL 16 via Prisma
- **Auth**: nuxt-auth-utils (session-based)
- **Rich Text**: Tiptap
- **Forms**: FormKit (public forms sent to sellers)
- **AI**: Claude through the Claude Code CLI (`claude -p`, Sonnet 5.5 by default), signed in with a Claude subscription; SheetJS reads Excel documents
- **Notes**: Tiptap 3 (checklists, tables, images); chat answers rendered with marked + DOMPurify
- **Email**: Nodemailer
- **PDF Export**: pdfmake
- **CSV Export**: papaparse
- **Styling**: Tailwind CSS + shadcn-vue
- **State**: Pinia

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://mficrm:mficrm@localhost:5433/mficrm
NUXT_SESSION_PASSWORD=your_random_32_character_string_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=smtp_password
SMTP_FROM=crm@example.com
UPLOAD_DIR=./uploads
```

### 3. Start Postgres and apply migrations

Needs Docker. Postgres runs on host port 5433.

```bash
npm run db:up        # start Postgres (docker/docker-compose.yml)
npm run db:migrate   # apply migrations
```

### 4. Run dev server

The admin user is created on startup. In development an empty database also gets sample businesses; production doesn't, unless `SEED_SAMPLE_DATA=1`. Production refuses to create the admin with a missing or default `ADMIN_PASSWORD`.

```bash
npm run dev
```

### 5. Login

Navigate to `http://localhost:3000` and log in:
- Username: `admin` (or your `ADMIN_USERNAME`)
- Password: `changeme` (or your `ADMIN_PASSWORD`)

## Project Structure

```
mficrm/
├── app/
│   ├── assets/css/main.css       # Tailwind + theme
│   ├── components/               # Reusable Vue components
│   │   └── ui/                   # Base UI components
│   ├── composables/              # Vue composables
│   ├── layouts/                  # App layouts
│   ├── middleware/               # Route middleware
│   ├── pages/                    # File-based routing
│   │   ├── dashboard.vue
│   │   ├── pipeline.vue
│   │   ├── login.vue
│   │   ├── businesses/
│   │   │   ├── index.vue         # Business list
│   │   │   ├── new.vue           # Create business
│   │   │   └── [id].vue          # Detail page (7 tabs)
│   │   └── settings/users.vue
│   ├── plugins/                  # Nuxt plugins
│   └── stores/                   # Pinia stores
├── server/
│   ├── api/                      # REST API routes
│   ├── db/                       # DB connection, migration, seed
│   ├── middleware/               # Server middleware
│   ├── plugins/                  # Nitro init plugin
│   └── utils/                    # Auth, email, cron utilities
├── shared/
│   ├── schemas/                  # Zod validation schemas
│   └── types/                    # TypeScript types
├── prisma/                       # Prisma schema and migrations
├── docker/                       # Local Postgres (docker compose)
├── uploads/                      # File uploads (auto-created)
└── .env.example
```

## Features

### Pipeline Stages
1. Initial Interest → 2. Qualified → 3. Seller Engaged → 4. Offer Made → 5. Offer Accepted
- Terminal: Rejected / Offer Rejected

### Business Detail Tabs
1. **Overview** — Core fields, stage, financials, follow-up tracking
2. **Documents** — The listing export (PDF) and P&L accounts (CSV/Excel), an AI summary, and "Ask about this company"
3. **Next Steps** — Tasks and subtasks with due dates
4. **Business Case** — Rich text strategic rationale, competitive advantage, risks
5. **Growth Plan** — Year 1/2 goals, marketing strategy, product roadmap
6. **Working Capital** — Cost breakdown with auto-calculated total
7. **Risk Checklist** — Pre-defined + custom risks with resolution tracking
8. **Valuation & Offers** — Valuation range bar, offer tracking
9. **Interactions** — Timeline of notes/calls/emails/meetings with file attachments
10. **Forms** — Forms made for this company (blank or drafted by AI) and the links sent to the seller

## AI Assistance

The AI features run the [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI headless on the server,
signed in with a Claude subscription instead of an API key (model `CLAUDE_MODEL`, default `claude-sonnet-5-5`).
Locally, install the CLI and sign in once (`npm run claude:login:local`); the app uses your login. In production
the login is kept on the data volume: sign it in with `npm run claude:login` (see `docs/deploy.md`). **Settings → Claude** shows whether it's signed in.

- **Prefill**: when adding a business, attach its documents and let Claude fill in the name, financials and description.
- **Summary**: overview, key figures, strengths, risks, questions for the seller and gaps, stored on the business.
- **Chat**: the **Chat** button on a company opens a side pane for questions about it. Claude answers from the
  company's documents, details and notes, citing documents (click to open them). Conversations are saved and shared
  with the team, with a history, Stop, Copy and **Add to notes**. Saved prompts (Settings → Chat prompts) appear
  as suggestions, with placeholders such as `{{company}}` and `{{asking_price}}`.
- **AI-drafted forms**: Claude drafts a form for the seller from the documents; edit it in the form builder, then publish and send it.

Each user is limited to 60 AI requests an hour.

## Notes

The **Notes** button on a company opens the team's shared notes for it in the same side pane: rich text with
headings, checklists, tables, links and pasted or dropped images. Notes save automatically. A teammate's changes
appear in place, and if two people edit at once, the second saver chooses which version to keep. Claude reads the
notes when answering in the chat.

## Email Reminders

Configure SMTP via `.env`. A daily cron at 08:00 emails assigned users for businesses with `follow_up_date <= today`.

## Production Build

```bash
npm run build
node .output/server/index.mjs
```
