import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { DealNote } from "@/types";

const supabase = createClient();

export function useDealNotes(dealId: string | null) {
    const { data, error, isLoading, mutate } = useSWR<DealNote[]>(
        dealId ? `deal-notes-${dealId}` : null,
        async () => {
            const { data, error } = await supabase
                .from("deal_notes")
                .select(`
                    *,
                    author:profiles!author_id(full_name, avatar_url)
                `)
                .eq("deal_id", dealId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as DealNote[];
        }
    );

    return {
        data,
        isLoading,
        isError: error,
        mutate,
    };
}

export function useCreateDealNote() {
    return {
        trigger: async (note: { deal_id: string; author_id: string; content: string }) => {
            const { data, error } = await supabase
                .from("deal_notes")
                .insert([note])
                .select()
                .single();

            if (error) throw error;
            return data;
        },
    };
}

export function useDeleteDealNote() {
    return {
        trigger: async (noteId: string) => {
            const { error } = await supabase.from("deal_notes").delete().eq("id", noteId);
            if (error) throw error;
        },
    };
}
