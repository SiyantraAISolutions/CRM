-- ============================================
-- Migration: Create order_drafts table
-- Run this in your Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_order_drafts_user_id ON order_drafts(user_id);

-- Enable RLS
ALTER TABLE order_drafts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/manage their own drafts
DROP POLICY IF EXISTS "Users can manage own drafts" ON order_drafts;
CREATE POLICY "Users can manage own drafts"
  ON order_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_order_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_drafts_updated_at ON order_drafts;
CREATE TRIGGER trigger_order_drafts_updated_at
  BEFORE UPDATE ON order_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_order_drafts_updated_at();
