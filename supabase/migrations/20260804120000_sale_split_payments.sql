-- Split tender support for product sales (e.g. cash + M-Pesa on one checkout).

-- Allow a composite payment_method label on sales.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'sales'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%payment_method%'
  loop
    execute format('alter table public.sales drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.sales
  drop constraint if exists sales_payment_method_check;

alter table public.sales
  add constraint sales_payment_method_check
  check (
    payment_method is null
    or payment_method in ('cash', 'mpesa', 'card', 'credit', 'cash+mpesa')
  );

-- Per-tender rows for a sale (mirrors service_payments).
create table if not exists public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  sale_id uuid not null references public.sales(id) on delete cascade,
  payment_date date not null default (timezone('utc', now()))::date,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash', 'mpesa', 'card', 'credit')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_org_date_idx
  on public.sale_payments (org_id, payment_date desc);

create index if not exists sale_payments_sale_idx
  on public.sale_payments (sale_id);

alter table public.sale_payments enable row level security;

create policy "Org members can view sale payments"
  on public.sale_payments for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = sale_payments.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can insert sale payments"
  on public.sale_payments for insert
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = sale_payments.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can update sale payments"
  on public.sale_payments for update
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = sale_payments.org_id and om.user_id = auth.uid()
    )
  );

create policy "Org members can delete sale payments"
  on public.sale_payments for delete
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = sale_payments.org_id and om.user_id = auth.uid()
    )
  );
