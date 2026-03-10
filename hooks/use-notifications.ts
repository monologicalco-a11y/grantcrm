"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: "lead" | "system" | "task" | "mention" | "warning";
    link_url: string | null;
    read: boolean;
    created_at: string;
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const supabase = createClient();
    const router = useRouter();

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Subscribe to real-time changes
        const channel = supabase
            .channel("notifications-channel")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                },
                async (payload) => {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user && payload.new.user_id === user.id) {
                        const newNotif = payload.new as Notification;
                        setNotifications((prev) => [newNotif, ...prev]);
                        setUnreadCount((c) => c + 1);

                        // Toast
                        toast(newNotif.title, {
                            description: newNotif.message,
                            action: newNotif.link_url ? {
                                label: "View",
                                onClick: () => router.push(newNotif.link_url!)
                            } : undefined
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
        }
    };

    return { notifications, unreadCount, markAsRead, markAllAsRead };
}
