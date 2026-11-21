-- Apply after schema.sql. Retain private receipts so retries use the same order.
begin;
create table if not exists restaurant_private.order_requests (
  request_id uuid primary key,
  payload jsonb not null,
  order_id bigint not null references restaurant_private.orders(id)
);
alter table restaurant_private.order_requests enable row level security;
revoke all on restaurant_private.order_requests from public, anon, authenticated;

create or replace function public.place_order_once(p_request_id uuid,p_table text,p_customer text,p_note text,p_items jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare old_payload jsonb; old_order bigint; new_order bigint;
  body jsonb := jsonb_build_object('table',p_table,'customer',p_customer,'note',p_note,'items',p_items);
begin
  if p_request_id is null then raise exception 'Missing request ID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select payload,order_id into old_payload,old_order from restaurant_private.order_requests where request_id=p_request_id;
  if found then
    if old_payload is distinct from body then raise exception 'Request ID already used for another order'; end if;
    return old_order;
  end if;
  new_order := public.place_order(p_table,p_customer,p_note,p_items);
  insert into restaurant_private.order_requests(request_id,payload,order_id) values(p_request_id,body,new_order);
  return new_order;
end $$;
revoke all on function public.place_order_once(uuid,text,text,text,jsonb) from public;
grant execute on function public.place_order_once(uuid,text,text,text,jsonb) to anon,authenticated;

-- Retain every unfinished or unpaid order, plus the most recent 500 orders.
create or replace function public.staff_orders() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r text := restaurant_private.staff_role(); result jsonb;
begin
  if r is null then raise exception 'Access denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'table_no',o.table_no,'customer',case when r='cashier' then o.customer else '' end,'note',o.note,'status',o.status,'paid',o.paid,'created_at',o.created_at,'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'price',i.price,'qty',i.qty)) from restaurant_private.order_items i where i.order_id=o.id),'[]'::jsonb)) order by o.id desc),'[]'::jsonb) into result
  from restaurant_private.orders o
  where not o.paid or o.status <> 'ready' or o.id in (select id from restaurant_private.orders order by id desc limit 500);
  return result;
end $$;
commit;
