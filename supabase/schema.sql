-- Sun Midnight: run once in a new Supabase project. Use a transaction so failures roll back.
begin;
create schema if not exists restaurant_private;
revoke all on schema restaurant_private from public, anon, authenticated;

create table restaurant_private.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('kitchen','cashier'))
);
create table public.menu (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) between 1 and 80),
  price integer not null check (price between 0 and 100000),
  available boolean not null default true
);
create table restaurant_private.orders (
  id bigint generated always as identity primary key,
  table_no text not null, customer text not null default '', note text not null default '',
  status text not null default 'new' check (status in ('new','cooking','ready')),
  paid boolean not null default false, created_at timestamptz not null default now()
);
create table restaurant_private.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references restaurant_private.orders(id),
  menu_id bigint not null references public.menu(id),
  name text not null, price integer not null, qty integer not null check (qty between 1 and 99)
);
alter table public.menu enable row level security;
revoke all on public.menu from anon, authenticated;
grant select on public.menu to anon, authenticated;
create policy menu_available on public.menu for select to anon, authenticated using (available);

create function restaurant_private.staff_role() returns text language sql stable security definer set search_path = '' as $$
  select role from restaurant_private.staff where user_id = (select auth.uid())
$$;
revoke all on function restaurant_private.staff_role() from public;

create function public.place_order(p_table text,p_customer text,p_note text,p_items jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare entry jsonb; m public.menu%rowtype; order_id bigint; quantity int; menu_id bigint; seen bigint[] := '{}';
begin
  if p_table is null or length(trim(p_table)) not between 1 and 20 or length(coalesce(p_customer,'')) > 80 or length(coalesce(p_note,'')) > 300 then raise exception 'Invalid order details'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid items'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Invalid items'; end if;
  insert into restaurant_private.orders(table_no,customer,note) values(trim(p_table),trim(coalesce(p_customer,'')),trim(coalesce(p_note,''))) returning id into order_id;
  for entry in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry->'id') <> 'number' or jsonb_typeof(entry->'qty') <> 'number' or (entry->>'id') !~ '^[0-9]{1,15}$' or (entry->>'qty') !~ '^[0-9]{1,2}$' then raise exception 'Invalid item'; end if;
    menu_id := (entry->>'id')::bigint; quantity := (entry->>'qty')::int;
    if quantity not between 1 and 99 or menu_id = any(seen) then raise exception 'Invalid quantity or duplicate item'; end if;
    seen := array_append(seen,menu_id);
    select * into m from public.menu where id = menu_id and available;
    if not found then raise exception 'Menu item unavailable'; end if;
    insert into restaurant_private.order_items(order_id,menu_id,name,price,qty) values(order_id,m.id,m.name,m.price,quantity);
  end loop;
  return order_id;
end $$;

create function public.my_role() returns text language sql stable security definer set search_path = '' as $$ select restaurant_private.staff_role() $$;
create function public.staff_orders() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r text := restaurant_private.staff_role(); result jsonb;
begin
  if r is null then raise exception 'Access denied' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'table_no',o.table_no,'customer',case when r='cashier' then o.customer else '' end,'note',o.note,'status',o.status,'paid',o.paid,'created_at',o.created_at,'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.name,'price',i.price,'qty',i.qty)) from restaurant_private.order_items i where i.order_id=o.id),'[]'::jsonb)) order by o.id desc),'[]'::jsonb) into result
  from (select * from restaurant_private.orders order by id desc limit 500) o;
  return result;
end $$;
create function public.staff_menu() returns setof public.menu language plpgsql stable security definer set search_path = '' as $$
begin if restaurant_private.staff_role() <> 'cashier' or restaurant_private.staff_role() is null then raise exception 'Access denied' using errcode='42501'; end if; return query select * from public.menu order by id; end $$;
create function public.update_order_status(p_id bigint,p_status text) returns void language plpgsql security definer set search_path = '' as $$
begin if restaurant_private.staff_role() is distinct from 'kitchen' then raise exception 'Access denied' using errcode='42501'; end if; if p_status not in ('new','cooking','ready') then raise exception 'Invalid status'; end if; update restaurant_private.orders set status=p_status where id=p_id; if not found then raise exception 'Order not found'; end if; end $$;
create function public.mark_order_paid(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin if restaurant_private.staff_role() is distinct from 'cashier' then raise exception 'Access denied' using errcode='42501'; end if; update restaurant_private.orders set paid=true where id=p_id; if not found then raise exception 'Order not found'; end if; end $$;
create function public.manage_menu(p_id bigint default null,p_name text default null,p_price integer default null) returns void language plpgsql security definer set search_path = '' as $$
begin if restaurant_private.staff_role() is distinct from 'cashier' then raise exception 'Access denied' using errcode='42501'; end if; if p_id is not null then update public.menu set available=not available where id=p_id; if not found then raise exception 'Menu not found'; end if; else insert into public.menu(name,price) values(trim(p_name),p_price); end if; end $$;

revoke all on function public.place_order(text,text,text,jsonb) from public;
revoke all on function public.my_role() from public;
revoke all on function public.staff_orders() from public;
revoke all on function public.staff_menu() from public;
revoke all on function public.update_order_status(bigint,text) from public;
revoke all on function public.mark_order_paid(bigint) from public;
revoke all on function public.manage_menu(bigint,text,integer) from public;
grant execute on function public.place_order(text,text,text,jsonb) to anon,authenticated;
grant execute on function public.my_role(),public.staff_orders(),public.staff_menu(),public.update_order_status(bigint,text),public.mark_order_paid(bigint),public.manage_menu(bigint,text,integer) to authenticated;
insert into public.menu(name,price) values ('ข้าวกะเพราหมู',65),('ข้าวผัดไก่',60),('ผัดไทย',75),('น้ำเปล่า',15);
commit;
