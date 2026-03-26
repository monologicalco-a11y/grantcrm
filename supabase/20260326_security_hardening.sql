-- ========================================================
-- MASTER SECURITY & MULTI-TENANCY HARDENING (v2 - FIX)
-- Run this in the Supabase SQL Editor for all environments
-- ========================================================

-- 1. HARDEN SEQUENCE ENROLLMENTS (Multi-tenancy)
-- Adds organization_id directly to the table for faster, safer RLS
ALTER TABLE public.sequence_enrollments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill organization_id from the parent sequence
UPDATE public.sequence_enrollments e
SET organization_id = s.organization_id
FROM public.email_sequences s
WHERE e.sequence_id = s.id AND e.organization_id IS NULL;

-- Enable RLS and add strict organization isolation policies
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enrollments_select" ON sequence_enrollments;
DROP POLICY IF EXISTS "enrollments_insert" ON sequence_enrollments;
DROP POLICY IF EXISTS "enrollments_update" ON sequence_enrollments;
DROP POLICY IF EXISTS "enrollments_delete" ON sequence_enrollments;

CREATE POLICY "enrollments_select" ON sequence_enrollments FOR SELECT USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "enrollments_insert" ON sequence_enrollments FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "enrollments_update" ON sequence_enrollments FOR UPDATE USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "enrollments_delete" ON sequence_enrollments FOR DELETE USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_enrollments_org ON public.sequence_enrollments(organization_id);

-- 2. RBAC HARDENING (Admin/Manager vs Agent)
-- Updates policies for Contacts, Deals, and Profiles

-- Contacts RLS
DROP POLICY IF EXISTS "contacts_select_rbac" ON contacts;
DROP POLICY IF EXISTS "contacts_update_rbac" ON contacts;

CREATE POLICY "contacts_select_rbac" ON contacts FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()) 
  AND (
    (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager') OR
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    owner_id IS NULL
  )
);

CREATE POLICY "contacts_update_rbac" ON contacts FOR UPDATE
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()) 
  AND (
    (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager') OR
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Deals RLS
DROP POLICY IF EXISTS "deals_select_rbac" ON deals;
DROP POLICY IF EXISTS "deals_update_rbac" ON deals;

CREATE POLICY "deals_select_rbac" ON deals FOR SELECT
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()) 
  AND (
    (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager') OR
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- 3. PROFILE & ORGANIZATION MANAGEMENT (Fixing Settings Page Access)

-- Profile Security (Allow members to see team list)
DROP POLICY IF EXISTS "profiles_org_read" ON profiles;
CREATE POLICY "profiles_org_read" ON profiles FOR SELECT
USING (
  organization_id IN (SELECT p.organization_id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Admin Management (Update/Delete Profiles in their Org)
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
);

-- Organization Management (Allow updating branding/settings)
DROP POLICY IF EXISTS "org_update_admin" ON organizations;
CREATE POLICY "org_update_admin" ON organizations FOR UPDATE
USING (
  id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
);

-- API Key Management (Legacy)
DROP POLICY IF EXISTS "api_keys_admin_all" ON api_keys;
CREATE POLICY "api_keys_admin_all" ON api_keys FOR ALL
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
);

-- API Key Management (Modern Hashed Keys)
ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_api_keys_admin_all" ON organization_api_keys;
CREATE POLICY "org_api_keys_admin_all" ON organization_api_keys FOR ALL
USING (
  organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
);
