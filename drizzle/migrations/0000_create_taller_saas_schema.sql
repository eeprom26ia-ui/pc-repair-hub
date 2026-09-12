-- ===== Enums =====
CREATE TYPE public.workshop_role AS ENUM ('propietario', 'recepcion', 'tecnico');
CREATE TYPE public.order_status AS ENUM ('ingreso', 'diagnostico', 'en_progreso', 'listo', 'entregado');

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Workshops =====
CREATE TABLE public.workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code_prefix text NOT NULL DEFAULT 'RB',
  order_seq integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT '$',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshops TO authenticated;
GRANT ALL ON public.workshops TO service_role;

CREATE TABLE public.workshop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  full_name text,
  role public.workshop_role NOT NULL DEFAULT 'tecnico',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_members TO authenticated;
GRANT ALL ON public.workshop_members TO service_role;

-- ===== Helper functions (security definer, avoid RLS recursion) =====
CREATE OR REPLACE FUNCTION public.is_workshop_member(_workshop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshop_members
    WHERE workshop_id = _workshop_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workshop_role(_workshop_id uuid, _role public.workshop_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workshop_members
    WHERE workshop_id = _workshop_id AND user_id = auth.uid() AND role = _role
  );
$$;

-- ===== Workshops RLS =====
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workshops_select_members" ON public.workshops FOR SELECT TO authenticated
  USING (public.is_workshop_member(id) OR created_by = auth.uid());
CREATE POLICY "workshops_insert_self" ON public.workshops FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "workshops_update_owner" ON public.workshops FOR UPDATE TO authenticated
  USING (public.has_workshop_role(id, 'propietario') OR created_by = auth.uid());
CREATE POLICY "workshops_delete_owner" ON public.workshops FOR DELETE TO authenticated
  USING (public.has_workshop_role(id, 'propietario'));

ALTER TABLE public.workshop_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select" ON public.workshop_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_workshop_member(workshop_id));
CREATE POLICY "members_insert" ON public.workshop_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workshops w WHERE w.id = workshop_id AND w.created_by = auth.uid()))
    OR public.has_workshop_role(workshop_id, 'propietario')
  );
CREATE POLICY "members_update_owner" ON public.workshop_members FOR UPDATE TO authenticated
  USING (public.has_workshop_role(workshop_id, 'propietario'));
CREATE POLICY "members_delete_owner" ON public.workshop_members FOR DELETE TO authenticated
  USING (public.has_workshop_role(workshop_id, 'propietario'));

-- ===== Customers =====
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_all_members" ON public.customers FOR ALL TO authenticated
  USING (public.is_workshop_member(workshop_id))
  WITH CHECK (public.is_workshop_member(workshop_id));

-- ===== Parts =====
CREATE TABLE public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  sku text,
  name text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;
GRANT ALL ON public.parts TO service_role;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parts_all_members" ON public.parts FOR ALL TO authenticated
  USING (public.is_workshop_member(workshop_id))
  WITH CHECK (public.is_workshop_member(workshop_id));

-- ===== Repair orders =====
CREATE TABLE public.repair_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  code text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  device_type text,
  device_model text,
  serial_number text,
  issue text NOT NULL,
  diagnosis text,
  status public.order_status NOT NULL DEFAULT 'ingreso',
  technician_id uuid,
  technician_name text,
  labor_cost numeric(12,2) NOT NULL DEFAULT 0,
  advance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_orders TO authenticated;
GRANT ALL ON public.repair_orders TO service_role;
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_all_members" ON public.repair_orders FOR ALL TO authenticated
  USING (public.is_workshop_member(workshop_id))
  WITH CHECK (public.is_workshop_member(workshop_id));

CREATE OR REPLACE FUNCTION public.set_order_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seq integer;
  v_prefix text;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    UPDATE public.workshops
      SET order_seq = order_seq + 1
      WHERE id = NEW.workshop_id
      RETURNING order_seq, code_prefix INTO v_seq, v_prefix;
    NEW.code := COALESCE(v_prefix, 'RB') || '-' || to_char(now(), 'YYYY') || '-' || lpad(COALESCE(v_seq, 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_order_code BEFORE INSERT ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_code();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.repair_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Order lines (parts / labor) =====
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_all_members" ON public.order_items FOR ALL TO authenticated
  USING (public.is_workshop_member(workshop_id))
  WITH CHECK (public.is_workshop_member(workshop_id));

-- ===== Payments =====
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL DEFAULT 'efectivo',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_all_members" ON public.payments FOR ALL TO authenticated
  USING (public.is_workshop_member(workshop_id))
  WITH CHECK (public.is_workshop_member(workshop_id));

CREATE INDEX idx_orders_workshop ON public.repair_orders(workshop_id, created_at DESC);
CREATE INDEX idx_customers_workshop ON public.customers(workshop_id, name);
CREATE INDEX idx_parts_workshop ON public.parts(workshop_id, name);
CREATE INDEX idx_items_order ON public.order_items(order_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);