import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { decrypt } from '@/lib/crypto';
import { injectTracking } from '@/lib/email-tracking';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to, subject, body_html, account_id } = await request.json();

    if (!to || !subject || !body_html || !account_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Decrypt credentials
    const password = decrypt(account.smtp_pass_encrypted);

    // 1. Create Email Record first to get the ID for tracking
    const { data: emailRecord, error: emailError } = await supabase
      .from('emails')
      .insert({
        account_id: account.id,
        organization_id: account.organization_id,
        from_addr: account.email_addr,
        to_addr: to,
        subject,
        body_html,
        folder: 'sent',
        is_read: true,
        received_at: new Date().toISOString()
      })
      .select()
      .single();

    if (emailError) {
      console.error('Failed to pre-log email:', emailError);
      return NextResponse.json({ error: 'Failed to initialize email tracking' }, { status: 500 });
    }

    // 2. Inject Tracking
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trackedBody = injectTracking(body_html, emailRecord.id, baseUrl);

    // Update the record with tracked body
    await supabase.from('emails').update({ body_html: trackedBody }).eq('id', emailRecord.id);

    // 3. Configure Nodemailer
    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_port === 465,
      auth: {
        user: account.smtp_user,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // 4. Send email
    await transporter.sendMail({
      from: `"${account.name || account.smtp_user}" <${account.email_addr || account.smtp_user}>`,
      to,
      subject,
      html: trackedBody,
    });

    // Also Log Activity
    await supabase.from('activities').insert({
      organization_id: account.organization_id,
      type: 'email',
      title: `Sent Email: ${subject}`,
      description: `Sent to ${to}`,
      created_by: user.id
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email send failed details:', {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command
    });
    console.log(`[DEBUG] Email send failed:`, error.message);

    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Check SMTP username/password.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timed out. Check SMTP Host/Port.';
    } else if (error.response) {
      errorMessage = `SMTP Error: ${error.response}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
