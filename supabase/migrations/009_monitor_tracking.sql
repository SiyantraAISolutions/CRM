-- Add Monitor tracking columns to Orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS monitor_stage text DEFAULT 'awaiting' CHECK (monitor_stage IN ('awaiting', 'in_progress', 'submitted', 'completed')),
ADD COLUMN IF NOT EXISTS submission_requirements jsonb DEFAULT '{"id_verified": false, "form_signed": false, "docs_uploaded": false}'::jsonb;
