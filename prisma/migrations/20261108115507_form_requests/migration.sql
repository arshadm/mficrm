-- CreateTable
CREATE TABLE "form_requests" (
    "id" SERIAL NOT NULL,
    "form_id" INTEGER NOT NULL,
    "form_version_id" INTEGER NOT NULL,
    "business_id" INTEGER,
    "recipient_name" TEXT,
    "recipient_email" TEXT,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "emailed_at" TIMESTAMPTZ(3),
    "opened_at" TIMESTAMPTZ(3),
    "submitted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_requests_token_hash_key" ON "form_requests"("token_hash");

-- CreateIndex
CREATE INDEX "form_requests_form_id_idx" ON "form_requests"("form_id");

-- CreateIndex
CREATE INDEX "form_requests_business_id_idx" ON "form_requests"("business_id");

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
