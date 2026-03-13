-- Ensure meetings are visible to all authenticated users (company-wide calendar/list)

DROP POLICY IF EXISTS "Callers can view own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Admins can view all meetings" ON public.meetings;
DROP POLICY IF EXISTS "All authenticated users can view meetings" ON public.meetings;

CREATE POLICY "All authenticated users can view meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (true);
