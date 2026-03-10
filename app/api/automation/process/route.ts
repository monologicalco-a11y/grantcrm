import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processWorkflowRun } from '@/lib/automations/engine';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

export async function POST(req: Request) {
    // Secret key check (optional but recommended for cron)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Fetch runs due for processing
        const { data: runs, error: runsError } = await supabaseAdmin
            .from('workflow_runs')
            .select('id')
            .in('status', ['running', 'waiting'])
            .or(`next_execution_at.lte.${new Date().toISOString()},next_execution_at.is.null`)
            .limit(20);

        if (runsError) throw runsError;
        if (!runs || runs.length === 0) {
            return NextResponse.json({ success: true, message: 'No runs to process' });
        }

        const results = [];

        for (const run of runs) {
            try {
                await processWorkflowRun(run.id);
                results.push({ id: run.id, status: 'processed' });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`Error processing run ${run.id}:`, message);
                results.push({ id: run.id, status: 'error', message });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, details: results });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Workflow processing failed:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

