-- Service income tracking (training, inspection, pollination, etc.)
-- Non-inventory revenue — separate from product sales.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  service_date date not null,
  service_type text not null,
  customer_name text,
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'mpesa', 'card', 'credit')),
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  status text not null default 'completed'
    check (status in ('completed', 'voided')),
  created_at timestamptz not null default now()
);

create index if not exists services_org_id_service_date_idx
  on public.services (org_id, service_date desc);

create index if not exists services_org_id_status_idx
  on public.services (org_id, status);

alter table public.services enable row level security;

-- Org members can read services for their org
create policy "Org members can view services"
  on public.services for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = services.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can insert services"
  on public.services for insert
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = services.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can update services"
  on public.services for update
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = services.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can delete services"
  on public.services for delete
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = services.org_id and om.user_id = auth.uid()
    )
  );
