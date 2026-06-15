
ALTER TABLE public.patient_schedules ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.patient_schedules ALTER COLUMN id TYPE text USING id::text;
