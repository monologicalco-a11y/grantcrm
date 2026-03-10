import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getActiveAIProvider, generateContactScore } from '@/lib/ai-services';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { contactId } = await request.json();
        if (!contactId) {
            return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 });
        }

        // 1. Fetch Contact
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .single();

        if (contactError || !contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // 2. Fetch Activities
        const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(20);

        // 3. Get AI Provider
        const keys = await getActiveAIProvider(contact.organization_id);
        if (!keys) {
            return NextResponse.json({ error: 'AI provider not configured for this organization' }, { status: 400 });
        }

        // 4. Generate Score
        const result = await generateContactScore(contact, activities || [], keys);
        if (!result) {
            return NextResponse.json({ error: 'Failed to generate score' }, { status: 500 });
        }

        // 5. Update Contact
        const { error: updateError } = await supabase
            .from('contacts')
            .update({
                lead_score: result.score,
                score_reason: result.reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', contactId);

        if (updateError) {
            return NextResponse.json({ error: 'Failed to update contact with score' }, { status: 500 });
        }

        return NextResponse.json({ success: true, score: result.score, reason: result.reason });

    } catch (error: unknown) {
        console.error('[Score API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
