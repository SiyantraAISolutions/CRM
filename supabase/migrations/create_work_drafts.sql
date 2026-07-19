-- ============================================
-- Migration: Create work_drafts table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Rename existing order_drafts if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_drafts') THEN
    ALTER TABLE order_drafts RENAME TO work_drafts;
  END IF;
END
$$;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS work_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_type TEXT NOT NULL DEFAULT 'order', -- 'order', 'enquiry', 'ticket'
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  form_type_code TEXT,
  form_type_name TEXT,
  interaction_type TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  wizard_step INT DEFAULT 0,
  upsells JSONB DEFAULT '{}'::jsonb,
  order_items JSONB DEFAULT '[]'::jsonb,
  property_value TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure draft_type column exists (in case order_drafts was renamed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'work_drafts' AND column_name = 'draft_type') THEN
    ALTER TABLE work_drafts ADD COLUMN draft_type TEXT NOT NULL DEFAULT 'order';
  END IF;
END
$$;

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_work_drafts_user_id ON work_drafts(user_id);

-- Enable RLS
ALTER TABLE work_drafts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/manage their own drafts
DROP POLICY IF EXISTS "Users can manage own drafts" ON work_drafts;
CREATE POLICY "Users can manage own drafts"
  ON work_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_work_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_work_drafts_updated_at ON work_drafts;
CREATE TRIGGER trigger_work_drafts_updated_at
  BEFORE UPDATE ON work_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_work_drafts_updated_at();
