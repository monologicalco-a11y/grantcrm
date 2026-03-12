-- Migration: Add CRM API Key for External Integrations
-- Date: 2026-03-12

-- Add crm_api_key column to api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS crm_api_key TEXT;

-- Create a unique index for fast lookups (allows NULLs but ensures uniqueness for generated keys)
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_crm_api_key ON api_keys(crm_api_key) WHERE crm_api_key IS NOT NULL;

-- Function to handle organization creation and ensure api_keys record exists (optional/safety)
-- Actually, we'll just handle it in the application logic or manual setup for now.

-- Add comment for documentation
COMMENT ON COLUMN api_keys.crm_api_key IS 'API Key for external CRM integrations (Leads, Pulling data, etc.)';
