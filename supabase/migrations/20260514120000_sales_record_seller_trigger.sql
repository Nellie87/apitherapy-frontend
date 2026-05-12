-- When a sale row is inserted with JWT context, stamp who recorded it (session user).
-- Works with inserts from `create_sale_strict` when executed as the authenticated user.
-- If your RPC is SECURITY DEFINER and auth.uid() is null, also update from the app after create (see createSaleStrict).

CREATE OR REPLACE FUNCTION public.sales_stamp_actor_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.sold_by_user_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.sold_by_user_id := auth.uid();
  END IF;
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_stamp_actor ON public.sales;
CREATE TRIGGER trg_sales_stamp_actor
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_stamp_actor_before_insert();
