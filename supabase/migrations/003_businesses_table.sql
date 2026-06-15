-- =============================================
-- MIGRATION 003: Businesses table (multi-business architecture)
-- =============================================

-- 1. Create businesses table
create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  domain text,
  colour text default '#16243B',
  logo_url text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

-- Seed the two current businesses
insert into public.businesses (name, domain, colour, status) values
  ('Online Land Registry', 'onlinelandregistry.uk', '#16243B', 'active'),
  ('Land Registry Transfers', 'landregistrytransfers.com', '#2F4F46', 'active')
on conflict do nothing;

-- 2. User ↔ business assignment (many-to-many)
-- NULL business_id on a user means they see all businesses (directors)
create table if not exists public.user_businesses (
  user_id uuid references public.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  primary key (user_id, business_id)
);

-- 3. Add business_id to all core tables
alter table public.orders
  add column if not exists business_id uuid references public.businesses(id);

alter table public.enquiries
  add column if not exists business_id uuid references public.businesses(id);

alter table public.payments
  add column if not exists business_id uuid references public.businesses(id);

alter table public.tasks
  add column if not exists business_id uuid references public.businesses(id);

alter table public.tickets
  add column if not exists business_id uuid references public.businesses(id);

alter table public.help_requests
  add column if not exists business_id uuid references public.businesses(id);

alter table public.kb_articles
  add column if not exists business_id uuid references public.businesses(id);

-- 4. Backfill existing orders/tickets/help_requests to the OLR business
-- (they were all OLR-branded in migration 001)
do $$
declare
  v_olr_id uuid;
begin
  select id into v_olr_id from public.businesses where domain = 'onlinelandregistry.uk';
  if v_olr_id is not null then
    update public.orders      set business_id = v_olr_id where business_id is null;
    update public.tickets     set business_id = v_olr_id where business_id is null;
    update public.help_requests set business_id = v_olr_id where business_id is null;
    update public.kb_articles set business_id = v_olr_id where business_id is null;
  end if;
end;
$$;

-- 5. Indexes
create index if not exists orders_business_idx      on public.orders(business_id);
create index if not exists enquiries_business_idx   on public.enquiries(business_id);
create index if not exists payments_business_idx    on public.payments(business_id);
create index if not exists tickets_business_idx     on public.tickets(business_id);
create index if not exists help_requests_biz_idx    on public.help_requests(business_id);

-- 6. RLS on businesses (read for all authenticated)
alter table public.businesses enable row level security;
create policy "businesses_select" on public.businesses
  for select using (is_authenticated());
create policy "businesses_write" on public.businesses
  for all using (current_user_role() = 'director');

-- 7. RLS on user_businesses
alter table public.user_businesses enable row level security;
create policy "user_businesses_select" on public.user_businesses
  for select using (is_authenticated());
create policy "user_businesses_write" on public.user_businesses
  for all using (current_user_role() = 'director');
