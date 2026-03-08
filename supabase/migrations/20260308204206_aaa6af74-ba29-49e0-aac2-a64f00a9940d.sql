
-- Allow all authenticated users to view all meetings
CREATE POLICY "All authenticated users can view meetings"
ON public.meetings FOR SELECT TO authenticated
USING (true);

-- Drop the restrictive caller-only and admin-only SELECT policies
DROP POLICY IF EXISTS "Callers can view own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Admins can view all meetings" ON public.meetings;

-- Create function to prevent overlapping meetings (same 30-min slot)
CREATE OR REPLACE FUNCTION public.check_meeting_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.meetings
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
      AND status = 'scheduled'
      AND meeting_date >= NEW.meeting_date - interval '29 minutes'
      AND meeting_date <= NEW.meeting_date + interval '29 minutes'
  ) THEN
    RAISE EXCEPTION 'A meeting is already scheduled at this time. Please choose a different slot.';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for overlap prevention
CREATE TRIGGER prevent_meeting_overlap
BEFORE INSERT OR UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.check_meeting_overlap();
