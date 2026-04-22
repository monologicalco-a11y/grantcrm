-- Migration: Add specific statuses to Account C only
-- Targeted organization: Account C (by name or slug)

DO $$
DECLARE
    target_org_id UUID;
BEGIN
    -- 1. Try to find organization by name or slug
    SELECT id INTO target_org_id 
    FROM public.organizations 
    WHERE name ILIKE 'Account C' OR slug ILIKE 'account-c'
    LIMIT 1;

    -- 2. If organization exists, add the specific statuses
    IF target_org_id IS NOT NULL THEN
        INSERT INTO public.contact_statuses (organization_id, name, label, color, "order")
        VALUES
            (target_org_id, 'wrong_info', 'Wrong Info', 'red', 11),
            (target_org_id, 'hung_up', 'Hung up', 'orange', 12),
            (target_org_id, 'wrong_number', 'Wrong Number', 'red', 13),
            (target_org_id, 'wrong_country', 'Wrong Country', 'yellow', 14),
            (target_org_id, 'under_age_21', 'Under age 21', 'blue', 15),
            (target_org_id, 'overage_80', 'Overage 80', 'blue', 16),
            (target_org_id, 'denied_registration', 'Denied registration', 'slate', 17)
        ON CONFLICT (organization_id, name) DO UPDATE
        SET 
            label = EXCLUDED.label,
            color = EXCLUDED.color,
            "order" = EXCLUDED."order";
            
        RAISE NOTICE 'Statuses added successfully for organization ID: %', target_org_id;
    ELSE
        RAISE NOTICE 'Organization "Account C" or "account-c" not found. No statuses added.';
    END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
