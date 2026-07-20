/*
  Warnings:

  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add must_change_password with its permanent default
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Add password_hash with a TEMPORARY default so existing rows are not NULL
-- The placeholder hash will be replaced immediately by the seed script.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT NOT NULL DEFAULT '';

-- Drop the temporary default — password_hash is now effectively required for all new rows
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT;

