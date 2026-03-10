import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Admin Client for Public API (Bypasses RLS)
const supabaseUrl = "https://xqsewdcggvujkmddtltd.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);


// Helper to validate origin/cors (placeholder for now)
// Helper to validate origin/cors (placeholder for now)
// function validateOrigin(request: Request) {
//    const origin = request.headers.get("origin") || "";
//    // In future, check DB config for allowed_origins
//    return true;
// }

export async function POST(request: Request) {
    try {
        // const supabase = createClient(); // REMOVED standard client

        // 1. Validate Form ID (Header or Body)
        const headersObj = Object.fromEntries(
            Array.from(request.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])
        );
        let formId = headersObj["x-form-id"];
        const contentType = headersObj["content-type"];

        console.log("DEBUG: formId from headers:", formId);
        console.log("DEBUG: contentType:", contentType);

        let body: Record<string, any> = {}; // Initialize body here for later use

        if (!formId) {
            // Check body for x-form-id (standard HTML forms)
            if (contentType?.includes("application/x-www-form-urlencoded") || contentType?.includes("multipart/form-data")) {
                const formData = await request.formData();
                formId = formData.get("x-form-id") as string;
                body = Object.fromEntries(formData.entries()); // Populate body from formData
                console.log("DEBUG: formId from formData:", formId);
            } else if (contentType?.includes("application/json")) {
                // Clone request to read body multiple times if needed
                body = await request.clone().json();
                formId = body["x-form-id"];
                console.log("DEBUG: formId from JSON body:", formId);
            }
        } else {
            // If formId was found in headers, still parse body if needed for other fields
            if (contentType?.includes("application/json")) {
                body = await request.json();
            } else if (contentType?.includes("application/x-www-form-urlencoded") || contentType?.includes("multipart/form-data")) {
                const formData = await request.formData();
                body = Object.fromEntries(formData.entries());
            }
        }


        if (!formId) {
            console.log("DEBUG: Returning 400 - missing formId");
            return NextResponse.json({ error: "Missing Form ID" }, { status: 400 });
        }

        // 2. Fetch Form Configuration
        const { data: form, error: formError } = await supabase
            .from("web_forms")
            .select("*")
            .eq("id", formId)
            .eq("status", "active")
            .single();

        if (formError || !form) {
            return NextResponse.json(
                { error: "Invalid form ID or form is inactive" },
                { status: 404 }
            );
        }

        // 6. Map Fields
        const fieldMapping = form.config as Record<string, string>;
        const contactData: Record<string, any> = {
            organization_id: form.organization_id,
            tags: ["Web Lead", form.name],
            custom_fields: {
                source: form.source || "Web Form",
                status: "New"
            }
        };

        const basicFields = ["first_name", "last_name", "email", "phone", "company", "job_title"];

        // Explicit mapping
        Object.entries(fieldMapping).forEach(([formField, dbField]) => {
            if (body[formField]) {
                contactData[dbField] = body[formField];
            }
        });

        // Fallback: If no mapping, try direct match
        if (Object.keys(fieldMapping).length === 0) {
            basicFields.forEach(field => {
                const val = body[field] || body[field.replace('_', '')] || body[field.replace('_', ' ')];
                if (val) contactData[field] = val;
            });
        }

        // 7. Insert Contact
        const { data: contact, error: insertError } = await supabase
            .from("contacts")
            .insert(contactData)
            .select()
            .single();

        if (insertError) {
            console.error("Web Lead Insert Error:", insertError);
            return NextResponse.json(
                { error: `Failed to process lead: ${insertError.message}` },
                { status: 500 }
            );
        }

        // 8. Create Notification for Admins
        const { data: admins } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("organization_id", form.organization_id)
            .in("role", ["admin", "manager"]);

        if (admins) {
            const notifs = admins.map(a => ({
                organization_id: form.organization_id,
                user_id: a.user_id,
                title: "New Web Lead",
                message: `${contact.first_name} ${contact.last_name || ""} from ${form.name}`,
                type: "lead",
                link: `/dashboard/contacts/${contact.id}`
            }));
            await supabase.from("notifications").insert(notifs);
        }

        // 9. Trigger Automation
        try {
            const { evaluateTriggers } = require("@/lib/automations/engine");
            await evaluateTriggers("lead_created", form.organization_id, {
                contactId: contact.id,
                formId: form.id,
                ...body
            });
        } catch (autoError) {
            console.error("Failed to trigger automation:", autoError);
        }

        // 10. Response / Redirect
        if (form.redirect_url) {
            return NextResponse.redirect(new URL(form.redirect_url), 302);
        }

        return NextResponse.json({ success: true, id: contact.id }, { status: 200 });

    } catch (error: unknown) {
        console.error("Web Lead API Error:", error);
        const err = error as any;
        return NextResponse.json(
            {
                error: (err?.message || "Internal Server Error"),
                stack: err?.stack,
                details: JSON.stringify(err, Object.getOwnPropertyNames(err))
            },
            { status: 500 }
        );
    }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Or specific domains
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Form-ID",
        },
    });
}
