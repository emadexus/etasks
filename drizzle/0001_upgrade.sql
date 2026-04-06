-- Add language setting to boards
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'en';

-- Add created_via to tasks (tracks admin API / bot creation)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "created_via" text;

-- File attachments table
CREATE TABLE IF NOT EXISTS "task_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id"),
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" bigint,
  "mime_type" text,
  "uploaded_by_id" uuid REFERENCES "members"("id"),
  "uploaded_by_user_id" uuid REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);
