import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
    request: Request,
    context: { params: Promise<{ emailId: string }> }
) {
    const { emailId } = await context.params;
    const url = new URL(request.url);
    const destinationUrl = url.searchParams.get('url');

    if (!destinationUrl) {
        return NextResponse.json({ error: 'Missing destination URL' }, { status: 400 });
    }

    // Fire and forget tracking logic
    trackEmailClick(request, emailId, destinationUrl).catch(err => {
        console.error('Failed to track email click:', err);
    });

    // Determine fallback
    let decodedUrl = '';
    try {
        decodedUrl = decodeURIComponent(destinationUrl);
        // Basic safety check for http/https to prevent javascript: or internal protocol injection
        if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
            decodedUrl = 'https://' + decodedUrl;
        }
    } catch {
        decodedUrl = process.env.NEXT_PUBLIC_APP_URL || '/';
    }

    // Redirect the user immediately
    return NextResponse.redirect(decodedUrl, 302);
}

// Async background tracking function
async function trackEmailClick(request: Request, emailId: string, destinationUrl: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) return;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const userAgent = request.headers.get('user-agent') || 'unknown';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    // Log the click event
    const { error: eventError } = await supabaseAdmin
        .from('email_tracking_events')
        .insert({
            email_id: emailId,
            event_type: 'click',
            link_url: destinationUrl,
            user_agent: userAgent,
            ip_address: ipAddress
        });

    if (eventError) {
        console.error('Click tracking event insert error:', eventError);
        return;
    }

    // Update email click counters
    const { data: emailData } = await supabaseAdmin
        .from('emails')
        .select('click_count')
        .eq('id', emailId)
        .single();

    if (emailData) {
        await supabaseAdmin
            .from('emails')
            .update({
                clicked_at: new Date().toISOString(),
                click_count: (emailData.click_count || 0) + 1
            })
            .eq('id', emailId);
    }
}
