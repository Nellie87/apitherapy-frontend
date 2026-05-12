-- Org-level roles (admin vs sales clerk), optional profiles for display names,
-- and automatic attribution of each sale to auth.uid() when inserted.

-- ─── Profiles (synced from auth.users for joins from sales) ─────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  full_name text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill: run once in SQL editor as admin if needed:
-- INSERT INTO public.profiles (id, email) SELECT id, email FROM auth.users ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- ─── Membership + role per organization ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'sales_clerk')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS org_members_user_id_idx ON public.org_members (user_id);

COMMENT ON TABLE public.org_members IS 'Per-org role: admin (full access) or sales_clerk (sales flows only). Missing row => treated as admin for backward compatibility.';

-- Who can read membership (own rows)
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own org_members" ON public.org_members;
CREATE POLICY "Users read own org_members"
  ON public.org_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RPC: resolve effective role (defaults to admin when no row)
CREATE OR REPLACE FUNCTION public.get_my_org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT om.role
     FROM public.org_members om
     WHERE om.org_id = p_org_id AND om.user_id = auth.uid()),
    'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_org_role(uuid) TO service_role;

-- ─── Attribute sales to logged-in user ─────────────────────────────────────
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS sold_by_user_id uuid REFERENCES auth.users (id);

COMMENT ON COLUMN public.sales.sold_by_user_id IS 'Staff member logged in when the sale was recorded (set from auth.uid() on insert).';

CREATE OR REPLACE FUNCTION public.set_sale_sold_by_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  claim_uid uuid;
BEGIN
  IF NEW.sold_by_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  NEW.sold_by_user_id := auth.uid();
  IF NEW.sold_by_user_id IS NULL THEN
    BEGIN
      claim_uid := NULLIF(trim(both '"' FROM current_setting('request.jwt.claim.sub', true)), '')::uuid;
      NEW.sold_by_user_id := claim_uid;
    EXCEPTION WHEN OTHERS THEN
      NEW.sold_by_user_id := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_set_sold_by ON public.sales;
CREATE TRIGGER trg_sales_set_sold_by
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sale_sold_by_from_session();
