"use client";

import { useMemo } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "./use-realtime";
import type { Contact, ContactStatus } from "@/types";

// const supabase = createClient(); // Moved inside hooks for SSR safety

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    ownerId?: string;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ============================================
// DEFAULT STATUSES
// ============================================

const DEFAULT_STATUSES: Omit<ContactStatus, "id" | "organization_id" | "created_at">[] = [
    { name: "new", label: "New", color: "gray", order: 1 },
    { name: "no_answer", label: "No Answer", color: "orange", order: 2 },
    { name: "reassign", label: "Reassign", color: "orange", order: 3 },
    { name: "recovery", label: "Recovery", color: "blue", order: 4 },
    { name: "not_interested", label: "Not interested", color: "red", order: 5 },
    { name: "call_back", label: "Call back", color: "blue", order: 6 },
    { name: "not_potential", label: "Not potential", color: "slate", order: 7 },
    { name: "voice_message", label: "Voice message", color: "purple", order: 8 },
    { name: "depositor", label: "Depositor", color: "green", order: 9 },
    { name: "high_potential", label: "High Potential", color: "yellow", order: 10 },
];

// ============================================
// FETCHERS
// ============================================

async function fetchContacts(): Promise<Contact[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}

async function fetchContactsPaginated(params: PaginationParams): Promise<PaginatedResult<Contact>> {
    const { page = 1, limit = 50, search, status, ownerId } = params;
    const offset = (page - 1) * limit;
    const supabase = createClient();

    let query = supabase
        .from("contacts")
        .select("*", { count: "exact" });

    // Apply owner filter (crucial for visibility bug)
    if (ownerId && ownerId !== "all") {
        query = query.eq("owner_id", ownerId);
    }

    // Apply search filter
    if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    }

    // Apply status filter
    if (status) {
        query = query.eq("status", status);
    }

    // Apply pagination
    query = query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const total = count || 0;

    return {
        data: data || [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}



async function fetchContactByPhone(phone: string): Promise<Contact | null> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function fetchContactStatuses(): Promise<ContactStatus[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("contact_statuses")
        .select("*")
        .order("order", { ascending: true });

    const mapDefaults = () => DEFAULT_STATUSES.map((s, i) => ({
        ...s,
        id: `default-${i}`,
        organization_id: "default",
        created_at: new Date().toISOString()
    })) as ContactStatus[];

    if (error) {
        console.warn("Could not fetch custom statuses, using defaults:", error.message);
        return mapDefaults();
    }

    if (!data || data.length === 0) {
        return mapDefaults();
    }

    return data;
}

async function fetchContactCount(profileId?: string, isAdmin?: boolean): Promise<number> {
    const supabase = createClient();
    let query = supabase.from("contacts").select("*", { count: "exact", head: true });
    if (!isAdmin && profileId) {
        query = query.eq("owner_id", profileId);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

// ============================================
// SWR HOOKS
// ============================================

/**
 * Fetch all contacts (legacy, no pagination)
 */
export function useContacts() {
    const swr = useSWR<Contact[]>("contacts", fetchContacts, {
        revalidateOnFocus: false,
        dedupingInterval: 5000,
    });

    const realtimeKey = useMemo(() => (key: unknown) =>
        typeof key === "string" && (key === "contacts" || key.startsWith("contact-") || key.startsWith("contacts-paginated")),
        []);

    useRealtime("contacts", realtimeKey);

    return swr;
}

/**
 * Fetch contacts with pagination and search
 */
export function useContactsPaginated(params: PaginationParams = {}) {
    const key = `contacts-paginated-${JSON.stringify(params)}`;
    return useSWR<PaginatedResult<Contact>>(
        key,
        () => fetchContactsPaginated(params),
        {
            revalidateOnFocus: false,
            dedupingInterval: 5000,
        }
    );
}



export function useContactByPhone(phone: string | null) {
    return useSWR<Contact | null>(
        phone ? `contact-phone-${phone}` : null,
        () => (phone ? fetchContactByPhone(phone) : null),
        { revalidateOnFocus: false }
    );
}

export function useContactStatuses() {
    const swr = useSWR<ContactStatus[]>("contact-statuses", fetchContactStatuses, {
        revalidateOnFocus: false,
    });

    useRealtime("contact_statuses", "contact-statuses");

    return swr;
}

export function useContactCount(profileId?: string, isAdmin?: boolean) {
    return useSWR<number>(
        profileId ? `contact-count-${profileId}-${isAdmin}` : null,
        () => fetchContactCount(profileId, isAdmin),
        { revalidateOnFocus: false, dedupingInterval: 10000 }
    );
}

// ============================================
// MUTATION HOOKS
// ============================================

export function useCreateContact() {
    return useSWRMutation(
        "contacts",
        async (_, { arg }: { arg: Omit<Contact, "id" | "created_at" | "updated_at"> }) => {
            const res = await fetch('/api/internal/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(arg)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to create contact");
            }

            return res.json();
        },
        {
            revalidate: true,
        }
    );
}

export function useUpdateContact() {
    return useSWRMutation(
        "contacts",
        async (_, { arg }: { arg: { id: string; updates: Partial<Contact> } }) => {
            const supabase = createClient();
            // Safety check: ensure updates is serializable and not circular
            try {
                JSON.stringify(arg.updates);
            } catch {
                console.error("[useUpdateContact] Invalid updates payload:", arg.updates);
                throw new Error("Invalid update payload: circular reference or non-serializable object detected.");
            }

            const { data, error } = await supabase
                .from("contacts")
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

export function useDeleteContact() {
    return useSWRMutation(
        "contacts",
        async (_, { arg }: { arg: string }) => {
            const supabase = createClient();
            const { error } = await supabase.from("contacts").delete().eq("id", arg);
            if (error) {
                throw new Error(error.message || error.details || JSON.stringify(error));
            }
        },
        {
            revalidate: true,
        }
    );
}

export function useBulkDeleteContacts() {
    return useSWRMutation(
        "contacts",
        async (_, { arg }: { arg: string[] }) => {
            const supabase = createClient();
            if (arg.length === 0) return;
            const { error } = await supabase.from("contacts").delete().in("id", arg);
            if (error) {
                throw new Error(error.message || error.details || JSON.stringify(error));
            }
        },
        {
            revalidate: true,
        }
    );
}

export function useBulkCreateContacts() {
    return useSWRMutation(
        "contacts",
        async (_, { arg }: { arg: Omit<Contact, "id" | "created_at" | "updated_at">[] }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("contacts")
                .insert(arg)
                .select();
            if (error) throw error;
            return data;
        },
        {
            revalidate: true,
        }
    );
}

export function useCreateContactStatus() {
    return useSWRMutation(
        "contact-statuses",
        async (_, { arg }: { arg: Omit<ContactStatus, "id" | "created_at"> }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("contact_statuses")
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



export function useDeleteContactStatus() {
    return useSWRMutation(
        "contact-statuses",
        async (_, { arg }: { arg: string }) => {
            const supabase = createClient();
            const { error } = await supabase
                .from("contact_statuses")
                .delete()
                .eq("id", arg);
            if (error) throw error;
        }
    );
}
