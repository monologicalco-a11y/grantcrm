"use client";

import { motion } from "framer-motion";
import React, { useEffect, useState, ReactNode } from "react";

interface ClientMotionProps {
    children: ReactNode;
    component?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

/**
 * A wrapper component that handles framer-motion animations safely on the client side.
 * It strictly separates SSR rendering (plain DOM) from Client rendering (motion).
 */
export function ClientMotion({
    children,
    component = "div",
    ...props
}: ClientMotionProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Motion-specific props to filter out during SSR
    const motionPropsList = [
        'initial', 'animate', 'exit', 'transition', 'variants',
        'whileHover', 'whileTap', 'whileFocus', 'whileDrag',
        'whileInView', 'viewport', 'onAnimationStart',
        'onAnimationComplete', 'onUpdate', 'onDragStart',
        'onDrag', 'onDragEnd', 'onDirectionLock',
        'onDragTransitionEnd', 'layout', 'layoutId'
    ];

    if (!isMounted) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const domProps: Record<string, unknown> = {};
        Object.keys(props).forEach(key => {
            if (!motionPropsList.includes(key)) {
                domProps[key] = props[key];
            }
        });

        const Tag = component as React.ElementType;
        return <Tag {...domProps}>{children}</Tag>;
    }

    // Client-side: Map to known motion components statically
    switch (component) {
        case "span": return <motion.span {...props}>{children}</motion.span>;
        case "section": return <motion.section {...props}>{children}</motion.section>;
        case "article": return <motion.article {...props}>{children}</motion.article>;
        case "main": return <motion.main {...props}>{children}</motion.main>;
        case "nav": return <motion.nav {...props}>{children}</motion.nav>;
        case "div":
        default: return <motion.div {...props}>{children}</motion.div>;
    }
}
