import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Base64 encoded transparent 1x1 pixel GIF
const PIXEL_BASE64 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const PIXEL_BUFFER = Buffer.from(PIXEL_BASE64, 'base64');

export async function GET(
    request: Request,
    context: { params: Promise<{ emailId: string }> }
) {
    const { emailId } = await context.params;

    // We do not await this immediately to keep the pixel response extremely fast.
    trackEmailOpen(request, emailId).catch(err => {
        console.error('Failed to track email open:', err);
    });

    // Return the transparent 1x1 pixel GIF immediately
    return new NextResponse(PIXEL_BUFFER, {
        status: 200,
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        }
    });
}

// Fire-and-forget background tracking
async function trackEmailOpen(request: Request, emailId: string) {
    // 1. Initialize Supabase Admin strictly for backend event tracking
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase credentials');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // 2. Extract metadata safely
    const userAgent = request.headers.get('user-agent') || 'unknown';
    // 'x-forwarded-for' is common in proxies/Vercel
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    // 3. Insert tracking event
    const { error: eventError } = await supabaseAdmin
        .from('email_tracking_events')
        .insert({
            email_id: emailId,
            event_type: 'open',
            user_agent: userAgent,
            ip_address: ipAddress
        });

    if (eventError) {
        console.error('Email tracking event insert error:', eventError);
        return; // Don't try to bump the counter if insert failed (could be invalid email_id)
    }

    // 4. Update the email's statistics (atomically increment open count)
    // Unfortunately Supabase REST doesn't have an easy atomic increment from JS without an RPC,
    // so we'll fetch then update, or just use a stored procedure if we had one.
    // For now, updating timestamp and grabbing current state is fine for MVP.
    const { data: emailData } = await supabaseAdmin
        .from('emails')
        .select('open_count')
        .eq('id', emailId)
        .single();

    if (emailData) {
        await supabaseAdmin
            .from('emails')
            .update({
                opened_at: new Date().toISOString(),
                open_count: (emailData.open_count || 0) + 1
            })
            .eq('id', emailId);
    }
}
