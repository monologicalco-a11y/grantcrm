import { createClient } from "@supabase/supabase-js";

/**
 * Validates a CRM API Key and returns the associated organization_id
 * @param apiKey The API key from X-Api-Key header
 * @returns organization_id or null if invalid
 */
export async function validateApiKey(apiKey: string | null): Promise<string | null> {
    if (!apiKey) return null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("API Auth: Supabase environment variables missing");
        return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from("api_keys")
        .select("organization_id")
        .eq("crm_api_key", apiKey)
        .single();

    if (error || !data) {
        return null;
    }

    return data.organization_id;
}
