"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { Activity, Phone, CheckCircle2, TrendingUp, Loader2, DollarSign, Timer } from "lucide-react";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useActiveProfile, usePipelines } from "@/hooks/use-data";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pipeline } from "@/types";

export default function ReportsPage() {
    const [days, setDays] = useState(7);
    const [pipelineId, setPipelineId] = useState<string>("all");
    const { data: profile } = useActiveProfile();
    const { data: pipelines } = usePipelines();
    const isAdmin = profile?.role === "admin" || profile?.role === "manager";
    const ownerId = isAdmin ? undefined : profile?.id;

    const { data, isLoading } = useAnalytics(ownerId, days, pipelineId);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data) {
        return <div className="p-8 text-center text-muted-foreground">Unable to load analytics.</div>;
    }

    const { calls, tasks, deals } = data;
    const connectedRate = calls.total > 0 ? ((calls.connected / calls.total) * 100).toFixed(1) : "0.0";

    // Calculate percentage change (mock for now, or implement logic)
    // For MVP, we'll hide the percentage change or assume safe defaults

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                    <p className="text-muted-foreground">
                        Performance metrics (Last {days} Days)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={pipelineId} onValueChange={setPipelineId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Pipelines</SelectItem>
                            {pipelines?.map((p: Pipeline) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={days.toString()} onValueChange={(v) => setDays(Number(v))}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Date Range" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                            <SelectItem value="90">Last 90 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Calls (7d)</CardTitle>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{calls.total}</div>
                        <p className="text-xs text-muted-foreground">
                            {calls.connected} connected
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Connect Rate</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{connectedRate}%</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{tasks.completed}</div>
                        <p className="text-xs text-muted-foreground">
                            {tasks.pending} pending
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Weighted Pipeline</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${deals.weightedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {deals.activeCount} active deals
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Revenue (Closed)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${deals.wonValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total closed won value
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sales Velocity</CardTitle>
                        <Timer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {deals.averageCloseTimeDays.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">days</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Average time to close won deals
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Call Volume</CardTitle>
                        <CardDescription>Daily outbound calls over the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={calls.volumeByDay}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Calls" />
                                    <Bar dataKey="connected" fill="#22c55e" radius={[4, 4, 0, 0]} name="Connected" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Task Status</CardTitle>
                        <CardDescription>Distribution of active tasks</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={tasks.distribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {tasks.distribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute grid gap-2 text-sm">
                                {tasks.distribution.map(item => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span className="text-muted-foreground">{item.name}: {item.value}</span>
                                    </div>
                                ))}
                                {tasks.distribution.length === 0 && (
                                    <span className="text-muted-foreground text-xs">No active tasks</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pipeline Funnel</CardTitle>
                        <CardDescription>Deal distribution across active stages</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <FunnelChart>
                                    <RechartsTooltip />
                                    <Funnel
                                        dataKey="value"
                                        data={deals.funnel}
                                        isAnimationActive
                                    >
                                        <LabelList position="right" fill="#888" stroke="none" dataKey="name" />
                                        {
                                            deals.funnel.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                                            ))
                                        }
                                    </Funnel>
                                </FunnelChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Agent Performance Leaderboard */}
            {isAdmin && data.leaderboard && data.leaderboard.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Agent Performance</CardTitle>
                        <CardDescription>Top performing team members for the selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {data.leaderboard.map((agent, index) => (
                                <div key={agent.agentId} className="flex items-center">
                                    <div className="space-y-1 w-[200px]">
                                        <p className="text-sm font-medium leading-none">{agent.agentName}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-1">Rank #{index + 1}</p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-8 text-right">
                                        <div className="hidden sm:block">
                                            <p className="text-sm font-medium">{agent.callsMade}</p>
                                            <p className="text-xs text-muted-foreground">Calls</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{agent.dealsWon}</p>
                                            <p className="text-xs text-muted-foreground">Won Deals</p>
                                        </div>
                                        <div className="font-medium text-green-600 dark:text-green-400 w-[100px]">
                                            +${agent.revenueWon.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
