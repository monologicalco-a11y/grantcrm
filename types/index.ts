// Core Entity Types for NanoSol CRM

// User & Organization
export interface Organization {
    id: string;
    name: string;
    slug: string; // subdomain
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    created_at: string;
    updated_at: string;
}

export interface Profile {
    id: string;
    user_id: string;
    organization_id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    role: "admin" | "manager" | "agent" | "viewer";
    phone?: string;
    created_at: string;
    updated_at: string;
}

// CRM Entities
export interface Contact {
    id: string;
    organization_id: string;
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    job_title?: string | null;
    tags: string[];
    custom_fields?: Record<string, unknown>;
    lead_score?: number | null;
    status?: string | null;
    owner_id?: string | null;
    last_call_status?: string | null;
    last_call_at?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ContactStatus {
    id: string;
    organization_id: string;
    name: string;
    label: string;
    color?: string;
    order: number;
    created_at: string;
}

export interface Deal {
    id: string;
    organization_id: string;
    contact_id?: string | null;
    name: string;
    value: number;
    currency: string;
    stage: string;
    pipeline_id: string;
    probability: number;
    expected_close_date?: string | null;
    owner_id?: string | null;
    created_at: string;
    updated_at: string;
    // Joined relations
    contact?: {
        id: string;
        first_name: string;
        last_name?: string | null;
        email?: string | null;
        phone?: string | null;
        company?: string | null;
    } | null;
}

export interface DealNote {
    id: string;
    deal_id: string;
    author_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    author?: {
        full_name: string;
        avatar_url?: string;
    };
}

export interface Pipeline {
    id: string;
    organization_id: string;
    name: string;
    stages: PipelineStage[];
    created_at: string;
}

export interface PipelineStage {
    id: string;
    name: string;
    order: number;
    color?: string;
}

// Activities & Timeline
export type ActivityType =
    | "call"
    | "email"
    | "note"
    | "meeting"
    | "task"
    | "page_visit"
    | "file_upload"
    | "system";

export interface Activity {
    id: string;
    organization_id: string;
    contact_id?: string;
    deal_id?: string;
    type: ActivityType;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
    created_by?: string;
    created_at: string;
}

// Tasks & Events
export interface Task {
    id: string;
    created_at: string;
    title: string;
    description: string | null;
    status: "pending" | "in_progress" | "completed";
    priority: "low" | "medium" | "high";
    due_date: string | null;
    assigned_to_id: string | null;
    contact_id: string | null;
    deal_id: string | null;
    organization_id: string;
    position?: number;
    // Relations
    assigned_to?: Profile;
    contact?: Contact;
    deal?: Deal;
}

export interface WebForm {
    id: string;
    organization_id: string;
    name: string;
    source: string;
    redirect_url: string | null;
    status: "active" | "inactive";
    config: Record<string, string>;
    created_at: string;
}

export interface CalendarEvent {
    id: string;
    organization_id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    all_day: boolean;
    contact_id?: string;
    deal_id?: string;
    created_by: string;
    created_at: string;
}

// Communication
export interface SIPProfile {
    id: string;
    organization_id: string;
    user_id: string;
    name: string;  // Account display name (e.g., "Work SIP", "Personal")
    display_name: string;  // Caller ID display name
    sip_username: string;
    sip_domain: string;
    outbound_proxy?: string;
    registrar_server?: string;
    websocket_server?: string; // WebSocket server URL (e.g., wss://sip.provider.com:8089/ws)
    janus_url?: string; // Janus Gateway WSS URL
    janus_secret?: string; // Janus API secret
    sip_auth_user?: string; // Authorization username
    sip_protocol?: string; // Connection protocol (wss, ws)
    sip_password_encrypted?: string; // Stored encrypted in DB
    is_default: boolean;  // Primary account for this user
    is_active: boolean;
    created_at: string;
    updated_at?: string;
}

export interface SMTPConfig {
    id: string;
    organization_id: string;
    user_id?: string;
    name?: string;
    from_name?: string;
    email_addr: string;
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_pass_encrypted?: string;
    use_tls: boolean;
    imap_host?: string;
    imap_port?: number;
    imap_user?: string;
    imap_pass_encrypted?: string;
    is_org_wide: boolean;
    is_active: boolean;
    last_sync_at?: string;
    created_at: string;
    updated_at: string;
}


export interface Email {
    id: string;
    account_id: string;
    organization_id: string;
    from_name?: string;
    from_addr: string;
    to_addr: string;
    subject?: string;
    body_text?: string;
    body_html?: string;
    folder: "inbox" | "sent" | "archive" | "trash";
    is_read: boolean;
    has_attachment: boolean;
    opened_at?: string;
    clicked_at?: string;
    open_count?: number;
    click_count?: number;
    received_at: string;
    created_at: string;
}

export interface EmailTrackingEvent {
    id: string;
    email_id: string;
    event_type: "open" | "click";
    link_url?: string;
    user_agent?: string;
    ip_address?: string;
    created_at: string;
}

export interface EmailTemplate {
    id: string;
    organization_id: string;
    name: string;
    subject: string;
    body_html: string;
    body_text?: string;
    created_at: string;
    updated_at: string;
}

export interface EmailSequence {
    id: string;
    organization_id: string;
    name: string;
    steps: EmailSequenceStep[];
    is_active: boolean;
    smtp_config_id?: string;
    enrolled_count?: number; // Optional analytics
    open_rate?: number;     // Optional analytics
    created_at: string;
    updated_at: string;
}

export interface EmailSequenceStep {
    id: string;
    order: number;
    delay_days: number; // Duration value
    delay_unit?: 'minutes' | 'hours' | 'days'; // Duration unit (default: days)
    template_id: string;
    subject_override?: string;
}

export interface SequenceEnrollment {
    id: string;
    organization_id: string;
    sequence_id: string;
    contact_id: string;
    status: "active" | "paused" | "completed" | "replied";
    current_step: number;
    next_send_at?: string;
    created_at: string;
    updated_at: string;
    // Joined relations
    contact?: {
        id: string;
        first_name: string;
        last_name?: string | null;
        email?: string | null;
    } | null;
    sequence?: {
        id: string;
        name: string;
    } | null;
}

// Automation
export interface Workflow {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    nodes: unknown[]; // React Flow nodes
    edges: unknown[]; // React Flow edges
    is_active: boolean;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface WorkflowRun {
    id: string;
    organization_id: string;
    workflow_id: string;
    contact_id: string;
    status: 'running' | 'completed' | 'failed' | 'waiting';
    current_node_id?: string;
    last_executed_at: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

export interface AutomationRule {
    id: string;
    organization_id: string;
    name: string;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    actions: AutomationAction[];
    is_active: boolean;
    created_at: string;
}

export interface AutomationAction {
    id: string;
    type: string;
    config: Record<string, unknown>;
    order: number;
}

// Call Logs
export interface CallLog {
    id: string;
    organization_id: string;
    user_id?: string;
    contact_id?: string;
    phone_number: string;
    direction: "inbound" | "outbound";
    status: "completed" | "missed" | "failed" | "no_answer" | "busy";
    duration_seconds: number;
    outcome?: string;
    notes?: string;
    recording_url?: string;
    started_at: string;
    ended_at?: string;
    created_at: string;
    // Joined relations
    contact?: {
        id: string;
        first_name: string;
        last_name?: string | null;
    } | null;
}

// API Keys for AI Providers
export type AIProvider = "openai" | "gemini" | "qwen" | "kimi";

export interface APIKeys {
    id: string;
    organization_id: string;
    openai_key_encrypted?: string;
    gemini_key_encrypted?: string;
    qwen_key_encrypted?: string;
    kimi_key_encrypted?: string;
    active_provider: AIProvider;
    created_at: string;
    updated_at: string;
}

export interface UserIntegration {
    id: string;
    user_id: string;
    organization_id: string;
    provider: "google" | "outlook";
    external_email?: string;
    expires_at?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
