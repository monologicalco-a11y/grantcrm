-- ========================================================
-- REVERT SECURITY & RBAC HARDENING
-- Run this in the Supabase SQL Editor to restore unrestricted access
-- ========================================================

-- 1. Disable RLS on affected tables
ALTER TABLE public.sequence_enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_api_keys DISABLE ROW LEVEL SECURITY;

-- 2. Drop the specific policies created during the hardening phase
DROP POLICY IF EXISTS "enrollments_select" ON sequence_enrollments;
DROP POLICY IF EXISTS "enrollments_insert" ON sequence_enrollments;
DROP POLICY IF EXISTS "enrollments_update" ON sequence_enrollments;
DROP POLICY IF EXISTS "enrollments_delete" ON sequence_enrollments;

DROP POLICY IF EXISTS "contacts_select_rbac" ON contacts;
DROP POLICY IF EXISTS "contacts_update_rbac" ON contacts;

DROP POLICY IF EXISTS "deals_select_rbac" ON deals;
DROP POLICY IF EXISTS "deals_update_rbac" ON deals;

DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
DROP POLICY IF EXISTS "profiles_org_read" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;

DROP POLICY IF EXISTS "org_update_admin" ON organizations;

DROP POLICY IF EXISTS "api_keys_admin_all" ON api_keys;
DROP POLICY IF EXISTS "org_api_keys_admin_all" ON organization_api_keys;

-- Note: The 'organization_id' column in sequence_enrollments is kept 
-- as it contains data and doesn't interfere with access when RLS is disabled.
