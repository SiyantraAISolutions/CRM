-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- USERS (extends Supabase auth.users)
-- =============================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  role text not null default 'agent' check (role in ('agent', 'manager', 'admin')),
  avatar_url text,
  current_status text default 'available' check (current_status in ('available','break','lunch','toilet','training')),
  status_started_at timestamptz,
  created_at timestamptz default now()
);

-- Auto-create user record on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- ACTIVITY LOGS
-- =============================================
create table public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  status text not null check (status in ('available','break','lunch','toilet','training')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- BRANDS / SITES
-- =============================================
create table public.brands (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,   -- NI2, OLR, RCS etc.
  name text not null,
  domain text,
  enquiry_email text,
  refund_email text,
  bank_details text,
  created_at timestamptz default now()
);

-- Seed brands
insert into public.brands (code, name, domain) values
  ('OLR', 'Online Land Registry', 'onlinelandregistry.uk'),
  ('LRT', 'Land Registry Transfers', 'landregistrytransfers.com');

-- =============================================
-- FORM TYPES
-- =============================================
create table public.form_types (
  id uuid primary key default uuid_generate_v4(),
  code text not null,
  name text not null,
  brand_ids uuid[] not null default '{}',
  base_price numeric(10,2) not null default 0,
  fee_scale text check (fee_scale in ('scale1','scale2')),
  wizard_schema jsonb,
  tc_template text,
  upsells jsonb,
  created_at timestamptz default now()
);

-- Seed form types (OLR and LRT)
insert into public.form_types (code, name, brand_ids, base_price, fee_scale) values
  ('TITLE_REGISTER', 'Title Register', array(select id from brands where code = 'OLR'), 3.00, null),
  ('TITLE_PLAN', 'Title Plan', array(select id from brands where code = 'OLR'), 3.00, null),
  ('MAP_SEARCH', 'Map Search / Deed Search', array(select id from brands where code = 'OLR'), 3.00, null),
  ('PROPERTY_OWNERSHIP', 'Property Ownership', array(select id from brands where code = 'OLR'), 3.00, null),
  ('FR1', 'FR1 First Registration', array(select id from brands where code = 'LRT'), 540.00, 'scale2'),
  ('AP1', 'AP1 Name Change', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('DJP', 'DJP Death of Joint Proprietor', array(select id from brands where code = 'LRT'), 540.00, 'scale2'),
  ('TR1', 'TR1 Add/Remove Proprietor', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('TP1', 'TP1 Transfer of Part', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('COG1', 'COG1 Changing Registered Owners Address', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('SEV', 'SEV Joint Tenants to Tenants in Common', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('RX3', 'RX3 Remove Restriction', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('ADV1', 'ADV1 Adverse Possession', array(select id from brands where code = 'LRT'), 540.00, 'scale1'),
  ('AS1', 'AS1 Assent of Whole', array(select id from brands where code = 'LRT'), 540.00, 'scale2');

-- =============================================
-- ORDERS
-- =============================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brands(id),
  form_type_id uuid references public.form_types(id),
  user_id uuid references public.users(id),
  -- Customer
  title text,
  first_name text,
  middle_name text,
  last_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  county text,
  postcode text,
  -- Property
  title_number text,
  tenure text,
  property_value numeric(12,2),
  hmlr_fee numeric(10,2),
  is_mortgaged boolean default false,
  tenancy_type text,
  -- Order
  status text not null default 'lead' check (status in ('lead','processing','paid','dead','no_answer','abandoned')),
  priority text not null default 'standard' check (priority in ('standard','fast_track')),
  amount_total numeric(10,2) not null default 0,
  is_inbound boolean default true,
  terms_accepted boolean default false,
  manual_payment boolean default false,
  stripe_payment_intent_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index orders_status_idx on public.orders(status);
create index orders_email_idx on public.orders(email);
create index orders_brand_idx on public.orders(brand_id);
create index orders_created_at_idx on public.orders(created_at desc);

-- =============================================
-- ORDER ITEMS
-- =============================================
create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  item_type text not null,
  amount numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

-- =============================================
-- ORDER NOTES (activity timeline)
-- =============================================
create table public.order_notes (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references public.users(id),
  category text,
  message text not null,
  created_at timestamptz default now()
);

create index order_notes_order_idx on public.order_notes(order_id);

-- =============================================
-- TICKETS
-- =============================================
create table public.tickets (
  id uuid primary key default uuid_generate_v4(),
  number integer unique not null,
  brand_id uuid references public.brands(id),
  department text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  name text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending','awaiting_internal','resolved','closed')),
  user_id uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create sequence if not exists ticket_number_seq start 27500;

-- =============================================
-- HELP REQUESTS
-- =============================================
create table public.help_requests (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brands(id),
  customer_name text,
  customer_email text,
  subject text not null,
  body text,
  status text not null default 'pending' check (status in ('pending','in_progress','resolved')),
  created_at timestamptz default now()
);

create index help_requests_status_idx on public.help_requests(status);

-- =============================================
-- KNOWLEDGE BASE ARTICLES
-- =============================================
create table public.kb_articles (
  id uuid primary key default uuid_generate_v4(),
  section text not null check (section in ('sales','admin')),
  brand_id uuid references public.brands(id),
  title text not null,
  body text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Seed KB articles
insert into public.kb_articles (section, title, body, sort_order) values
  ('sales', 'Government', 'Government contact information and procedures for handling government-related enquiries.', 1),
  ('sales', 'Sales Techniques and Tips', 'Key sales techniques for handling inbound calls and converting enquiries to orders.', 2),
  ('sales', 'Bank Details', 'Per-brand bank account details for manual payment processing.', 3),
  ('sales', 'Timescales for our services', 'Standard and fast track timescales for each service type.', 4),
  ('admin', 'Gov Numbers', 'Government helpline numbers for each service type.', 2),
  ('admin', 'Our Numbers', 'Internal phone numbers and extensions for each department.', 3),
  ('admin', 'Break Times', 'Approved break times and rotation schedule for the team.', 4),
  ('admin', 'DBS – Section Y Guide', 'Guide for completing Section Y of DBS applications.', 5);

-- =============================================
-- LEADERBOARD FUNCTION
-- =============================================
create or replace function public.get_leaderboard(from_date timestamptz)
returns table(user_id uuid, full_name text, orders bigint)
language sql stable
as $$
  select
    o.user_id,
    u.full_name,
    count(o.id) as orders
  from public.orders o
  join public.users u on u.id = o.user_id
  where o.created_at >= from_date
    and o.status in ('paid', 'processing', 'lead')
  group by o.user_id, u.full_name
  order by orders desc;
$$;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table public.users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_notes enable row level security;
alter table public.tickets enable row level security;
alter table public.help_requests enable row level security;
alter table public.kb_articles enable row level security;
alter table public.activity_logs enable row level security;
alter table public.brands enable row level security;
alter table public.form_types enable row level security;

-- Helper: is authenticated
create or replace function public.is_authenticated()
returns boolean language sql stable security definer
as $$ select auth.uid() is not null; $$;

-- Helper: current user role
create or replace function public.current_user_role()
returns text language sql stable security definer
as $$ select role from public.users where id = auth.uid(); $$;

-- Users: can read all, update own
create policy "users_select" on public.users for select using (is_authenticated());
create policy "users_update_own" on public.users for update using (id = auth.uid());

-- Brands & form types: read-only for all authenticated
create policy "brands_select" on public.brands for select using (is_authenticated());
create policy "form_types_select" on public.form_types for select using (is_authenticated());

-- Orders: all authenticated can read/write
create policy "orders_select" on public.orders for select using (is_authenticated());
create policy "orders_insert" on public.orders for insert with check (is_authenticated());
create policy "orders_update" on public.orders for update using (is_authenticated());

-- Order items
create policy "order_items_select" on public.order_items for select using (is_authenticated());
create policy "order_items_insert" on public.order_items for insert with check (is_authenticated());
create policy "order_items_update" on public.order_items for update using (is_authenticated());
create policy "order_items_delete" on public.order_items for delete using (is_authenticated());

-- Order notes
create policy "order_notes_select" on public.order_notes for select using (is_authenticated());
create policy "order_notes_insert" on public.order_notes for insert with check (is_authenticated());

-- Tickets
create policy "tickets_select" on public.tickets for select using (is_authenticated());
create policy "tickets_insert" on public.tickets for insert with check (is_authenticated());
create policy "tickets_update" on public.tickets for update using (is_authenticated());

-- Help requests
create policy "help_requests_select" on public.help_requests for select using (is_authenticated());
create policy "help_requests_update" on public.help_requests for update using (is_authenticated());

-- KB articles
create policy "kb_select" on public.kb_articles for select using (is_authenticated());
create policy "kb_write" on public.kb_articles for all using (current_user_role() in ('admin','manager'));

-- Activity logs
create policy "activity_logs_select" on public.activity_logs for select using (is_authenticated());
create policy "activity_logs_insert" on public.activity_logs for insert with check (user_id = auth.uid());
