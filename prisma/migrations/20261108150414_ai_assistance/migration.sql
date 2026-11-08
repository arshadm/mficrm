-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "ai_summary" TEXT,
ADD COLUMN     "ai_summary_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "forms" ADD COLUMN     "business_id" INTEGER;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
