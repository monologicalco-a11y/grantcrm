-- Migration: Normalize Status Casing
-- Lowercases all name/status fields to ensure consistency

-- 1. Lowercase contacts.status
UPDATE public.contacts 
SET status = LOWER(status)
WHERE status IS NOT NULL;

-- 2. Lowercase contact_statuses.name
UPDATE public.contact_statuses
SET name = LOWER(name);

-- 3. Standardize labels (especially High Potential)
UPDATE public.contact_statuses
SET label = 'High Potential'
WHERE name = 'high_potential';

UPDATE public.contact_statuses
SET label = 'No Answer'
WHERE name = 'no_answer';

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
