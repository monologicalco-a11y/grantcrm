-- supabase/migrations/20260310000000_add_web_forms.sql

CREATE TABLE IF NOT EXISTS public.web_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    schema JSONB NOT NULL DEFAULT '[]'::JSONB,
    submit_button_text TEXT DEFAULT 'Submit',
    success_message TEXT DEFAULT 'Thank you for your submission!',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- In case the table already existed without these columns from an older aborted schema
ALTER TABLE IF EXISTS public.web_forms 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS schema JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS submit_button_text TEXT,
    ADD COLUMN IF NOT EXISTS success_message TEXT;

ALTER TABLE public.web_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for public forms" ON public.web_forms
    FOR SELECT USING (is_active = true);

CREATE POLICY "Enable all access for org users" ON public.web_forms
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM public.profiles
            WHERE organization_id = web_forms.organization_id
        )
    );
