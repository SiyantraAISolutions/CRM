-- =========================================================================
-- MIGRATION 004: Services & RLS policies for Multi-Business Integration
-- =========================================================================

-- 1. Add business_id column to form_types (services)
alter table public.form_types
  add column if not exists business_id uuid references public.businesses(id);

-- 2. Backfill business_id in form_types table
do $$
declare
  v_olr_id uuid;
  v_lrt_id uuid;
begin
  select id into v_olr_id from public.businesses where domain = 'onlinelandregistry.uk';
  select id into v_lrt_id from public.businesses where domain = 'landregistrytransfers.com';

  if v_olr_id is not null and v_lrt_id is not null then
    -- OLR document-ordering services
    update public.form_types
      set business_id = v_olr_id
      where code in ('TITLE_REGISTER', 'TITLE_PLAN', 'MAP_SEARCH', 'PROPERTY_OWNERSHIP');

    -- LRT conveyancing services
    update public.form_types
      set business_id = v_lrt_id
      where code in ('FR1', 'AP1', 'DJP', 'TR1', 'TP1', 'COG1', 'SEV', 'RX3', 'ADV1', 'AS1');

    -- Catch all other existing forms to default to OLR
    update public.form_types
      set business_id = v_olr_id
      where business_id is null;
  end if;
end;
$$;

-- Create index on form_types.business_id
create index if not exists form_types_business_idx on public.form_types(business_id);

-- 3. Update RLS policies to enforce business assignments for non-directors

-- Helper: check if authenticated user is assigned to the given business
create or replace function public.is_assigned_to_business(p_business_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.user_businesses
    where user_id = auth.uid() and business_id = p_business_id
  );
$$;

-- Drop existing select/insert/update policies that do not account for business assignments
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;

drop policy if exists "enquiries_select" on public.enquiries;
drop policy if exists "enquiries_insert" on public.enquiries;
drop policy if exists "enquiries_update" on public.enquiries;

drop policy if exists "payments_select" on public.payments;
drop policy if exists "payments_insert" on public.payments;
drop policy if exists "payments_update" on public.payments;

drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;

-- Recreate policies with business-level security (Directors bypass RLS via RLS check or role)

-- Orders
create policy "orders_select" on public.orders for select using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "orders_insert" on public.orders for insert with check (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "orders_update" on public.orders for update using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);

-- Enquiries
create policy "enquiries_select" on public.enquiries for select using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "enquiries_insert" on public.enquiries for insert with check (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "enquiries_update" on public.enquiries for update using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);

-- Payments
create policy "payments_select" on public.payments for select using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "payments_insert" on public.payments for insert with check (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "payments_update" on public.payments for update using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);

-- Tasks
create policy "tasks_select" on public.tasks for select using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "tasks_insert" on public.tasks for insert with check (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
create policy "tasks_update" on public.tasks for update using (
  current_user_role() = 'director' or is_assigned_to_business(business_id)
);
