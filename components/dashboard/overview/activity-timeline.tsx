"use client";

import { motion } from "framer-motion";
import { Phone, History } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveProfile, useActivities } from "@/hooks/use-data";
import { useMemo } from "react";

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

export function ActivityTimeline() {
    const { data: profile } = useActiveProfile();
    const { data: activities, isLoading } = useActivities(5);

    const isAdmin = profile?.role === "admin" || profile?.role === "manager";
    const myActivities = useMemo(() => isAdmin ? activities : activities?.filter(a => a.created_by === profile?.id), [isAdmin, activities, profile?.id]);

    if (isLoading) {
        return (
            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-20" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-start gap-4 p-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Link href="/dashboard/activities">
                    <Button variant="ghost" size="sm">View all</Button>
                </Link>
            </CardHeader>
            <CardContent className="space-y-4">
                {myActivities?.map((activity) => (
                    <motion.div
                        key={activity.id}
                        variants={item}
                        initial="hidden"
                        animate="show"
                        className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{activity.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                                {activity.description}
                            </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(activity.created_at).toLocaleDateString()}
                        </span>
                    </motion.div>
                ))}
                {(!myActivities || myActivities.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No recent activity.</p>
                )}
            </CardContent>
        </Card>
    );
}
