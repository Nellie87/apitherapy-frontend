-- Atomic stock adjustments, initial inventory rows, and void-sale stock restoration.
-- Apply with: supabase db push / migration runner, or run in Supabase SQL editor.

-- 1) Adjust qty in one transaction (avoids lost updates from concurrent edits)
CREATE OR REPLACE FUNCTION public.adjust_inventory_delta(
  p_org_id uuid,
  p_product_id uuid,
  p_mode text,
  p_amount numeric,
  p_reorder_level numeric DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_record_as text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_before numeric;
  v_after numeric;
  v_delta numeric;
  v_mode text;
  v_record text;
BEGIN
  v_mode := lower(trim(p_mode));
  IF v_mode NOT IN ('add', 'remove', 'set') THEN
    RAISE EXCEPTION 'Invalid adjustment mode';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be zero or positive';
  END IF;

  v_record := lower(trim(coalesce(nullif(trim(p_record_as), ''), v_mode)));
  IF v_record NOT IN ('add', 'remove', 'set', 'restock') THEN
    RAISE EXCEPTION 'Invalid movement type';
  END IF;
  IF v_record = 'restock' AND v_mode <> 'add' THEN
    RAISE EXCEPTION 'Restock must use add mode';
  END IF;

  SELECT qty_on_hand INTO v_before
  FROM public.inventory
  WHERE org_id = p_org_id AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory row not found for this product';
  END IF;

  IF v_mode = 'add' THEN
    v_delta := p_amount;
    v_after := v_before + v_delta;
  ELSIF v_mode = 'remove' THEN
    v_after := greatest(0::numeric, v_before - p_amount);
    v_delta := v_before - v_after;
  ELSE
    -- set
    v_after := greatest(0::numeric, p_amount);
    v_delta := v_after - v_before;
  END IF;

  UPDATE public.inventory
  SET
    qty_on_hand = v_after,
    reorder_level = coalesce(p_reorder_level, reorder_level),
    updated_at = now()
  WHERE org_id = p_org_id AND product_id = p_product_id;

  INSERT INTO public.inventory_movements (
    org_id,
    product_id,
    type,
    qty_delta,
    qty_before,
    qty_after,
    note
  )
  VALUES (
    p_org_id,
    p_product_id,
    v_record,
    v_delta,
    v_before,
    v_after,
    p_note
  );

  RETURN jsonb_build_object(
    'qty_before', v_before,
    'qty_after', v_after,
    'qty_delta', v_delta
  );
END;
$$;

-- 2) First-time stock row + movement (replacing separate insert + log on the client)
CREATE OR REPLACE FUNCTION public.create_inventory_initial(
  p_org_id uuid,
  p_product_id uuid,
  p_qty_on_hand numeric,
  p_reorder_level numeric,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_qty numeric;
  v_reorder numeric;
BEGIN
  IF p_qty_on_hand IS NULL OR p_qty_on_hand < 0 THEN
    RAISE EXCEPTION 'Initial quantity must be zero or positive';
  END IF;
  IF p_reorder_level IS NULL OR p_reorder_level < 0 THEN
    RAISE EXCEPTION 'Reorder level must be zero or positive';
  END IF;

  v_qty := p_qty_on_hand;
  v_reorder := p_reorder_level;

  INSERT INTO public.inventory (org_id, product_id, qty_on_hand, reorder_level, updated_at)
  VALUES (p_org_id, p_product_id, v_qty, v_reorder, now());

  INSERT INTO public.inventory_movements (
    org_id,
    product_id,
    type,
    qty_delta,
    qty_before,
    qty_after,
    note
  )
  VALUES (
    p_org_id,
    p_product_id,
    'add',
    v_qty,
    0,
    v_qty,
    coalesce(nullif(trim(p_note), ''), 'Initial stock entry')
  );

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This product already has an inventory row';
END;
$$;

-- 3) Void a completed sale: mark cancelled and put quantities back on hand
CREATE OR REPLACE FUNCTION public.void_sale_restore_inventory(
  p_org_id uuid,
  p_sale_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r_sale record;
  r_item record;
  v_before numeric;
  v_after numeric;
  v_status text;
BEGIN
  SELECT * INTO r_sale
  FROM public.sales
  WHERE id = p_sale_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  v_status := lower(trim(coalesce(r_sale.status, '')));
  IF v_status IN ('cancelled', 'refunded', 'void', 'voided') THEN
    RAISE EXCEPTION 'This sale is already voided or refunded';
  END IF;

  FOR r_item IN
    SELECT product_id, qty
    FROM public.sale_items
    WHERE sale_id = p_sale_id AND org_id = p_org_id
  LOOP
    SELECT qty_on_hand INTO v_before
    FROM public.inventory
    WHERE org_id = p_org_id AND product_id = r_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Missing inventory row for product %', r_item.product_id;
    END IF;

    v_after := v_before + r_item.qty;

    UPDATE public.inventory
    SET qty_on_hand = v_after, updated_at = now()
    WHERE org_id = p_org_id AND product_id = r_item.product_id;

    INSERT INTO public.inventory_movements (
      org_id,
      product_id,
      ref_sale_id,
      type,
      qty_delta,
      qty_before,
      qty_after,
      note
    )
    VALUES (
      p_org_id,
      r_item.product_id,
      p_sale_id,
      'sale_void',
      r_item.qty,
      v_before,
      v_after,
      coalesce(nullif(trim(p_note), ''), 'Sale void — stock restored')
    );
  END LOOP;

  UPDATE public.sales
  SET status = 'cancelled'
  WHERE id = p_sale_id AND org_id = p_org_id;

  RETURN jsonb_build_object('ok', true, 'sale_id', p_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_delta(uuid, uuid, text, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_delta(uuid, uuid, text, numeric, numeric, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_inventory_initial(uuid, uuid, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_inventory_initial(uuid, uuid, numeric, numeric, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.void_sale_restore_inventory(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale_restore_inventory(uuid, uuid, text) TO service_role;
