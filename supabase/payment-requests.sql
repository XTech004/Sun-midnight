-- Run after schema.sql on the existing project. This adds requests, not payments.
begin;
create table if not exists restaurant_private.payment_requests (
  id bigint generated always as identity primary key,
  table_no text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);
create unique index if not exists one_pending_payment_request_per_table
  on restaurant_private.payment_requests(table_no) where resolved_at is null;
alter table restaurant_private.payment_requests enable row level security;
revoke all on restaurant_private.payment_requests from public, anon, authenticated;

create or replace function public.request_payment(p_table text) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := trim(p_table);
begin
  if t is null or length(t) not between 1 and 20 then raise exception 'Invalid table'; end if;
  if not exists (select 1 from restaurant_private.orders where table_no=t and not paid) then return 'no_unpaid_orders'; end if;
  insert into restaurant_private.payment_requests(table_no) values(t)
  on conflict (table_no) where resolved_at is null do nothing;
  return 'requested';
end $$;

create or replace function public.staff_payment_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if restaurant_private.staff_role() is distinct from 'cashier' then raise exception 'Access denied' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'table_no',table_no,'created_at',created_at) order by created_at),'[]'::jsonb)
    from restaurant_private.payment_requests where resolved_at is null);
end $$;

create or replace function public.resolve_payment_request(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if restaurant_private.staff_role() is distinct from 'cashier' then raise exception 'Access denied' using errcode='42501'; end if;
  update restaurant_private.payment_requests set resolved_at=now(),resolved_by=auth.uid() where id=p_id and resolved_at is null;
  if not found then raise exception 'Request not found'; end if;
end $$;
revoke all on function public.request_payment(text) from public;
revoke all on function public.staff_payment_requests(),public.resolve_payment_request(bigint) from public,anon;
grant execute on function public.request_payment(text) to anon,authenticated;
grant execute on function public.staff_payment_requests(),public.resolve_payment_request(bigint) to authenticated;
commit;
