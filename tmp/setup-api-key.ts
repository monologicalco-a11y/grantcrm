import { createClient } from "@supabase/supabase-js";

// Manually provided from .env.local for this bypass/setup script
const supabaseUrl = "https://xqsewdcggvujkmddtltd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2V3ZGNnZ3Z1amttZGR0bHRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgzMTI0NCwiZXhwIjoyMDg0NDA3MjQ0fQ.1TUSdHKCEWxlA6JIcqrmGDkxzZuXoK09VC-P4ByQrYM";

async function setup() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Setting up API Key for External Integration...");

    // 1. Get first organization
    const { data: orgs, error: orgError } = await supabase
        .from("organizations")
        .select("id, name")
        .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
        console.error("No organizations found:", orgError);
        return;
    }

    const org = orgs[0];
    const testKey = "dee00fc5935f79594c3dc11188d14ba9"; // Using the key from the user's example

    console.log(`Found organization: ${org.name} (${org.id})`);

    // 2. Check for existing api_keys record
    const { data: existing } = await supabase
        .from("api_keys")
        .select("id")
        .eq("organization_id", org.id)
        .single();

    if (existing) {
        console.log("Updating existing API key record...");
        const { error: updateError } = await supabase
            .from("api_keys")
            .update({ crm_api_key: testKey })
            .eq("organization_id", org.id);
        
        if (updateError) console.error("Update failed:", updateError);
        else console.log("Successfully updated API key!");
    } else {
        console.log("Creating new API key record...");
        const { error: insertError } = await supabase
            .from("api_keys")
            .insert({
                organization_id: org.id,
                crm_api_key: testKey,
                active_provider: 'gemini'
            });
        
        if (insertError) console.error("Insert failed:", insertError);
        else console.log("Successfully created API key!");
    }

    console.log("\nSetup complete.");
    console.log("Test API Key:", testKey);
}

setup();
