import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xqsewdcggvujkmddtltd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2V3ZGNnZ3Z1amttZGR0bHRkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODgzMTI0NCwiZXhwIjoyMDg0NDA3MjQ0fQ.1TUSdHKCEWxlA6JIcqrmGDkxzZuXoK09VC-P4ByQrYM";

async function verify() {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Verifying API Key in Database...");

    const { data: keys, error } = await supabase
        .from("api_keys")
        .select("organization_id, crm_api_key");

    if (error) {
        console.error("Error fetching keys:", error);
        return;
    }

    console.log("API Keys found:", JSON.stringify(keys, null, 2));
}

verify();
