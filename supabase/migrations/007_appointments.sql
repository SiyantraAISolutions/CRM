-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    solicitor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'rescheduled', 'completed', 'cancelled')),
    reschedule_history JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by order
CREATE INDEX IF NOT EXISTS idx_appointments_order_id ON public.appointments(order_id);
-- Index for querying by solicitor
CREATE INDEX IF NOT EXISTS idx_appointments_solicitor_id ON public.appointments(solicitor_id);
-- Index for querying by date (useful for calendar)
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(scheduled_at);

-- Add assigned_to to help_requests
ALTER TABLE public.help_requests 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
