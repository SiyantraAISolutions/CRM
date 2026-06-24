-- Add Deferral tracking columns to Orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS deferred_until timestamptz,
ADD COLUMN IF NOT EXISTS deferred_reason text;
