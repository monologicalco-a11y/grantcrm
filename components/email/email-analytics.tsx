"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Mail, MailOpen, MousePointerClick } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";

export function EmailAnalytics() {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalSent: 0,
        totalOpens: 0,
        totalClicks: 0,
        openRate: 0,
        clickRate: 0,
    });

    // We'll mock a time-series for the MVP unless we want to do a complex group-by query in JS
    const [chartData, setChartData] = useState<{ date: string; opens: number; clicks: number }[]>([]);

    useEffect(() => {
        const fetchMetrics = async () => {
            const supabase = createClient();

            // Fetch all sent emails
            const { data: emails } = await supabase
                .from('emails')
                .select('id, opens_count, clicks_count, received_at')
                .eq('folder', 'sent');

            if (emails) {
                const totalSent = emails.length;
                let totalOpens = 0;
                let totalClicks = 0;

                // For chart: aggregate by day
                const daysMap: Record<string, { opens: number, clicks: number }> = {};

                emails.forEach(e => {
                    const opens = e.opens_count || 0;
                    const clicks = e.clicks_count || 0;
                    totalOpens += opens;
                    totalClicks += clicks;

                    if (e.received_at) {
                        const date = new Date(e.received_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
                        if (!daysMap[date]) daysMap[date] = { opens: 0, clicks: 0 };
                        daysMap[date].opens += opens;
                        daysMap[date].clicks += clicks;
                    }
                });

                setMetrics({
                    totalSent,
                    totalOpens,
                    totalClicks,
                    openRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
                    clickRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
                });

                // Build recent 7 days chart data
                const recentDates = Object.keys(daysMap).slice(-7);
                setChartData(recentDates.map(d => ({
                    date: d,
                    opens: daysMap[d].opens,
                    clicks: daysMap[d].clicks
                })));
            }

            setLoading(false);
        };

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalSent}</div>
                        <p className="text-xs text-muted-foreground">Total outbound emails</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Opens</CardTitle>
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalOpens}</div>
                        <p className="text-xs text-muted-foreground">
                            {metrics.openRate.toFixed(1)}% Avg Open Rate
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Link Clicks</CardTitle>
                        <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalClicks}</div>
                        <p className="text-xs text-muted-foreground">
                            {metrics.clickRate.toFixed(1)}% Avg Click Rate
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Engagement Over Time</CardTitle>
                    <CardDescription>Email opens and clicks in the recent campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="opens" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Opens" />
                                    <Bar dataKey="clicks" fill="#10b981" radius={[4, 4, 0, 0]} name="Clicks" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-muted-foreground">
                                No engagement data available yet
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
