"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useActiveProfile } from '@/hooks/use-data';
import { toast } from 'sonner';

export interface AppNotification {
    id: string;
    organization_id: string;
    user_id: string;
    title: string;
    message?: string;
    type: string;
    is_read: boolean;
    link_url?: string;
    created_at: string;
    metadata?: Record<string, unknown>;
}

export function useNotifications() {
    const { data: profile } = useActiveProfile();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        if (!profile?.id) return;

        // 1. Fetch initial notifications
        const fetchNotifications = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            }
            setLoading(false);
        };

        fetchNotifications();

        // 2. Subscribe to Realtime changes
        const channel = supabase
            .channel(`notifications:user_id=eq.${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${profile.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as AppNotification;
                    setNotifications((prev) => [newNotification, ...prev]);
                    setUnreadCount((prev) => prev + 1);
                    toast(newNotification.title, {
                        description: newNotification.message,
                        action: newNotification.link_url ? {
                            label: 'View',
                            onClick: () => window.location.href = newNotification.link_url!
                        } : undefined
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${profile.id}`,
                },
                (payload) => {
                    const updated = payload.new as AppNotification;
                    setNotifications((prev) =>
                        prev.map((n) => (n.id === updated.id ? updated : n))
                    );
                    if (payload.old.is_read === false && updated.is_read === true) {
                        setUnreadCount((prev) => Math.max(0, prev - 1));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, supabase]);

    const markAsRead = async (id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
    };

    const markAllAsRead = async () => {
        if (!profile?.id) return;

        setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', profile.id)
            .eq('is_read', false);
    };

    const clearAll = async () => {
        if (!profile?.id) return;
        setNotifications([]);
        setUnreadCount(0);

        await supabase
            .from('notifications')
            .delete()
            .eq('user_id', profile.id);
    };

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        clearAll
    };
}
