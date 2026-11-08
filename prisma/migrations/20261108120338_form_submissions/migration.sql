-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "form_submission_id" INTEGER,
ALTER COLUMN "business_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" SERIAL NOT NULL,
    "form_request_id" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "form_submissions_form_request_id_key" ON "form_submissions"("form_request_id");

-- CreateIndex
CREATE INDEX "attachments_form_submission_id_idx" ON "attachments"("form_submission_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_form_submission_id_fkey" FOREIGN KEY ("form_submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_request_id_fkey" FOREIGN KEY ("form_request_id") REFERENCES "form_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
