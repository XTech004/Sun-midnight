-- Apply once to an existing Supabase project after schema.sql.
begin;
create table if not exists restaurant_private.payment_slips (
  order_id bigint primary key references restaurant_private.orders(id),
  image bytea not null check (octet_length(image) between 1 and 1048576),
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now()
);
revoke all on restaurant_private.payment_slips from public, anon, authenticated;

create or replace function public.mark_order_paid_with_slip(p_id bigint, p_image text)
returns void language plpgsql security definer set search_path = '' as $$
declare image_bytes bytea;
begin
  if restaurant_private.staff_role() is distinct from 'cashier' then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  if p_image is null or length(p_image) > 1398104 or p_image !~ '^[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Invalid image';
  end if;
  image_bytes := decode(p_image, 'base64');
  if octet_length(image_bytes) not between 4 and 1048576 or substring(image_bytes from 1 for 3) <> decode('ffd8ff', 'hex') then
    raise exception 'Image must be JPEG and no larger than 1 MB';
  end if;
  update restaurant_private.orders set paid = true where id = p_id and paid = false;
  if not found then raise exception 'Order not found or already paid'; end if;
  insert into restaurant_private.payment_slips(order_id, image, confirmed_by)
  values (p_id, image_bytes, auth.uid());
end $$;

create or replace function public.get_payment_slip(p_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if restaurant_private.staff_role() is distinct from 'cashier' then
    raise exception 'Access denied' using errcode = '42501';
  end if;
  return (select encode(image, 'base64') from restaurant_private.payment_slips where order_id = p_id);
end $$;
revoke all on function public.mark_order_paid_with_slip(bigint,text) from public, anon;
revoke all on function public.get_payment_slip(bigint) from public, anon;
grant execute on function public.mark_order_paid_with_slip(bigint,text), public.get_payment_slip(bigint) to authenticated;
commit;
