-- =============================================
-- MIGRATION 002: KWS CRM — Role migration + new tables
-- =============================================

-- 1. Migrate role enum
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('director', 'sales', 'admin'));

-- Update legacy values
update public.users set role = 'admin'   where role = 'manager';
update public.users set role = 'sales'   where role = 'agent';

-- Update default
alter table public.users alter column role set default 'sales';

-- Add sales_target column
alter table public.users add column if not exists sales_target numeric(10,2) default 0;

-- 2. Add document delivery columns to orders
alter table public.orders add column if not exists document_delivered boolean default false;
alter table public.orders add column if not exists document_url text;
alter table public.orders add column if not exists assigned_admin_id uuid references public.users(id);

-- =============================================
-- ENQUIRIES
-- =============================================
create table if not exists public.enquiries (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brands(id),
  customer_name text,
  email text,
  phone text,
  message text,
  source text,
  assigned_to uuid references public.users(id),
  pipeline_stage text not null default 'new'
    check (pipeline_stage in ('new','contacted','quoted','won','lost')),
  notes text,
  follow_up_at timestamptz,
  converted_order_id uuid references public.orders(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists enquiries_assigned_idx on public.enquiries(assigned_to);
create index if not exists enquiries_stage_idx on public.enquiries(pipeline_stage);
create index if not exists enquiries_created_idx on public.enquiries(created_at desc);

-- Enquiry activity notes
create table if not exists public.enquiry_notes (
  id uuid primary key default uuid_generate_v4(),
  enquiry_id uuid references public.enquiries(id) on delete cascade,
  user_id uuid references public.users(id),
  message text not null,
  created_at timestamptz default now()
);

-- =============================================
-- PAYMENTS
-- =============================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  amount numeric(10,2) not null,
  method text not null default 'manual'
    check (method in ('stripe','manual','bank_transfer')),
  status text not null default 'pending'
    check (status in ('pending','cleared','refunded')),
  processed_by uuid references public.users(id),
  processed_at timestamptz,
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_status_idx on public.payments(status);

-- =============================================
-- TASKS
-- =============================================
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  assigned_to uuid references public.users(id),
  created_by uuid references public.users(id),
  linked_order_id uuid references public.orders(id),
  linked_enquiry_id uuid references public.enquiries(id),
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open','in_progress','done')),
  priority text not null default 'medium'
    check (priority in ('low','medium','high')),
  completed_at timestamptz,
  completed_by uuid references public.users(id),
  created_at timestamptz default now()
);

create index if not exists tasks_assigned_idx on public.tasks(assigned_to);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_idx on public.tasks(due_at);

create table if not exists public.task_notes (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id),
  message text not null,
  created_at timestamptz default now()
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null
    check (type in ('order_assigned','enquiry_assigned','task_assigned','follow_up_due','payment_flagged','document_delivered')),
  title text not null,
  body text not null,
  linked_order_id uuid references public.orders(id),
  linked_enquiry_id uuid references public.enquiries(id),
  read_at timestamptz,
  deliver_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(user_id, read_at);

-- =============================================
-- SETTINGS
-- =============================================
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into public.settings (key, value) values
  ('payment_fee_pct', '2.9'),
  ('stripe_fee_pct', '2.9')
on conflict (key) do nothing;

-- =============================================
-- AUDIT LOGS
-- =============================================
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.users(id),
  action_type text not null,
  target_table text not null,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

-- =============================================
-- STORAGE BUCKET for order documents
-- =============================================
insert into storage.buckets (id, name, public)
  values ('order-documents', 'order-documents', false)
  on conflict (id) do nothing;

-- =============================================
-- UPDATE RLS POLICIES — role helper
-- =============================================
create or replace function public.current_user_role()
returns text language sql stable security definer
as $$ select role from public.users where id = auth.uid(); $$;

-- Drop old policies that used agent/manager
drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "kb_write" on public.kb_articles;
drop policy if exists "users_update_own" on public.users;

-- Orders: director + admin see all; sales sees own
create policy "orders_select" on public.orders for select using (
  current_user_role() in ('director','admin')
  or user_id = auth.uid()
);
create policy "orders_insert" on public.orders for insert with check (is_authenticated());
create policy "orders_update" on public.orders for update using (
  current_user_role() in ('director','admin')
);

-- Users
create policy "users_update_own" on public.users for update using (
  id = auth.uid() or current_user_role() = 'director'
);

-- KB
create policy "kb_write" on public.kb_articles for all using (
  current_user_role() in ('director','admin')
);

-- Form types: director can write
drop policy if exists "form_types_write" on public.form_types;
create policy "form_types_write" on public.form_types for all using (
  current_user_role() = 'director'
);

-- Enquiries RLS
alter table public.enquiries enable row level security;
create policy "enquiries_select" on public.enquiries for select using (
  current_user_role() = 'director'
  or assigned_to = auth.uid()
);
create policy "enquiries_insert" on public.enquiries for insert with check (
  current_user_role() in ('director','sales')
);
create policy "enquiries_update" on public.enquiries for update using (
  current_user_role() = 'director'
  or assigned_to = auth.uid()
);

-- Enquiry notes
alter table public.enquiry_notes enable row level security;
create policy "enquiry_notes_select" on public.enquiry_notes for select using (is_authenticated());
create policy "enquiry_notes_insert" on public.enquiry_notes for insert with check (is_authenticated());

-- Payments RLS
alter table public.payments enable row level security;
create policy "payments_select" on public.payments for select using (
  current_user_role() in ('director','admin')
);
create policy "payments_insert" on public.payments for insert with check (
  current_user_role() in ('director','admin')
);
create policy "payments_update" on public.payments for update using (
  current_user_role() in ('director','admin')
);

-- Tasks RLS
alter table public.tasks enable row level security;
create policy "tasks_select" on public.tasks for select using (
  current_user_role() = 'director'
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);
create policy "tasks_insert" on public.tasks for insert with check (is_authenticated());
create policy "tasks_update" on public.tasks for update using (
  current_user_role() = 'director'
  or assigned_to = auth.uid()
);

-- Task notes
alter table public.task_notes enable row level security;
create policy "task_notes_select" on public.task_notes for select using (is_authenticated());
create policy "task_notes_insert" on public.task_notes for insert with check (is_authenticated());

-- Notifications RLS
alter table public.notifications enable row level security;
create policy "notifications_select" on public.notifications for select using (
  user_id = auth.uid()
);
create policy "notifications_update" on public.notifications for update using (
  user_id = auth.uid()
);

-- Settings RLS
alter table public.settings enable row level security;
create policy "settings_select" on public.settings for select using (
  current_user_role() = 'director'
);
create policy "settings_write" on public.settings for all using (
  current_user_role() = 'director'
);

-- Audit logs RLS
alter table public.audit_logs enable row level security;
create policy "audit_logs_select" on public.audit_logs for select using (
  current_user_role() = 'director'
);
create policy "audit_logs_insert" on public.audit_logs for insert with check (is_authenticated());

-- =============================================
-- SEED USERS
-- =============================================
do $seed$
declare
  v_uid  uuid;
  v_email text;
  v_name  text;
  v_role  text;

  type_emails text[]  := array['kano@kws-managementservices.co.uk','kowais@kws-managementservices.co.uk','lala@kws-managementservices.co.uk','amber@kws-placeholder.local','kai@kws-placeholder.local','adam@kws-placeholder.local','amanda@kws-placeholder.local','demver@kws-placeholder.local'];
  type_names  text[]  := array['Kano','Kowais','Lala','Amber','Kai','Adam','Amanda','Demver'];
  type_roles  text[]  := array['director','director','director','sales','sales','admin','admin','admin'];
  i integer;
begin
  for i in 1..array_length(type_emails, 1)
  loop
    v_email := type_emails[i];
    v_name  := type_names[i];
    v_role  := type_roles[i];

    if exists (select 1 from auth.users where email = v_email) then
      -- Just make sure role is correct on existing user
      update public.users set role = v_role, full_name = v_name where email = v_email;
      continue;
    end if;

    v_uid := gen_random_uuid();

    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      role, aud, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      v_uid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_email,
      crypt('KWS2024!', gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      now(), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', v_name),
      false, '', '', '', ''
    );

    update public.users
    set role = v_role, full_name = v_name
    where id = v_uid;
  end loop;
end;
$seed$;

