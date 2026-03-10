"use client";

import dynamic from "next/dynamic";
import React, { ReactNode } from "react";

// Dynamically import ClientMotion to ensure it never runs on the server
// This fixes the "Cannot read properties of undefined (reading 'call')" Webpack error in Next 15
const DynamicClientMotionInner = dynamic(
    () => import("./client-motion").then((mod) => mod.ClientMotion),
    { ssr: false }
);

interface ClientMotionProps {
    children: ReactNode;
    component?: string;
    [key: string]: any;
}

export function ClientMotionSSR({ children, className }: { children: ReactNode, className?: string, [key: string]: any }) {
    return <div className={className}>{children}</div>;
}
