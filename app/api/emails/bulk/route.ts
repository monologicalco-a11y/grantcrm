import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';

export async function POST(request: Request) {
    try {
        const bodyText = await request.text();
        const payload = JSON.parse(bodyText);
        const { subject, body, contactIds, isSelectAllMatching, filters } = payload;

        if (!subject || !body) {
            return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Resolve Contacts
        let contacts: { id: string, email: string, first_name: string, last_name: string, organization_id: string }[] = [];

        if (isSelectAllMatching) {
            let query = supabaseAdmin.from('contacts').select('id, email, first_name, last_name, organization_id');
            if (filters?.search) {
                query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
            }
            if (filters?.status && filters.status !== "all") {
                query = query.eq('status', filters.status);
            }
            if (filters?.ownerId && filters.ownerId !== "all") {
                query = query.eq('owner_id', filters.ownerId);
            }

            const { data, error } = await query;
            if (error) throw error;
            contacts = data || [];
        } else {
            if (!contactIds || contactIds.length === 0) {
                return NextResponse.json({ error: 'No contacts specified' }, { status: 400 });
            }
            const { data, error } = await supabaseAdmin
                .from('contacts')
                .select('id, email, first_name, last_name, organization_id')
                .in('id', contactIds);

            if (error) throw error;
            contacts = data || [];
        }

        contacts = contacts.filter(c => !!c.email);

        if (contacts.length === 0) {
            return NextResponse.json({ error: 'No selected contacts have valid email addresses.' }, { status: 400 });
        }

        let queuedCount = 0;

        for (const contact of contacts) {
            try {
                // Pass the subject and the HTML body directly
                // We use the `variables` argument for dynamic mapping so we don't need manual regexes
                await sendEmail({
                    to: contact.email,
                    subject: subject,
                    bodyHtml: body,
                    organizationId: contact.organization_id,
                    variables: {
                        first_name: contact.first_name || 'there',
                        last_name: contact.last_name || ''
                    }
                });
                queuedCount++;
            } catch (sendErr) {
                console.error('Failed to send email to', contact.email, sendErr);
            }
        }

        return NextResponse.json({ success: true, queuedCount });
    } catch (error) {
        console.error('Bulk email error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
