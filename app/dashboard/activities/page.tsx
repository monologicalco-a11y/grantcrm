"use client";

import { useState, useEffect } from "react";
import {
    Phone,
    Mail,
    Calendar,
    MessageSquare,
    History,
    CheckSquare,
    Search,
    Filter,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useActiveProfile } from "@/hooks/use-data";
import { createClient } from "@/lib/supabase/client";

export default function ActivitiesPage() {
    const { data: profile } = useActiveProfile();
    const supabase = createClient();

    const [activities, setActivities] = useState<Record<string, any>[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    useEffect(() => {
        if (!profile?.organization_id) return;
        const fetch = async () => {
            await fetchActivities();
        };
        fetch();
    }, [profile?.organization_id, typeFilter]);

    async function fetchActivities() {
        setLoading(true);
        let query = supabase
            .from('activities')
            .select('*, contacts(first_name, last_name, avatar_url), deals(name), profiles:created_by(full_name, avatar_url)')
            .eq('organization_id', profile!.organization_id)
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1);

        if (typeFilter !== "all") {
            query = query.eq('type', typeFilter);
        }

        const { data } = await query;
        if (data) setActivities(data);
        setLoading(false);
    }

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'call': return <Phone className="h-4 w-4" />;
            case 'email': return <Mail className="h-4 w-4" />;
            case 'meeting': return <Calendar className="h-4 w-4" />;
            case 'note': return <MessageSquare className="h-4 w-4" />;
            case 'task': return <CheckSquare className="h-4 w-4" />;
            default: return <History className="h-4 w-4" />;
        }
    };

    const filteredActivities = activities.filter(a =>
        a.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.description?.toLowerCase().includes(search.toLowerCase()) ||
        a.contacts?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.contacts?.last_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Activity Timeline</h1>
                    <p className="text-muted-foreground">A unified view of all interactions across your organization.</p>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search activities, contacts..."
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="call">Calls</SelectItem>
                                    <SelectItem value="email">Emails</SelectItem>
                                    <SelectItem value="note">Notes</SelectItem>
                                    <SelectItem value="meeting">Meetings</SelectItem>
                                    <SelectItem value="task">Tasks</SelectItem>
                                    <SelectItem value="system">System</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <History className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No activities matched your filters.
                            </div>
                        ) : (
                            filteredActivities.map((activity) => (
                                <div key={activity.id} className="relative flex items-start gap-6 group">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow-sm z-10 shrink-0">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="flex-1 space-y-1.5 pb-8 border-b border-slate-100 last:border-0 last:pb-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm">{activity.title}</span>
                                                {activity.type && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">
                                                        {activity.type}
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm">
                                            {activity.contacts && (
                                                <div className="flex items-center gap-1.5 text-primary hover:underline cursor-pointer">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={activity.contacts.avatar_url} />
                                                        <AvatarFallback className="text-[10px]">
                                                            {activity.contacts.first_name[0]}{activity.contacts.last_name?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span>{activity.contacts.first_name} {activity.contacts.last_name}</span>
                                                </div>
                                            )}
                                            {activity.deals && (
                                                <span className="text-muted-foreground flex items-center gap-1">
                                                    • <span className="font-medium">Deal: {activity.deals.name}</span>
                                                </span>
                                            )}
                                        </div>

                                        {activity.description && (
                                            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md mt-2 border border-slate-50">
                                                {activity.description}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                Created by: {activity.profiles?.full_name || 'System'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {!loading && filteredActivities.length >= pageSize && (
                        <div className="flex justify-center mt-8">
                            <Button variant="outline" onClick={() => setPage(p => p + 1)}>Load More</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
