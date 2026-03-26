"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "./use-realtime";
import type { EmailTemplate, EmailSequence, SequenceEnrollment, SMTPConfig } from "@/types";

// const supabase = createClient(); // Moved inside functions for SSR safety

// ============================================
// FETCHERS
// ============================================

async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}

async function fetchEmailSequences(): Promise<EmailSequence[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("email_sequences")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}

async function fetchSMTPConfigs(): Promise<SMTPConfig[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("smtp_configs")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}

async function fetchEmails(url: string) {
    const res = await fetch(url);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch emails");
    }
    return res.json();
}

// ============================================
// SWR HOOKS
// ============================================

export function useEmails(folder: string = "inbox", page: number = 1, limit: number = 50) {
    const key = `/api/email?folder=${folder}&page=${page}&limit=${limit}`;
    const swr = useSWR(key, fetchEmails, {
        revalidateOnFocus: false,
    });

    // Realtime subscription for emails
    // We subscribe to the 'emails' table and invalidate the key on change
    const realtimeKey = useMemo(() => (key: unknown) => typeof key === "string" && key.startsWith("/api/email"), []);
    useRealtime("emails", realtimeKey);

    return swr;
}

export function useEmailTemplates() {
    const swr = useSWR<EmailTemplate[]>("email-templates", fetchEmailTemplates, {
        revalidateOnFocus: false,
    });

    useRealtime("email_templates", "email-templates");

    return swr;
}

export function useEmailSequences() {
    const swr = useSWR<EmailSequence[]>("email-sequences", fetchEmailSequences, {
        revalidateOnFocus: false,
    });

    useRealtime("email_sequences", "email-sequences");

    return swr;
}

export function useSMTPConfigs() {
    const swr = useSWR<SMTPConfig[]>("smtp-configs", fetchSMTPConfigs, {
        revalidateOnFocus: false,
    });

    useRealtime("smtp_configs", "smtp-configs");

    return swr;
}

// ============================================
// MUTATION HOOKS - EMAILS
// ============================================

export function useEmailBatchAction() {
    return useSWRMutation(
        "/api/email/batch",
        async (url, { arg }: { arg: { emailIds: string[], action: 'delete' | 'move' | 'mark_read' | 'mark_unread', destination?: string } }) => {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(arg),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to perform batch action");
            }
            return res.json();
        },
        {
            onSuccess: () => {
                // Invalidate email queries
                mutate((key) => typeof key === "string" && key.startsWith("/api/email"), undefined, { revalidate: true });
            }
        }
    );
}

// ============================================
// MUTATION HOOKS - SEQUENCES
// ============================================

