"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Loader2, AlertCircle, Info, CheckCircle2 } from "lucide-react";

interface Log {
    id: string;
    run_id: string;
    node_id: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    created_at: string;
    workflow_id: string;
}

export function ExecutionLogs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('workflow_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                setLogs(data);
            }
            setLoading(false);
        };

        fetchLogs();

        // Subscribe to real-time logs
        const channel = supabase
            .channel('workflow_logs_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workflow_logs' }, (payload) => {
                setLogs((prev) => [payload.new as Log, ...prev].slice(0, 50));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
            case 'warn': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'info': return <Info className="w-4 h-4 text-blue-500" />;
            default: return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Time</TableHead>
                                <TableHead className="w-[100px]">Level</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>Run ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No execution logs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-xs font-mono">
                                            {format(new Date(log.created_at), "HH:mm:ss.SSS MMM d")}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 capitalize text-xs">
                                                {getLevelIcon(log.level)}
                                                {log.level}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {log.message}
                                        </TableCell>
                                        <TableCell className="text-[10px] font-mono text-muted-foreground">
                                            {log.run_id?.split('-')[0]}...
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
