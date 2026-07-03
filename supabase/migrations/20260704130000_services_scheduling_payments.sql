-- Scheduling, reminders, and installment/periodic payments for services.

-- Relax amount constraint (scheduled jobs may start at 0 collected)
alter table public.services drop constraint if exists services_amount_check;
alter table public.services add constraint services_amount_check check (amount >= 0);

-- Expand status values
alter table public.services drop constraint if exists services_status_check;
alter table public.services add constraint services_status_check
  check (status in ('scheduled', 'in_progress', 'completed', 'voided', 'cancelled'));

-- New columns
alter table public.services add column if not exists scheduled_date date;
alter table public.services add column if not exists reminder_at timestamptz;
alter table public.services add column if not exists reminder_dismissed boolean not null default false;
alter table public.services add column if not exists payment_plan text not null default 'full'
  check (payment_plan in ('full', 'installment', 'periodic'));
alter table public.services add column if not exists total_amount numeric(12, 2);
alter table public.services add column if not exists periodic_interval text
  check (periodic_interval is null or periodic_interval in ('weekly', 'biweekly', 'monthly', 'quarterly'));

-- Default total_amount to amount for existing rows
update public.services
set total_amount = amount
where total_amount is null;

create index if not exists services_org_scheduled_date_idx
  on public.services (org_id, scheduled_date)
  where status = 'scheduled';

create index if not exists services_org_reminder_idx
  on public.services (org_id, reminder_at)
  where reminder_dismissed = false and reminder_at is not null;

-- Individual payment records (installments, periodic, or full-pay receipts)
create table if not exists public.service_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  service_id uuid not null references public.services(id) on delete cascade,
  payment_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'mpesa', 'card', 'credit')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists service_payments_org_date_idx
  on public.service_payments (org_id, payment_date desc);

create index if not exists service_payments_service_idx
  on public.service_payments (service_id);

alter table public.service_payments enable row level security;

create policy "Org members can view service payments"
  on public.service_payments for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = service_payments.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can insert service payments"
  on public.service_payments for insert
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = service_payments.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can update service payments"
  on public.service_payments for update
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = service_payments.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can delete service payments"
  on public.service_payments for delete
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = service_payments.org_id and om.user_id = auth.uid()
    )
  );

-- Backfill payment rows for existing completed full-pay services
insert into public.service_payments (org_id, service_id, payment_date, amount, payment_method, note)
select s.org_id, s.id, s.service_date, s.amount, s.payment_method, s.note
from public.services s
where s.status = 'completed'
  and coalesce(s.payment_plan, 'full') = 'full'
  and s.amount > 0
  and not exists (
    select 1 from public.service_payments sp where sp.service_id = s.id
  );
