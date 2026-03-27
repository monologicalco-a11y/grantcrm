-- Refresh Realtime Replication for contact_statuses
-- Fixes CHANNEL_ERROR by re-adding the table to the publication

BEGIN;

-- 1. Remove contact_statuses from publication (ignore error if not present)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.contact_statuses;
EXCEPTION WHEN OTHERS THEN
    -- Table wasn't in the publication, that's fine
    NULL;
END $$;

-- 2. Re-add it to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_statuses;

-- 3. Ensure RLS allows authenticated users to read status definitions
DROP POLICY IF EXISTS "contact_statuses_realtime_access" ON public.contact_statuses;
CREATE POLICY "contact_statuses_realtime_access" ON public.contact_statuses FOR SELECT
  TO authenticated
  USING (true);

-- 4. Enable full replication (all columns)
ALTER TABLE public.contact_statuses REPLICA IDENTITY FULL;

COMMIT;
