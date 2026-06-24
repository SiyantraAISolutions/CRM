-- 1. Staff Attendance Table
CREATE TABLE public.staff_attendance (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users(id) on delete cascade not null,
    clock_in timestamptz not null default now(),
    clock_out timestamptz,
    created_at timestamptz default now()
);

-- RLS for staff_attendance
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select" ON public.staff_attendance FOR SELECT USING (true);
CREATE POLICY "attendance_insert" ON public.staff_attendance FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_update" ON public.staff_attendance FOR UPDATE USING (user_id = auth.uid());

-- 2. Revenue Tracking: Add completed_by to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_by uuid references public.users(id);

-- 3. Help Requests: Add assigned_to
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS assigned_to uuid references public.users(id);
