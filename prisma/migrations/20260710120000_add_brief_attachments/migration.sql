-- CreateTable
CREATE TABLE "brief_attachments" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "stored_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brief_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brief_attachments_brief_id_idx" ON "brief_attachments"("brief_id");

-- AddForeignKey
ALTER TABLE "brief_attachments" ADD CONSTRAINT "brief_attachments_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brief_attachments" ADD CONSTRAINT "brief_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
