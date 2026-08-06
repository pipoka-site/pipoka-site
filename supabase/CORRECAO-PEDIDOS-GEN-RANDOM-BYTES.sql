-- PIPOKÁ Gourmet — correção da criação de pedidos
-- Corrige: function gen_random_bytes(integer) does not exist
-- Pode ser executado com segurança após as migrations anteriores.

create extension if not exists pgcrypto;

create or replace function public.create_order_secure(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_group jsonb;
  v_option jsonb;
  v_selected jsonb;
  v_selected_item jsonb;
  v_sanitized_items jsonb := '[]'::jsonb;
  v_selected_clean jsonb;
  v_quantity integer;
  v_option_quantity integer;
  v_group_count integer;
  v_unit numeric := 0;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_settings jsonb;
  v_fulfillment text;
  v_coupon text;
  v_order_code text;
  v_tracking_token text;
  v_status text;
  v_attempt integer := 0;
begin
  if jsonb_typeof(p_order) <> 'object' then
    raise exception 'Pedido inválido.';
  end if;

  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items') = 0 then
    raise exception 'O pedido precisa ter pelo menos um item.';
  end if;

  if jsonb_array_length(p_order->'items') > 30 then
    raise exception 'Quantidade de itens acima do limite.';
  end if;

  v_fulfillment := p_order->>'fulfillment';
  if v_fulfillment not in ('Entrega','Retirada') then
    raise exception 'Forma de recebimento inválida.';
  end if;

  if length(trim(coalesce(p_order->>'customer_name',''))) < 2
     or length(trim(coalesce(p_order->>'customer_name',''))) > 100 then
    raise exception 'Nome do cliente inválido.';
  end if;

  if length(regexp_replace(coalesce(p_order->>'customer_phone',''), '\\D', '', 'g')) < 10 then
    raise exception 'Telefone inválido.';
  end if;

  select to_jsonb(s) into v_settings
  from public.store_settings s where id = 1;

  for v_item in select value from jsonb_array_elements(p_order->'items')
  loop
    v_quantity := greatest(1, least(50, coalesce((v_item->>'quantity')::integer, 1)));

    select * into v_product
    from public.products
    where id = v_item->>'product_id'
      and coalesce(status, case when active then 'active' else 'hidden' end) = 'active';

    if not found then
      raise exception 'Produto indisponível ou inexistente.';
    end if;

    v_unit := coalesce(v_product.price, 0);
    v_selected := coalesce(v_item->'selected_options', '[]'::jsonb);
    if jsonb_typeof(v_selected) <> 'array' then
      raise exception 'Variações inválidas.';
    end if;
    v_selected_clean := '[]'::jsonb;

    -- Valida os limites mínimo/máximo de todos os grupos cadastrados.
    for v_group in select value from jsonb_array_elements(coalesce(v_product.option_groups, '[]'::jsonb))
    loop
      select coalesce(sum(greatest(1, coalesce((x.value->>'quantity')::integer,1))),0)::integer
      into v_group_count
      from jsonb_array_elements(v_selected) x
      where x.value->>'groupId' = v_group->>'id';

      if v_group_count < coalesce((v_group->>'min')::integer,0)
         or v_group_count > coalesce((v_group->>'max')::integer,999) then
        raise exception 'Seleção inválida para a variação %.', coalesce(v_group->>'name','');
      end if;
    end loop;

    for v_selected_item in select value from jsonb_array_elements(v_selected)
    loop
      select g.value into v_group
      from jsonb_array_elements(coalesce(v_product.option_groups, '[]'::jsonb)) g
      where g.value->>'id' = v_selected_item->>'groupId'
      limit 1;

      if v_group is null then
        raise exception 'Grupo de variação inválido.';
      end if;

      select o.value into v_option
      from jsonb_array_elements(coalesce(v_group->'options','[]'::jsonb)) o
      where o.value->>'id' = v_selected_item->>'optionId'
      limit 1;

      if v_option is null
         or coalesce(v_option->>'status', case when coalesce((v_option->>'active')::boolean,true) then 'active' else 'hidden' end) <> 'active' then
        raise exception 'Opção indisponível ou inválida.';
      end if;

      v_option_quantity := greatest(1, least(20, coalesce((v_selected_item->>'quantity')::integer,1)));
      v_unit := v_unit + coalesce((v_option->>'price')::numeric,0) * v_option_quantity;
      v_selected_clean := v_selected_clean || jsonb_build_array(jsonb_build_object(
        'groupId', v_group->>'id',
        'groupName', v_group->>'name',
        'optionId', v_option->>'id',
        'optionName', v_option->>'name',
        'price', coalesce((v_option->>'price')::numeric,0),
        'quantity', v_option_quantity
      ));
    end loop;

    v_subtotal := v_subtotal + (v_unit * v_quantity);
    v_sanitized_items := v_sanitized_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'quantity', v_quantity,
      'unit_price', v_unit,
      'image', coalesce(nullif(v_product.image,''), case when array_length(v_product.images,1)>0 then v_product.images[1] else '' end),
      'selected_options', v_selected_clean,
      'notes', left(nullif(trim(coalesce(v_item->>'notes','')),''),250)
    ));
  end loop;

  if v_fulfillment = 'Entrega' then
    if coalesce((v_settings->>'delivery_enabled')::boolean, true) = false then
      raise exception 'Entrega indisponível.';
    end if;
    v_delivery_fee := coalesce((v_settings->>'delivery_fee')::numeric,0);
  else
    if coalesce((v_settings->>'pickup_enabled')::boolean, true) = false then
      raise exception 'Retirada indisponível.';
    end if;
  end if;

  v_coupon := upper(trim(coalesce(p_order->>'coupon_code','')));
  if v_coupon <> ''
     and coalesce((v_settings->>'coupon_enabled')::boolean,false)
     and upper(coalesce(v_settings->>'coupon_code','')) = v_coupon
     and v_subtotal >= coalesce((v_settings->>'coupon_minimum_value')::numeric,0) then
    v_discount := round(v_subtotal * coalesce((v_settings->>'coupon_discount_percent')::numeric,0) / 100, 2);
    if v_fulfillment='Entrega' and coalesce((v_settings->>'coupon_free_delivery')::boolean,false) then
      v_delivery_fee := 0;
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery_fee - v_discount);

  loop
    v_attempt := v_attempt + 1;
    v_order_code := lpad((floor(random()*1000000))::integer::text, 6, '0');
    exit when not exists(select 1 from public.orders where order_code=v_order_code);
    if v_attempt > 20 then raise exception 'Não foi possível gerar o número do pedido.'; end if;
  end loop;
  v_tracking_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_status := 'new';

  insert into public.orders(
    order_code, customer_name, customer_phone, fulfillment,
    address, neighborhood, complement, payment_method, change_for, notes,
    items, subtotal, delivery_fee, discount, total, status, tracking_token
  ) values (
    v_order_code,
    left(trim(p_order->>'customer_name'),100),
    left(trim(p_order->>'customer_phone'),30),
    v_fulfillment,
    case when v_fulfillment='Entrega' then left(trim(coalesce(p_order->>'address','')),180) else null end,
    case when v_fulfillment='Entrega' then left(trim(coalesce(p_order->>'neighborhood','')),100) else null end,
    case when v_fulfillment='Entrega' then left(trim(coalesce(p_order->>'complement','')),160) else null end,
    left(trim(coalesce(p_order->>'payment_method','Não informado')),80),
    left(nullif(trim(coalesce(p_order->>'change_for','')),''),40),
    left(nullif(trim(coalesce(p_order->>'notes','')),''),500),
    v_sanitized_items, v_subtotal, v_delivery_fee, v_discount, v_total, v_status, v_tracking_token
  );

  return jsonb_build_object(
    'order_code', v_order_code,
    'tracking_token', v_tracking_token,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'discount', v_discount,
    'total', v_total
  );
end;
$$;

revoke all on function public.create_order_secure(jsonb) from public;
grant execute on function public.create_order_secure(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
