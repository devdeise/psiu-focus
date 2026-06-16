
-- ===========================================
-- Phase Backend 4: payments tables
-- ===========================================

-- clinic_payments
CREATE TABLE public.clinic_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL,
  month TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_amount NUMERIC(12,2),
  discount_amount NUMERIC(12,2),
  appointment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'aguardando',
  received_month TEXT NOT NULL,
  delayed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_payments TO authenticated;
GRANT ALL ON public.clinic_payments TO service_role;
ALTER TABLE public.clinic_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_payments_select_own" ON public.clinic_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clinic_payments_insert_own" ON public.clinic_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clinic_payments_update_own" ON public.clinic_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clinic_payments_delete_own" ON public.clinic_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_clinic_payments_user ON public.clinic_payments(user_id);
CREATE TRIGGER trg_clinic_payments_updated_at BEFORE UPDATE ON public.clinic_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- monthly_payments (particulares)
CREATE TABLE public.monthly_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  month TEXT NOT NULL,
  amount_due NUMERIC(12,2),
  amount_received NUMERIC(12,2),
  status TEXT,
  appointment_id TEXT,
  received_month TEXT,
  delayed BOOLEAN DEFAULT false,
  source TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_payments TO authenticated;
GRANT ALL ON public.monthly_payments TO service_role;
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_payments_select_own" ON public.monthly_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "monthly_payments_insert_own" ON public.monthly_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "monthly_payments_update_own" ON public.monthly_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "monthly_payments_delete_own" ON public.monthly_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_monthly_payments_user ON public.monthly_payments(user_id);
CREATE TRIGGER trg_monthly_payments_updated_at BEFORE UPDATE ON public.monthly_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cash_entries
CREATE TABLE public.cash_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  patient_id UUID,
  clinic_id UUID,
  appointment_id TEXT,
  month TEXT,
  received_month TEXT NOT NULL,
  delayed BOOLEAN DEFAULT false,
  expected_amount NUMERIC(12,2),
  discount_amount NUMERIC(12,2),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO authenticated;
GRANT ALL ON public.cash_entries TO service_role;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_entries_select_own" ON public.cash_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cash_entries_insert_own" ON public.cash_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cash_entries_update_own" ON public.cash_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cash_entries_delete_own" ON public.cash_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_cash_entries_user ON public.cash_entries(user_id);
CREATE TRIGGER trg_cash_entries_updated_at BEFORE UPDATE ON public.cash_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
