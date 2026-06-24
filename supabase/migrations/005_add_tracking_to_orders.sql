-- Add tracking fields to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS postage_provider TEXT;

-- Update the status check constraint if it exists
DO $$ 
BEGIN
  -- Attempt to drop the existing constraint if it was enforcing specific statuses
  -- This allows 'in_progress' and 'completed' to be used alongside existing ones
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- If you want to enforce the new constraint including 'in_progress' and 'completed':
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('lead', 'processing', 'in_progress', 'completed', 'paid', 'dead', 'no_answer', 'abandoned')
);
