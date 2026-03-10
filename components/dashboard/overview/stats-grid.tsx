"use client";

import { motion } from "framer-motion";
import { Users, Briefcase, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProfile } from "@/hooks/use-data";
import { useAnalytics } from "@/lib/hooks/use-analytics";
import { useMemo } from "react";

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

export function StatsGrid() {
    const { data: profile, isLoading: profileLoading } = useActiveProfile();
    const isAdmin = profile?.role === "admin" || profile?.role === "manager";
    const ownerId = isAdmin ? undefined : profile?.id;

    const { data: analytics, isLoading: analyticsLoading } = useAnalytics(ownerId);

    const stats = useMemo(() => [
        {
            title: "Connect Rate (7d)",
            value: analytics ? (analytics.calls.total > 0 ? `${((analytics.calls.connected / analytics.calls.total) * 100).toFixed(1)}%` : "0%") : "0%",
            change: `${analytics?.calls.total || 0} total calls`,
            trend: "up",
            icon: Users,
        },
        {
            title: "Active Deals",
            value: analytics?.deals.activeCount?.toString() || "0",
            change: `${analytics?.deals.count || 0} in pipeline`,
            trend: "up",
            icon: Briefcase,
        },
        {
            title: "Weighted Revenue",
            value: `$${(analytics?.deals.weightedValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            change: "Pipeline forecast",
            trend: "up",
            icon: TrendingUp,
        },
        {
            title: "Revenue (Closed)",
            value: `$${(analytics?.deals.wonValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            change: "Total closed won",
            trend: "up",
            icon: DollarSign,
        },
    ], [analytics]);

    if (profileLoading || analyticsLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-1" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
                <motion.div
                    key={stat.title}
                    variants={item}
                    initial="hidden"
                    animate="show"
                >
                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <div className="flex items-center text-xs mt-1">
                                {stat.trend === "up" ? (
                                    <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                                ) : (
                                    <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
                                )}
                                <span className={stat.trend === "up" ? "text-green-500" : "text-muted-foreground"}>
                                    {stat.change}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            ))}
        </div>
    );
}
