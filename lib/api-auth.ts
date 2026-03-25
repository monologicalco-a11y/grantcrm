import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

/**
 * Validates a CRM API Key and returns the associated organization_id
 * Supports both modern "nk_live_" keys (hashed) and legacy CRM integration keys (plain text).
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

    // 1. Check for Modern API Key (prefixed with nk_live_)
    if (apiKey.startsWith("nk_live_")) {
        const keyHash = createHash("sha256").update(apiKey).digest("hex");
        
        const { data, error } = await supabase
            .from("organization_api_keys")
            .select("organization_id")
            .eq("key_hash", keyHash)
            .eq("is_active", true)
            .single();

        if (error || !data) {
            console.log("API Auth: Modern key validation failed or inactive", error?.message);
            return null;
        }
        return data.organization_id;
    }

    // 2. Check for Legacy CRM Integration Key (plain text from api_keys table)
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
