-- Migration: Add form_data column to public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;
