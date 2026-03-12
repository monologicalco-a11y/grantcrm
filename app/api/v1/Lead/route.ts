import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/v1/Lead
 * Creates a new lead (contact) from external platform
 */
export async function POST(request: Request) {
    try {
        const apiKey = request.headers.get("X-Api-Key");
        const orgId = await validateApiKey(apiKey);

        if (!orgId) {
            return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
        }

        const body = await request.json();
        const { firstName, lastName, emailAddress, phoneNumber } = body;

        if (!firstName || !emailAddress) {
            return NextResponse.json({ error: "Missing required fields: firstName and emailAddress are required" }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const contactData = {
            organization_id: orgId,
            first_name: firstName,
            last_name: lastName || "",
            email: emailAddress,
            phone: phoneNumber || "",
            source: "API Integration",
            tags: ["External API"],
        };

        const { data: contact, error: insertError } = await supabase
            .from("contacts")
            .insert(contactData)
            .select()
            .single();

        if (insertError) {
            console.error("API Lead Insert Error:", insertError);
            return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
        }

        // Trigger Automation
        try {
            const { evaluateTriggers } = require("@/lib/automations/engine");
            await evaluateTriggers("lead_created", orgId, {
                contactId: contact.id,
                ...body
            });
        } catch (autoError) {
            console.error("Automation Trigger Error:", autoError);
        }

        return NextResponse.json({ success: true, id: contact.id }, { status: 201 });

    } catch (error: any) {
        console.error("POST /api/v1/Lead Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * GET /api/v1/Lead
 * Pulls leads based on date filters (EspoCRM style)
 */
export async function GET(request: Request) {
    try {
        const apiKey = request.headers.get("X-Api-Key");
        const orgId = await validateApiKey(apiKey);

        if (!orgId) {
            return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const supabase = createClient(supabaseUrl, supabaseKey);

        let query = supabase
            .from("contacts")
            .select("id, first_name, last_name, email, phone, created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false });

        // Parse EspoCRM-style "where" filters
        // Example: where[0][type]=after&where[0][field]=createdAt&where[0][value]=2023-12-5T00:00:00
        const searchParamsObj = Object.fromEntries(searchParams.entries());
        
        let i = 0;
        while (searchParams.has(`where[${i}][type]`)) {
            const type = searchParams.get(`where[${i}][type]`);
            const field = searchParams.get(`where[${i}][field]`);
            const value = searchParams.get(`where[${i}][value]`);

            if (field === "createdAt") {
                const dbField = "created_at";
                if (type === "after") {
                    query = query.gte(dbField, value);
                } else if (type === "before") {
                    query = query.lte(dbField, value);
                }
            }
            i++;
        }

        const { data: contacts, error: fetchError } = await query;

        if (fetchError) {
            return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
        }

        // Map fields back to Espo style
        const espoContacts = contacts.map(c => ({
            id: c.id,
            firstName: c.first_name,
            lastName: c.last_name,
            emailAddress: c.email,
            phoneNumber: c.phone,
            createdAt: c.created_at
        }));

        return NextResponse.json({
            total: espoContacts.length,
            list: espoContacts
        }, { status: 200 });

    } catch (error: any) {
        console.error("GET /api/v1/Lead Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
