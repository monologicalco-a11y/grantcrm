"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Calendar,
    Phone,
    Mail,
    Settings,
    Zap,
    ChevronLeft,
    ChevronRight,
    Building2,
    BarChart3,
    CheckSquare,
    History as HistoryIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores";
import { useActiveProfile } from "@/hooks/use-data";

interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: string[];
}

const navigation: NavItem[] = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Contacts", href: "/dashboard/contacts", icon: Users },
    { name: "Deals", href: "/dashboard/deals", icon: Briefcase },
    { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { name: "Calls", href: "/dashboard/calls", icon: Phone },
    { name: "Email", href: "/dashboard/email", icon: Mail },
    { name: "Analytics", href: "/dashboard/reports", icon: BarChart3 },
    { name: "Activities", href: "/dashboard/activities", icon: HistoryIcon },
    { name: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
    { name: "Team", href: "/dashboard/team", icon: Users, roles: ["admin", "manager"] },
    { name: "Automations", href: "/dashboard/automations", icon: Zap, roles: ["admin", "manager"] },
];

const bottomNavigation: NavItem[] = [
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
    const { data: profile, isLoading: profileLoading } = useActiveProfile();

    const filteredNavigation = useMemo(() => {
        return navigation.filter(item => {
            if (!item.roles) return true;
            if (profileLoading) return false;
            return profile && item.roles.includes(profile.role);
        });
    }, [profile, profileLoading]);

    const filteredBottomNavigation = useMemo(() => {
        return bottomNavigation.filter(item => {
            if (!item.roles) return true;
            if (profileLoading) return false;
            return profile && item.roles.includes(profile.role);
        });
    }, [profile, profileLoading]);

    return (
        <TooltipProvider delayDuration={0}>
            <motion.aside
                initial={false}
                animate={{ width: sidebarCollapsed ? 72 : 240 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                    "fixed left-0 top-0 z-40 h-screen border-r border-border bg-card flex-col",
                    "hidden lg:flex"
                )}
            >
                {/* Logo */}
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                    <AnimatePresence mode="wait">
                        {!sidebarCollapsed && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-2"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                                    <Building2 className="h-5 w-5 text-primary-foreground" />
                                </div>
                                <span className="text-lg font-semibold">NanoSol</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {sidebarCollapsed && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary mx-auto">
                            <Building2 className="h-5 w-5 text-primary-foreground" />
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 px-3 py-4">
                    <nav className="flex flex-col gap-1">
                        {filteredNavigation.map((item) => {
                            const isActive = pathname === item.href;
                            const NavLink = (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        isActive
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "h-5 w-5 shrink-0",
                                            isActive ? "text-primary" : ""
                                        )}
                                    />
                                    <AnimatePresence>
                                        {!sidebarCollapsed && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: "auto" }}
                                                exit={{ opacity: 0, width: 0 }}
                                                className="whitespace-nowrap"
                                            >
                                                {item.name}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </Link>
                            );

                            if (sidebarCollapsed) {
                                return (
                                    <Tooltip key={item.name}>
                                        <TooltipTrigger asChild>{NavLink}</TooltipTrigger>
                                        <TooltipContent side="right">{item.name}</TooltipContent>
                                    </Tooltip>
                                );
                            }

                            return NavLink;
                        })}
                    </nav>
                </ScrollArea>

                {/* Bottom Navigation */}
                <div className="border-t border-border px-3 py-4">
                    {filteredBottomNavigation.map((item) => {
                        const isActive = pathname === item.href;
                        const NavLink = (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <AnimatePresence>
                                    {!sidebarCollapsed && (
                                        <motion.span
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: "auto" }}
                                            exit={{ opacity: 0, width: 0 }}
                                            className="whitespace-nowrap"
                                        >
                                            {item.name}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </Link>
                        );

                        if (sidebarCollapsed) {
                            return (
                                <Tooltip key={item.name}>
                                    <TooltipTrigger asChild>{NavLink}</TooltipTrigger>
                                    <TooltipContent side="right">{item.name}</TooltipContent>
                                </Tooltip>
                            );
                        }

                        return NavLink;
                    })}

                    {/* Collapse Toggle */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="mt-2 w-full justify-center"
                    >
                        {sidebarCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <>
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                <span>Collapse</span>
                            </>
                        )}
                    </Button>
                </div>
            </motion.aside>
        </TooltipProvider>
    );
}