export function useCreateEmailSequence() {
    return useSWRMutation(
        "email-sequences",
        async (_, { arg }: { arg: Omit<EmailSequence, "id" | "created_at" | "updated_at"> }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("email_sequences")
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

export function useUpdateEmailSequence() {
    return useSWRMutation(
        "email-sequences",
        async (_, { arg }: { arg: { id: string; updates: Partial<EmailSequence> } }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("email_sequences")
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

export function useDeleteEmailSequence() {
    return useSWRMutation(
        "email-sequences",
        async (_, { arg }: { arg: string }) => {
            const supabase = createClient();
            const { error } = await supabase
                .from("email_sequences")
                .delete()
                .eq("id", arg);
            if (error) throw error;
        }
    );
}

// ============================================
// MUTATION HOOKS - TEMPLATES
// ============================================

export function useCreateEmailTemplate() {
    return useSWRMutation(
        "email-templates",
        async (_, { arg }: { arg: Omit<EmailTemplate, "id" | "created_at" | "updated_at"> }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("email_templates")
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

export function useUpdateEmailTemplate() {
    return useSWRMutation(
        "email-templates",
        async (_, { arg }: { arg: { id: string; updates: Partial<EmailTemplate> } }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("email_templates")
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

export function useDeleteEmailTemplate() {
    return useSWRMutation(
        "email-templates",
        async (_, { arg }: { arg: string }) => {
            const supabase = createClient();
            const { error } = await supabase
                .from("email_templates")
                .delete()
                .eq("id", arg);
            if (error) throw error;
        }
    );
}

// ============================================
// MUTATION HOOKS - ENROLLMENTS
// ============================================

export function useSequenceEnrollments(sequenceId: string) {
    const swr = useSWR<SequenceEnrollment[]>(sequenceId ? `sequence-enrollments-${sequenceId}` : null, async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("sequence_enrollments")
            .select("*, contact:contacts(id, first_name, last_name, email)")
            .eq("sequence_id", sequenceId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return (data || []) as SequenceEnrollment[];
    }, {
        revalidateOnFocus: false
    });

    const realtimeKey = useMemo(() => (key: unknown) => typeof key === "string" && key.startsWith("sequence-enrollments"), []);
    useRealtime("sequence_enrollments", realtimeKey);

    return swr;
}

export function useEnrollInSequence() {
    return useSWRMutation(
        "sequence-enrollments",
        async (_, { arg }: { arg: { sequence_id: string; contact_ids: string[]; organization_id: string } }) => {
            const supabase = createClient();
            const enrollments = arg.contact_ids.map(contact_id => ({
                organization_id: arg.organization_id,
                sequence_id: arg.sequence_id,
                contact_id,
                status: "active",
                current_step: 0,
                next_send_at: new Date().toISOString()
            }));

            const { data, error } = await supabase
                .from("sequence_enrollments")
                .insert(enrollments)
                .select();

            if (error) {
                console.error("Supabase enrollment error:", {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }
            return data;
        },
        {
            revalidate: true,
            onSuccess: () => {
                mutate("email-sequences");
            }
        }
    );
}

export function useUpdateEnrollment() {
    return useSWRMutation(
        "sequence-enrollments",
        async (_, { arg }: { arg: { id: string; updates: Partial<SequenceEnrollment>; sequence_id: string } }) => {
            const supabase = createClient();
            const { data, error } = await supabase
                .from("sequence_enrollments")
                .update(arg.updates)
                .eq("id", arg.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        {
            revalidate: true,
            onSuccess: (_data, _key, config) => {
                const arg = (config as { arg: { sequence_id?: string } }).arg;
                if (arg?.sequence_id) {
                    mutate(`sequence-enrollments-${arg.sequence_id}`);
                }
                mutate("email-sequences");
            }
        }
    );
}

export function useDeleteEnrollment() {
    return useSWRMutation(
        "sequence-enrollments",
        async (_, { arg }: { arg: { ids: string[]; sequence_id: string } }) => {
            const res = await fetch("/api/sequences/enrollments/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enrollmentIds: arg.ids })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to remove contact from sequence");
            }

            return res.json();
        },
        {
            revalidate: true,
            onSuccess: (_data, _key, config) => {
                const arg = (config as { arg: { sequence_id?: string } }).arg;
                if (arg?.sequence_id) {
                    mutate(`sequence-enrollments-${arg.sequence_id}`);
                }
                mutate("email-sequences");
            }
        }
    );
}

// ============================================
// MUTATION HOOKS - SMTP / ACCOUNTS
// ============================================

interface SaveEmailAccountArgs extends Partial<SMTPConfig> {
    smtp_pass?: string;
    imap_pass?: string;
}

export function useDeleteEmailAccount() {
    return useSWRMutation(
        "smtp-configs",
        async (_, { arg }: { arg: string }) => {
            const res = await fetch(`/api/settings/smtp?id=${arg}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete email account");
            }

            return res.json();
        },
        {
            revalidate: true,
        }
    );
}

export function useSaveEmailAccount() {
    return useSWRMutation(
        "smtp-configs",
        async (_, { arg }: { arg: SaveEmailAccountArgs & { orgId?: string } }) => {
            const { id, smtp_pass, imap_pass, orgId, ...rest } = arg;

            const updates: Record<string, unknown> = { ...rest };

            if (smtp_pass) updates.smtp_pass_plain = smtp_pass;
            if (imap_pass) updates.imap_pass_plain = imap_pass;

            const res = await fetch("/api/settings/smtp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    orgId,
                    updates
                }),
            });

            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData.error || "Failed to save email account");
            }

            return responseData;
        },
        {
            revalidate: true,
        }
    );
}
