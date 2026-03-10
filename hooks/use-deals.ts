"use client";

import { useMemo } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "./use-realtime";
import type { Deal, Pipeline, Task, Activity } from "@/types";

// const supabase = createClient(); // Moved inside functions for SSR safety

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ============================================
// FETCHERS
// ============================================

async function fetchDeals(pipelineId?: string): Promise<Deal[]> {
    const supabase = createClient();
    let query = supabase
        .from("deals")
        .select(`
            *,
            contact:contacts(id, first_name, last_name, email)
        `);

    if (pipelineId && pipelineId !== 'all') {
        query = query.eq('pipeline_id', pipelineId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}



async function fetchPipelines(): Promise<Pipeline[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at");
    if (error) throw error;
    return data || [];
}

async function fetchActivities(limit = 20): Promise<Activity[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("activities")
        .select(`
      *,
      created_by:profiles(id, full_name, avatar_url)
    `)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data || [];
}

async function fetchTasks(status?: string): Promise<Task[]> {
    const supabase = createClient();
    let query = supabase
        .from("tasks")
        .select(`
      *,
      assigned_to:profiles(id, full_name, avatar_url),
      contact:contacts(id, first_name, last_name)
    `)
        .order("due_date", { ascending: true });

    if (status) {
        query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function fetchDealStats(profileId?: string, isAdmin?: boolean): Promise<{ activeCount: number, totalRevenue: number }> {
    const supabase = createClient();
    let query = supabase.from("deals").select("stage, value");
    if (!isAdmin && profileId) {
        query = query.eq("owner_id", profileId);
    }
    const { data, error } = await query;
    if (error) throw error;

    const activeCount = data?.filter(d => d.stage !== "closed" && d.stage !== "lost").length || 0;
    const totalRevenue = data?.reduce((acc, deal) => acc + (deal.stage === "closed" ? deal.value : 0), 0) || 0;

    return { activeCount, totalRevenue };
}

// ============================================
// SWR HOOKS
// ============================================

/**
 * Fetch all deals (legacy, no pagination)
 */
export function useDeals(pipelineId?: string) {
    const swr = useSWR<Deal[]>(
        pipelineId ? `deals-${pipelineId}` : "deals",
        () => fetchDeals(pipelineId),
        {
            revalidateOnFocus: false,
            dedupingInterval: 5000,
        }
    );

    const realtimeKey = useMemo(() => (key: unknown) =>
        typeof key === "string" && (key === "deals" || key.startsWith("deals-")),
        []);

    useRealtime("deals", realtimeKey);

    return swr;
}

/**
 * Fetch deals with pagination and search
 */


export function usePipelines() {
    const swr = useSWR<Pipeline[]>("pipelines", fetchPipelines, {
        revalidateOnFocus: false,
    });

    useRealtime("pipelines", "pipelines");

    return swr;
}

export function useActivities(limit = 20) {
    const swr = useSWR<Activity[]>(
        `activities-${limit}`,
        () => fetchActivities(limit),
        { revalidateOnFocus: false }
    );

    const realtimeKey = useMemo(() => (key: unknown) => typeof key === "string" && key.startsWith("activities-"), []);
    useRealtime("activities", realtimeKey);

    return swr;
}

export function useTasks(status?: string) {
    const swr = useSWR<Task[]>(
        `tasks-${status || "all"}`,
        () => fetchTasks(status),
        { revalidateOnFocus: false }
    );

    const realtimeKey = useMemo(() => (key: unknown) => typeof key === "string" && key.startsWith("tasks-"), []);
    useRealtime("tasks", realtimeKey);

    return swr;
}

export function useDealStats(profileId?: string, isAdmin?: boolean) {
    return useSWR<{ activeCount: number, totalRevenue: number }>(
        profileId ? `deal-stats-${profileId}-${isAdmin}` : null,
        () => fetchDealStats(profileId, isAdmin),
        { revalidateOnFocus: false, dedupingInterval: 10000 }
    );
}

// ============================================
// MUTATION HOOKS
// ============================================

export function useCreateDeal() {
    return useSWRMutation(
        "deals",
        async (_, { arg }: { arg: Omit<Deal, "id" | "created_at" | "updated_at"> }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("deals")
                .insert([arg])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        {
            revalidate: true,
        }
    );
}

export function useUpdateDeal() {
    return useSWRMutation(
        "deals",
        async (_, { arg }: { arg: { id: string; updates: Partial<Deal> } }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("deals")
                .update(arg.updates)
                .eq("id", arg.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        {
            revalidate: true,
        }
    );
}

export function useDeleteDeal() {
    return useSWRMutation(
        "deals",
        async (_, { arg }: { arg: string }) => {
            const supabase = createClient();
            const { error } = await supabase.from("deals").delete().eq("id", arg);
            if (error) throw error;
        }
    );
}

export function useCreatePipeline() {
    return useSWRMutation(
        "pipelines",
        async (_, { arg }: { arg: Omit<Pipeline, "id" | "created_at"> }) => {
            const supabase = createClient();
            const { data, error } = await supabase.from("pipelines").insert([arg]).select().single();
            if (error) throw error;
            return data;
        },
        { revalidate: true }
    );
}

export function useUpdatePipeline() {
    return useSWRMutation(
        "pipelines",
        async (_, { arg }: { arg: { id: string; updates: Partial<Pipeline> } }) => {
            const supabase = createClient();
            const { data, error } = await supabase.from("pipelines").update(arg.updates).eq("id", arg.id).select().single();
            if (error) throw error;
            return data;
        },
        { revalidate: true }
    );
}

export function useDeletePipeline() {
    return useSWRMutation(
        "pipelines",
        async (_, { arg }: { arg: string }) => {
            const supabase = createClient();
            const { error } = await supabase.from("pipelines").delete().eq("id", arg);
            if (error) throw error;
        }
    );
}


