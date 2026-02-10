import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/crypto';
import { injectTracking } from '@/lib/email-tracking';
import type { EmailSequenceStep, EmailSequence, Contact, SMTPConfig } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Type definitions for processing
interface EnrollmentWithRelations {
    id: string;
    sequence_id: string;
    contact_id: string;
    current_step: number;
    status: 'active' | 'paused' | 'completed' | 'replied';
    next_send_at: string | null;
    contact: Contact;
    sequence: EmailSequence;
}

interface UserData {
    id: string;
    email?: string;
}

interface TransporterWithMeta extends nodemailer.Transporter {
    accountInfo?: SMTPConfig;
}

interface EnrollmentUpdate {
    current_step: number;
    updated_at: string;
    next_send_at?: string | null;
    status?: 'completed';
}

// Helper to process a single enrollment
async function processEnrollment(
    enrollment: EnrollmentWithRelations,
    supabase: SupabaseClient,
    transporters: Map<string, TransporterWithMeta>,
    user: UserData
): Promise<{ id: string; status: 'success' | 'error'; message?: string }> {
    try {
        const contact = enrollment.contact;
        const sequence = enrollment.sequence;

        if (!contact || !contact.email) {
            return { id: enrollment.id, status: 'error', message: 'Enrollment has no valid contact or email' };
        }

        const steps = sequence.steps as EmailSequenceStep[];
        const currentStepIndex = enrollment.current_step;

        // Auto-complete if no more steps
        if (currentStepIndex >= steps.length) {
            await supabase
                .from('sequence_enrollments')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', enrollment.id);
            return { id: enrollment.id, status: 'success', message: 'Sequence completed (no more steps)' };
        }

        const step = steps[currentStepIndex];

        // 1. Fetch Template
        const { data: template, error: tempError } = await supabase
            .from('email_templates')
            .select('*')
            .eq('id', step.template_id)
            .single();

        if (tempError || !template) {
            return { id: enrollment.id, status: 'error', message: `Template not found (ID: ${step.template_id})` };
        }

        // 2. Get Transporter (reused by SMTP config ID)
        const smtpId = sequence.smtp_config_id;
        if (!smtpId) {
            return { id: enrollment.id, status: 'error', message: 'No SMTP account selected for this sequence.' };
        }

        let transporter = transporters.get(smtpId);

        if (!transporter) {

            // Fetch SMTP Config using service role to bypass RLS
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false } }
            );

            const { data: account, error: accError } = await supabaseAdmin
                .from('smtp_configs')
                .select('*')
                .eq('id', sequence.smtp_config_id)
                .single();

            if (accError || !account) {
                return { id: enrollment.id, status: 'error', message: `SMTP config not found (ID: ${sequence.smtp_config_id})` };
            }

            if (!account.smtp_pass_encrypted) {
                return { id: enrollment.id, status: 'error', message: 'SMTP Password not configured for this account' };
            }

            const password = decrypt(account.smtp_pass_encrypted);
            transporter = nodemailer.createTransport({
                host: account.smtp_host,
                port: account.smtp_port,
                secure: account.smtp_port === 465,
                auth: { user: account.smtp_user, pass: password },
                tls: { rejectUnauthorized: false },
                pool: true,
                maxConnections: 5,
                maxMessages: 100
            });
            // Attach account info for later use (sender address)
            (transporter as TransporterWithMeta).accountInfo = account;
            transporters.set(smtpId, transporter as TransporterWithMeta);
        }

        const account = (transporter as TransporterWithMeta).accountInfo!;

        // 3. Prepare Email
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Generate a unique ID for the email log first or use a placeholder if we want to update after send
        // Better: insert the email log, get ID, then send with pixel.

        const subject = step.subject_override || template.subject || '(No Subject)';
        let body = template.body_html || template.body_text || '';

        // Variable replacement
        body = body.replace(/{{first_name}}/g, contact.first_name || '');
        body = body.replace(/{{last_name}}/g, contact.last_name || '');
        body = body.replace(/{{email}}/g, contact.email || '');

        // 4. Create Email Record (to get ID for tracking)
        const { data: emailRecord, error: emailError } = await supabase
            .from('emails')
            .insert({
                account_id: account.id,
                organization_id: account.organization_id,
                from_addr: account.email_addr,
                to_addr: contact.email,
                subject,
                body_html: body,
                folder: 'sent',
                is_read: true,
                received_at: new Date().toISOString(),
                enrollment_id: enrollment.id
            })
            .select()
            .single();

        if (emailError) {
            console.error('Failed to create email log:', emailError);
            return { id: enrollment.id, status: 'error', message: `Failed to create email log: ${emailError.message}` };
        }

        // 5. Inject Tracking
        const trackedBody = injectTracking(body, emailRecord.id, baseUrl);

        // Update record with tracked body
        await supabase
            .from('emails')
            .update({ body_html: trackedBody })
            .eq('id', emailRecord.id);

        // 6. Send Email
        await transporter.sendMail({
            from: `"${account.name || account.smtp_user}" <${account.email_addr || account.smtp_user}>`,
            to: contact.email,
            subject,
            html: trackedBody,
        });

        // 7. Log activity
        await supabase.from('activities').insert({
            organization_id: account.organization_id,
            contact_id: contact.id,
            type: 'email',
            title: `Sequence Email Sent: ${subject}`,
            description: `Sent as part of "${sequence.name}" (Step ${currentStepIndex + 1})`,
            created_by: user.id
        });

        // 6. Update Enrollment
        const nextStepIndex = currentStepIndex + 1;
        const nextStep = steps[nextStepIndex];

        const updates: EnrollmentUpdate = {
            current_step: nextStepIndex,
            updated_at: new Date().toISOString()
        };

        if (nextStep) {
            const nextSendAt = new Date();
            const delayValue = nextStep.delay_days ?? 1; // Default to 1 if missing (legacy), but 0 is valid
            const delayUnit = nextStep.delay_unit || 'days';

            if (delayUnit === 'minutes') {
                nextSendAt.setMinutes(nextSendAt.getMinutes() + delayValue);
            } else if (delayUnit === 'hours') {
                nextSendAt.setHours(nextSendAt.getHours() + delayValue);
            } else {
                nextSendAt.setDate(nextSendAt.getDate() + delayValue);
            }

            updates.next_send_at = nextSendAt.toISOString();
        } else {
            updates.status = 'completed';
            updates.next_send_at = null;
        }

        await supabase
            .from('sequence_enrollments')
            .update(updates)
            .eq('id', enrollment.id);

        return { id: enrollment.id, status: 'success', message: 'Email sent successfully' };
    } catch (err: unknown) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.log(`[DEBUG] Enrollment ${enrollment.id} failed:`, errorMessage);
        return { id: enrollment.id, status: 'error', message: errorMessage };
    }
}

export async function POST() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: { get(name: string) { return cookieStore.get(name)?.value; } },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Fetch enrollments
        const { data: enrollments, error: enrollError } = await supabase
            .from('sequence_enrollments')
            .select(`
                *,
                contact:contacts(id, email, first_name, last_name, organization_id),
                sequence:email_sequences(id, name, steps, organization_id, smtp_config_id)
            `)
            .eq('status', 'active')
            .or(`next_send_at.lte.${new Date().toISOString()},next_send_at.is.null`);

        if (enrollError) throw enrollError;

        if (!enrollments || enrollments.length === 0) {
            return NextResponse.json({
                success: true,
                processed: 0,
                details: [],
                message: 'No enrollments due for processing'
            });
        }

        // Processing Map
        const transporters = new Map<string, nodemailer.Transporter>();
        const BATCH_SIZE = 5;
        const results = [];

        // Process in batches
        for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
            const batch = enrollments.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(e => processEnrollment(e, supabase, transporters, user))
            );
            results.push(...batchResults);
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const failureCount = results.filter(r => r.status === 'error').length;

        return NextResponse.json({
            success: true,
            processed: results.length,
            successCount,
            failureCount,
            details: results
        });

    } catch (error: unknown) {
        console.error('Sequence processing failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
