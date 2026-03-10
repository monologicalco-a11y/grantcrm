import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const body = await request.json();

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // Fetch form details
        const { data: form, error: formError } = await supabase
            .from('web_forms')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .single();

        if (formError || !form) {
            return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
        }

        // Validate basic fields
        if (!body.email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const firstName = body.first_name || body.name?.split(' ')[0] || '';
        const lastName = body.last_name || body.name?.split(' ').slice(1).join(' ') || '';

        // Check if contact already exists
        const { data: existingContacts } = await supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', form.organization_id)
            .ilike('email', body.email);

        let contactId;

        if (existingContacts && existingContacts.length > 0) {
            contactId = existingContacts[0].id;
            // Update existing contact safely
            await supabase
                .from('contacts')
                .update({
                    first_name: firstName || undefined,
                    last_name: lastName || undefined,
                    phone: body.phone || undefined,
                    company: body.company || undefined,
                    updated_at: new Date().toISOString()
                })
                .eq('id', contactId);
        } else {
            // Create new contact
            const { data: newContact, error: createError } = await supabase
                .from('contacts')
                .insert({
                    organization_id: form.organization_id,
                    first_name: firstName,
                    last_name: lastName,
                    email: body.email,
                    phone: body.phone || '',
                    company: body.company || '',
                    status: 'new',
                })
                .select()
                .single();

            if (createError) throw createError;
            contactId = newContact.id;
        }

        // Log the activity
        await supabase
            .from('activities')
            .insert({
                organization_id: form.organization_id,
                contact_id: contactId,
                type: 'system',
                title: `Form Submitted: ${form.name}`,
                description: `Captured via web form. Form Data: ${JSON.stringify(body)}`,
            });

        return NextResponse.json({
            success: true,
            message: form.success_message
        });

    } catch (err: any) {
        console.error('Form submission error:', err);
        return NextResponse.json({ error: 'Failed to process submission' }, { status: 500 });
    }
}
