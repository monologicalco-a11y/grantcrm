"use client";

import { motion } from "framer-motion";
import { FormBuilder } from "@/components/settings/form-builder";

export default function FormsSettingsPage() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Web Forms</h1>
                <p className="text-muted-foreground">
                    Create lead capture forms to embed on external websites
                </p>
            </div>

            <FormBuilder />
        </motion.div>
    );
}
