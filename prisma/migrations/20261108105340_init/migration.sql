-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "timezone" TEXT DEFAULT 'UTC',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'initial_interest',
    "description" TEXT,
    "listing_url" TEXT,
    "asking_price" DOUBLE PRECISION,
    "revenue_multiple" DOUBLE PRECISION,
    "trailing_12m_revenue" DOUBLE PRECISION,
    "trailing_12m_profit" DOUBLE PRECISION,
    "platform" TEXT,
    "date_listed" DATE,
    "date_added" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_to" INTEGER,
    "follow_up_date" DATE,
    "follow_up_note" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_case" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "strategic_rationale" TEXT,
    "target_market" TEXT,
    "competitive_advantage" TEXT,
    "key_risks" TEXT,
    "assumptions" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_plan" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "year1_goals" TEXT,
    "year2_goals" TEXT,
    "marketing_strategy" TEXT,
    "product_roadmap" TEXT,
    "team_requirements" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_capital" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "acquisition_cost" DOUBLE PRECISION,
    "legal_fees" DOUBLE PRECISION,
    "transition_costs" DOUBLE PRECISION,
    "initial_marketing_budget" DOUBLE PRECISION,
    "tech_infrastructure" DOUBLE PRECISION,
    "working_capital_buffer" DOUBLE PRECISION,
    "other_costs" DOUBLE PRECISION,
    "other_costs_notes" TEXT,
    "total_estimated" DOUBLE PRECISION,
    "funding_source" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "working_capital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_checklist" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuation" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "valuation_method" TEXT,
    "estimated_value_low" DOUBLE PRECISION,
    "estimated_value_mid" DOUBLE PRECISION,
    "estimated_value_high" DOUBLE PRECISION,
    "initial_offer" DOUBLE PRECISION,
    "max_offer" DOUBLE PRECISION,
    "final_offer_made" DOUBLE PRECISION,
    "offer_notes" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "type" TEXT,
    "title" TEXT,
    "body" TEXT,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" SERIAL NOT NULL,
    "interaction_id" INTEGER,
    "business_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "next_steps" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "due_date" DATE NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "parent_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completion_note" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "next_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "businesses_is_archived_stage_idx" ON "businesses"("is_archived", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "business_case_business_id_key" ON "business_case"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "growth_plan_business_id_key" ON "growth_plan"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "working_capital_business_id_key" ON "working_capital"("business_id");

-- CreateIndex
CREATE INDEX "risk_checklist_business_id_idx" ON "risk_checklist"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "valuation_business_id_key" ON "valuation"("business_id");

-- CreateIndex
CREATE INDEX "interactions_business_id_occurred_at_idx" ON "interactions"("business_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_filename_key" ON "attachments"("filename");

-- CreateIndex
CREATE INDEX "attachments_interaction_id_idx" ON "attachments"("interaction_id");

-- CreateIndex
CREATE INDEX "next_steps_business_id_is_primary_status_idx" ON "next_steps"("business_id", "is_primary", "status");

-- CreateIndex
CREATE INDEX "next_steps_parent_id_idx" ON "next_steps"("parent_id");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_case" ADD CONSTRAINT "business_case_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_plan" ADD CONSTRAINT "growth_plan_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_capital" ADD CONSTRAINT "working_capital_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_checklist" ADD CONSTRAINT "risk_checklist_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuation" ADD CONSTRAINT "valuation_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_steps" ADD CONSTRAINT "next_steps_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_steps" ADD CONSTRAINT "next_steps_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "next_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_steps" ADD CONSTRAINT "next_steps_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_steps" ADD CONSTRAINT "next_steps_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
