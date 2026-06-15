
-- =============== CLINICS ===============
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'ativa',
  repasse_percent numeric NOT NULL DEFAULT 0,
  default_session_value numeric,
  payment_types text[] NOT NULL DEFAULT ARRAY['clinica']::text[],
  payment_term_type text,
  payment_term_days integer,
  custom_payment_days integer,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own clinics select" ON public.clinics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own clinics insert" ON public.clinics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own clinics update" ON public.clinics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own clinics delete" ON public.clinics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX clinics_user_idx ON public.clinics(user_id);

-- =============== ATTENDANCE TYPES ===============
CREATE TABLE public.attendance_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_types TO authenticated;
GRANT ALL ON public.attendance_types TO service_role;
ALTER TABLE public.attendance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own at select" ON public.attendance_types FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own at insert" ON public.attendance_types FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own at update" ON public.attendance_types FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own at delete" ON public.attendance_types FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX at_user_idx ON public.attendance_types(user_id);
CREATE INDEX at_clinic_idx ON public.attendance_types(clinic_id);

-- =============== PATIENTS ===============
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'ativo',
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  attendance_type_id uuid REFERENCES public.attendance_types(id) ON DELETE SET NULL,
  attendance_type_name text,
  payment_type text NOT NULL DEFAULT 'particular',
  payment_frequency text NOT NULL DEFAULT 'sessao',
  session_value numeric NOT NULL DEFAULT 0,
  notes text,
  closed_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own p select" ON public.patients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own p insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own p update" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own p delete" ON public.patients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX patients_user_idx ON public.patients(user_id);

-- =============== PATIENT SCHEDULES ===============
CREATE TABLE public.patient_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  weekday text NOT NULL,
  time text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 50,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_schedules TO authenticated;
GRANT ALL ON public.patient_schedules TO service_role;
ALTER TABLE public.patient_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ps select" ON public.patient_schedules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ps insert" ON public.patient_schedules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ps update" ON public.patient_schedules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ps delete" ON public.patient_schedules FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ps_user_idx ON public.patient_schedules(user_id);
CREATE INDEX ps_patient_idx ON public.patient_schedules(patient_id);

-- =============== APPOINTMENTS ===============
CREATE TABLE public.appointments (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  schedule_id text,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  original_date text,
  duration_min integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'agendado',
  paid boolean NOT NULL DEFAULT false,
  repasse_confirmed boolean NOT NULL DEFAULT false,
  absence_reason text,
  notes text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ap select" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ap insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ap update" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ap delete" ON public.appointments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ap_user_idx ON public.appointments(user_id);
CREATE INDEX ap_patient_idx ON public.appointments(patient_id);
CREATE INDEX ap_starts_idx ON public.appointments(starts_at);

-- =============== DAY STATUSES ===============
CREATE TABLE public.day_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  status text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_statuses TO authenticated;
GRANT ALL ON public.day_statuses TO service_role;
ALTER TABLE public.day_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ds select" ON public.day_statuses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ds insert" ON public.day_statuses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ds update" ON public.day_statuses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ds delete" ON public.day_statuses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ds_user_idx ON public.day_statuses(user_id);

-- =============== VACATIONS ===============
CREATE TABLE public.vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_on text NOT NULL,
  ends_on text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacations TO authenticated;
GRANT ALL ON public.vacations TO service_role;
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own v select" ON public.vacations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own v insert" ON public.vacations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own v update" ON public.vacations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own v delete" ON public.vacations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX v_user_idx ON public.vacations(user_id);

-- =============== updated_at triggers ===============
CREATE TRIGGER t_clinics_updated BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_at_updated BEFORE UPDATE ON public.attendance_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_ps_updated BEFORE UPDATE ON public.patient_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_ap_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_ds_updated BEFORE UPDATE ON public.day_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_v_updated BEFORE UPDATE ON public.vacations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
