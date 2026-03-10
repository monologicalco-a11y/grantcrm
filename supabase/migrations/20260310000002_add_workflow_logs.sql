-- Automation Logs Table

CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    run_id UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id TEXT,
    level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error'
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_run_id ON workflow_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_org_id ON workflow_logs(organization_id);

-- Enable RLS
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_org_logs" ON workflow_logs FOR SELECT
    USING (organization_id = get_user_org_id());
