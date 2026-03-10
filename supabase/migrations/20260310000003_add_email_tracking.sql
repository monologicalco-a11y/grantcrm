-- Migration: Add Email Tracking and Deal Notes

-- 1. Extend emails table for tracking counters
ALTER TABLE public.emails
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- 2. Create Email Tracking Events table
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
    link_url TEXT, -- Only applicable for 'click' events
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_events_email_id ON public.email_tracking_events(email_id);

-- 3. Create Deal Notes table
CREATE TABLE IF NOT EXISTS public.deal_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_notes_deal_id ON public.deal_notes(deal_id);

-- 4. Set up Row Level Security (RLS) policies

-- email_tracking_events RLS: Selects are allowed if you can select the parent email. Inserts are typically allowed from public endpoints (API route uses Service Role, so RLS doesn't strictly block it, but good to have)
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_tracking_events_select" ON public.email_tracking_events;
CREATE POLICY "email_tracking_events_select" ON public.email_tracking_events FOR SELECT
  USING (
    email_id IN (
      SELECT id FROM public.emails 
      WHERE account_id IN (
        SELECT id FROM public.smtp_configs 
        WHERE organization_id = get_user_org_id() AND (
          is_org_wide = true OR user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
      )
    )
  );

-- deal_notes RLS: Selects/Inserts/Updates/Deletes allowed if you can access the deal
ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_notes_select" ON public.deal_notes;
CREATE POLICY "deal_notes_select" ON public.deal_notes FOR SELECT
  USING (
    deal_id IN (
      SELECT id FROM public.deals WHERE organization_id = get_user_org_id()
    )
  );

DROP POLICY IF EXISTS "deal_notes_insert" ON public.deal_notes;
CREATE POLICY "deal_notes_insert" ON public.deal_notes FOR INSERT
  WITH CHECK (
    deal_id IN (
      SELECT id FROM public.deals WHERE organization_id = get_user_org_id()
    ) AND author_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deal_notes_update" ON public.deal_notes;
CREATE POLICY "deal_notes_update" ON public.deal_notes FOR UPDATE
  USING (
    deal_id IN (
      SELECT id FROM public.deals WHERE organization_id = get_user_org_id()
    ) AND (
      author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    )
  );

DROP POLICY IF EXISTS "deal_notes_delete" ON public.deal_notes;
CREATE POLICY "deal_notes_delete" ON public.deal_notes FOR DELETE
  USING (
    deal_id IN (
      SELECT id FROM public.deals WHERE organization_id = get_user_org_id()
    ) AND (
      author_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
    )
  );

-- Trigger for deal_notes updated_at
DROP TRIGGER IF EXISTS set_deal_notes_updated_at ON public.deal_notes;
CREATE TRIGGER set_deal_notes_updated_at
BEFORE UPDATE ON public.deal_notes
FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
