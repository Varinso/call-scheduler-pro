CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  dials integer NOT NULL DEFAULT 0,
  sets integer NOT NULL DEFAULT 0,
  quality_conversations integer NOT NULL DEFAULT 0,
  live_calls_with_closers integer NOT NULL DEFAULT 0,
  closed_sets integer NOT NULL DEFAULT 0,
  day_rating integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, report_date)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own daily reports"
  ON public.daily_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own daily reports"
  ON public.daily_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own daily reports"
  ON public.daily_reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all daily reports"
  ON public.daily_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));