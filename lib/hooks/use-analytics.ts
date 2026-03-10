import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { subDays, startOfDay, format } from 'date-fns';

export interface AnalyticsData {
    calls: {
        total: number;
        connected: number;
        volumeByDay: { name: string; calls: number; connected: number }[];
    };
    tasks: {
        total: number;
        completed: number;
        pending: number;
        distribution: { name: string; value: number; color: string }[];
    };
    deals: {
        totalValue: number;
        count: number;
        activeCount: number;
        weightedValue: number;
        wonValue: number;
        averageCloseTimeDays: number;
        funnel: { name: string; value: number }[];
    };
    leaderboard: {
        agentId: string;
        agentName: string;
        callsMade: number;
        dealsWon: number;
        revenueWon: number;
    }[];
}

interface CallMetadata {
    outcome?: string;
    [key: string]: unknown;
}

const fetchAnalytics = async (ownerId?: string, days: number = 7, pipelineId?: string): Promise<AnalyticsData> => {
    const supabase = createClient();
    const today = new Date();
    const startDate = subDays(today, days - 1); // e.g. 7 days including today

    // Build base queries
    let callsQuery = supabase
        .from('activities')
        .select('created_at, metadata, created_by')
        .eq('type', 'call')
        .gte('created_at', startOfDay(startDate).toISOString());

    let tasksQuery = supabase
        .from('tasks')
        .select('status');

    let dealsQuery = supabase
        .from('deals')
        .select('value, stage, probability, created_at, updated_at, owner_id, pipeline_id');

    const profilesQuery = supabase
        .from('profiles')
        .select('id, full_name');

    // Apply owner filtering if provided
    if (ownerId) {
        callsQuery = callsQuery.eq('created_by', ownerId);
        tasksQuery = tasksQuery.eq('assigned_to_id', ownerId);
        dealsQuery = dealsQuery.eq('owner_id', ownerId);
    }

    // Apply pipeline filtering if provided
    if (pipelineId && pipelineId !== 'all') {
        dealsQuery = dealsQuery.eq('pipeline_id', pipelineId);
    }

    // 1. Fetch Calls (Activities)
    const { data: callsData, error: callsError } = await callsQuery;

    if (callsError) throw callsError;

    // Process Calls
    const volumeByDay = Array.from({ length: days }).map((_, i) => {
        const date = subDays(today, days - 1 - i);
        const dayStr = days <= 14 ? format(date, 'EEE') : format(date, 'MMM d'); // Mon, Tue OR Mar 1
        const dayCalls = callsData?.filter(c =>
            new Date(c.created_at).toDateString() === date.toDateString()
        ) || [];

        // Check if metadata indicates connection (assuming metadata.outcome or similar)
        // Adjust based on your actual metadata structure for calls
        const connectedCalls = dayCalls.filter(c => {
            const metadata = c.metadata as CallMetadata;
            const outcome = metadata?.outcome;
            return outcome === 'connected' || outcome === 'answered';
        });

        return {
            name: dayStr,
            calls: dayCalls.length,
            connected: connectedCalls.length
        };
    });

    const totalCalls = callsData?.length || 0;
    const totalConnected = callsData?.filter(c => {
        const metadata = c.metadata as CallMetadata;
        const outcome = metadata?.outcome;
        return outcome === 'connected' || outcome === 'answered';
    }).length || 0;


    // 2. Fetch Tasks
    const { data: tasksData, error: tasksError } = await tasksQuery;

    if (tasksError) throw tasksError;

    const totalTasks = tasksData?.length || 0;
    const completedTasks = tasksData?.filter(t => t.status === 'completed').length || 0;
    const pendingTasks = tasksData?.filter(t => t.status === 'pending').length || 0;
    const inProgressTasks = tasksData?.filter(t => t.status === 'in_progress').length || 0;

    const taskDistribution = [
        { name: 'Completed', value: completedTasks, color: '#22c55e' },
        { name: 'In Progress', value: inProgressTasks, color: '#3b82f6' },
        { name: 'Pending', value: pendingTasks, color: '#eab308' },
    ].filter(d => d.value > 0);


    // 3. Fetch Deals
    const { data: dealsData, error: dealsError } = await dealsQuery;

    if (dealsError) throw dealsError;

    type DealOverview = { value: number; stage: string; probability: number; created_at?: string; updated_at?: string; owner_id?: string };
    const typedDealsData = (dealsData as unknown as DealOverview[]) || [];

    // Calculate pipeline metrics
    const totalDealValue = typedDealsData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const dealCount = typedDealsData.length;
    const activeCount = typedDealsData.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost').length;

    // Revenue forecasting (Weighted Pipeline)
    const weightedValue = typedDealsData.reduce((acc, curr) => {
        // Skip closed_won and closed_lost for active pipeline weight
        if (curr.stage === 'closed_won' || curr.stage === 'closed_lost') return acc;
        return acc + ((Number(curr.value) || 0) * ((Number(curr.probability) || 0) / 100));
    }, 0);

    // Closed won value and Sales Velocity
    let totalCloseDays = 0;
    let wonCount = 0;

    const wonValue = typedDealsData.filter(d => d.stage === 'closed_won').reduce((acc, curr) => {
        wonCount++;
        if (curr.created_at && curr.updated_at) {
            const created = new Date(curr.created_at);
            const updated = new Date(curr.updated_at);
            const daysToClose = (updated.getTime() - created.getTime()) / (1000 * 3600 * 24);
            totalCloseDays += Math.max(0, daysToClose);
        }
        return acc + (Number(curr.value) || 0);
    }, 0);

    const averageCloseTimeDays = wonCount > 0 ? totalCloseDays / wonCount : 0;

    // Funnel Data
    const stageCounts: Record<string, number> = {};
    typedDealsData.forEach(d => {
        const stage = d.stage || 'unknown';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    // Sort funnel logically or just by count (ideally we map this to pipeline order, but count works for MVP if ordering is unknown)
    const funnel = Object.entries(stageCounts)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), value }))
        .sort((a, b) => b.value - a.value);

    // 4. Fetch Profiles for Leaderboard
    const { data: profilesData } = await profilesQuery;

    // Build Leaderboard
    const leaderboardMap: Record<string, { callsMade: number, dealsWon: number, revenueWon: number }> = {};

    // Initialize map
    profilesData?.forEach(p => {
        leaderboardMap[p.id] = { callsMade: 0, dealsWon: 0, revenueWon: 0 };
    });

    // Add calls
    callsData?.forEach(c => {
        const owner = c.created_by;
        if (owner && leaderboardMap[owner]) {
            leaderboardMap[owner].callsMade++;
        }
    });

    // Add deals
    typedDealsData.forEach(d => {
        const owner = d.owner_id;
        if (owner && d.stage === 'closed_won' && leaderboardMap[owner]) {
            leaderboardMap[owner].dealsWon++;
            leaderboardMap[owner].revenueWon += (Number(d.value) || 0);
        }
    });

    const leaderboard = (profilesData || [])
        .map(p => ({
            agentId: p.id,
            agentName: p.full_name || 'Unknown Agent',
            ...leaderboardMap[p.id]
        }))
        // Filter out completely inactive users unless they are the only ones
        .filter(l => l.callsMade > 0 || l.dealsWon > 0 || l.revenueWon > 0)
        .sort((a, b) => b.revenueWon - a.revenueWon || b.dealsWon - a.dealsWon);

    return {
        calls: {
            total: totalCalls,
            connected: totalConnected,
            volumeByDay
        },
        tasks: {
            total: totalTasks,
            completed: completedTasks,
            pending: pendingTasks,
            distribution: taskDistribution
        },
        deals: {
            totalValue: totalDealValue,
            count: dealCount,
            activeCount,
            weightedValue,
            wonValue,
            averageCloseTimeDays,
            funnel
        },
        leaderboard
    };
};

export function useAnalytics(ownerId?: string, days: number = 7, pipelineId?: string) {
    return useSWR(
        ['dashboard-analytics', ownerId, days, pipelineId],
        () => fetchAnalytics(ownerId, days, pipelineId),
        {
            refreshInterval: 60000,
            revalidateOnFocus: false
        }
    );
}
