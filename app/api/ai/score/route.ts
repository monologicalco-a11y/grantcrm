import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getActiveAIProvider, generateContactScore } from '@/lib/ai-services';

export async function POST(request: Request) {
    try {
        const { contactId, organizationId } = await request.json();

        if (!contactId || !organizationId) {
            return NextResponse.json({ error: 'Missing contactId or organizationId' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Fetch Contact
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .eq('organization_id', organizationId)
            .single();

        if (contactError || !contact) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // 2. Fetch recent activities
        const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(10);

        // 3. Fetch AI Keys
        const keys = await getActiveAIProvider(organizationId);
        if (!keys || !keys.active_provider) {
            return NextResponse.json({ error: 'AI provider not configured' }, { status: 400 });
        }

        // 4. Generate Score
        const result = await generateContactScore(contact, activities || [], keys);

        if (!result) {
            return NextResponse.json({ error: 'Failed to generate score from AI' }, { status: 500 });
        }

        // 5. Update Contact Score
        await supabase
            .from('contacts')
            .update({ lead_score: result.score })
            .eq('id', contactId);

        // 6. Log system activity
        await supabase
            .from('activities')
            .insert({
                organization_id: organizationId,
                contact_id: contactId,
                type: 'system',
                title: 'AI Lead Score Updated',
                description: `Score updated to ${result.score}. Reason: ${result.reason}`,
            });

        return NextResponse.json({ success: true, score: result.score, reason: result.reason });

    } catch (err) {
        console.error('AI Score Generation Error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
