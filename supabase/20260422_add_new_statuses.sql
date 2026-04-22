-- Migration: Add specific statuses to ALL organizations
-- Updated: target all organizations instead of just Account C

INSERT INTO public.contact_statuses (organization_id, name, label, color, "order")
SELECT o.id, s.name, s.label, s.color, s.ord
FROM public.organizations o
CROSS JOIN (
    VALUES
        ('wrong_info', 'Wrong Info', 'red', 11),
        ('hung_up', 'Hung up', 'orange', 12),
        ('wrong_number', 'Wrong Number', 'red', 13),
        ('wrong_country', 'Wrong Country', 'yellow', 14),
        ('under_age_21', 'Under age 21', 'blue', 15),
        ('overage_80', 'Overage 80', 'blue', 16),
        ('denied_registration', 'Denied registration', 'slate', 17)
) AS s(name, label, color, ord)
ON CONFLICT (organization_id, name) DO UPDATE
SET 
    label = EXCLUDED.label,
    color = EXCLUDED.color,
    "order" = EXCLUDED."order";

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
