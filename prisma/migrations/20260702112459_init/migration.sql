-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('DEPUTY_CHIEF', 'PRINCIPAL', 'SENIOR');

-- CreateEnum
CREATE TYPE "ExpertiseArea" AS ENUM ('PUBLIC_PROCUREMENT_CONTRACTS', 'FINANCING_AGREEMENTS', 'PPP_PROJECT_AGREEMENTS', 'MEMORANDA_OF_UNDERSTANDING', 'CABINET_MEMORANDA', 'GENERAL_LEGAL_ADVISORY');

-- CreateEnum
CREATE TYPE "BriefSubType" AS ENUM ('CLEARANCE', 'TERMINATION', 'LEGAL_OPINION', 'STANDARD', 'ADVISORY');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('ROUTINE', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('RECEIVED', 'QUEUED', 'ALLOCATED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AllocationMethod" AS ENUM ('AUTO_EXPERTISE', 'AUTO_SENIORITY', 'AUTO_REPEAT_MATTER', 'MANUAL_DSG');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DSG', 'COUNSEL');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('BRIEF_RECEIVED', 'BRIEF_ALLOCATED', 'BRIEF_REALLOCATED', 'BRIEF_QUEUED', 'BRIEF_DEQUEUED', 'BRIEF_STATUS_CHANGED', 'BRIEF_CLOSED', 'STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_DEACTIVATED', 'CAPACITY_OVERRIDE', 'REPEAT_MATTER_DETECTED', 'REPEAT_MATTER_FALLBACK', 'MANUAL_ASSIGNMENT_BY_DSG');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BRIEF_ALLOCATED_TO_YOU', 'BRIEF_REALLOCATED_TO_YOU', 'BRIEF_REALLOCATED_FROM_YOU', 'QUEUE_ALERT', 'REPEAT_MATTER_ALERT', 'BRIEF_COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'COUNSEL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "employee_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "seniority" "SeniorityLevel" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "date_joined" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_expertise" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "expertise_area" "ExpertiseArea" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_expertise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefs" (
    "id" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "submitting_entity" TEXT,
    "expertise_area" "ExpertiseArea" NOT NULL,
    "sub_type" "BriefSubType" NOT NULL DEFAULT 'STANDARD',
    "urgency" "UrgencyLevel" NOT NULL DEFAULT 'ROUTINE',
    "status" "BriefStatus" NOT NULL DEFAULT 'RECEIVED',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE,
    "estimated_hours" DECIMAL(4,1) NOT NULL DEFAULT 1.0,
    "is_repeat_matter" BOOLEAN NOT NULL DEFAULT false,
    "parent_brief_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "allocation_method" "AllocationMethod" NOT NULL,
    "allocated_by" TEXT,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hours_allocated" DECIMAL(4,1) NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_workload" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "hours_allocated" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "brief_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_workload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_queue" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queued_reason" TEXT NOT NULL,
    "dsg_alerted_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "brief_id" TEXT,
    "allocation_id" TEXT,
    "staff_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "event_type" "AuditEventType" NOT NULL,
    "actor_id" TEXT,
    "brief_id" TEXT,
    "staff_id" TEXT,
    "allocation_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_employee_number_key" ON "staff"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_expertise_staff_id_expertise_area_key" ON "staff_expertise"("staff_id", "expertise_area");

-- CreateIndex
CREATE UNIQUE INDEX "daily_workload_staff_id_work_date_key" ON "daily_workload"("staff_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_queue_brief_id_key" ON "allocation_queue"("brief_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_expertise" ADD CONSTRAINT "staff_expertise_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_parent_brief_id_fkey" FOREIGN KEY ("parent_brief_id") REFERENCES "briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_workload" ADD CONSTRAINT "daily_workload_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_queue" ADD CONSTRAINT "allocation_queue_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_queue" ADD CONSTRAINT "allocation_queue_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "briefs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
