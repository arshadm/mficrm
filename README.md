# AcquireDesk — Business Acquisition CRM

A full-featured CRM for tracking business acquisition opportunities from initial discovery through to offer accepted.

## Tech Stack

- **Frontend**: Nuxt 4 (Vue 3 Composition API, TypeScript)
- **Backend**: Nuxt server routes (h3/Nitro)
- **Database**: PostgreSQL 16 via Prisma
- **Auth**: nuxt-auth-utils (session-based)
- **Rich Text**: Tiptap
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
NUXT_SESSION_SECRET=your_random_32_character_string_here
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

The admin user and sample data are seeded on startup.

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
2. **Business Case** — Rich text strategic rationale, competitive advantage, risks
3. **Growth Plan** — Year 1/2 goals, marketing strategy, product roadmap
4. **Working Capital** — Cost breakdown with auto-calculated total
5. **Risk Checklist** — Pre-defined + custom risks with resolution tracking
6. **Valuation & Offers** — Valuation range bar, offer tracking
7. **Interactions** — Timeline of notes/calls/emails/meetings with file attachments

## Email Reminders

Configure SMTP via `.env`. A daily cron at 08:00 emails assigned users for businesses with `follow_up_date <= today`.

## Production Build

```bash
npm run build
node .output/server/index.mjs
```
