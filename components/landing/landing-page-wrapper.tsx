"use client";

import dynamic from "next/dynamic";

// Dynamically import the full landing page with SSR disabled
// This prevents the webpack runtime prerender error caused by
// client-heavy dependencies (framer-motion, etc.) during static generation
const LandingPage = dynamic(
    () => import("@/components/landing/landing-page"),
    { ssr: false }
);

export function LandingPageWrapper() {
    return <LandingPage />;
}
