-- Add score_reason to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS score_reason TEXT;

-- Update RLS if needed (usually already covered by generic contact policies)
