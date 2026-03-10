"use client";

import { Search, Bell, Moon, Sun, User, LogOut, Command, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCommandPaletteStore, useUIStore } from "@/lib/stores";
import { toast } from "sonner";

import { useActiveProfile } from "@/hooks/use-data";
import { useDialerStore } from "@/lib/stores";
import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useNotifications } from "@/hooks/use-notifications";

export function Topbar() {
    const router = useRouter();
    const supabase = createClient();
    const { theme, setTheme } = useTheme();

    // Use Real-time Notifications Hook
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

    const { open: openCommandPalette } = useCommandPaletteStore();
    const { openDialer } = useDialerStore();
    const { data: profile } = useActiveProfile();
    const { setMobileSidebarOpen } = useUIStore();

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.push("/login");
            toast.success("Logged out successfully");
        } catch (error) {
            console.error("Logout error:", error);
            toast.error("Failed to log out");
        }
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
            >
                <Menu className="h-5 w-5" />
            </Button>

            {/* Search */}
            <div className="flex-1 max-w-xl">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        className="pl-10 pr-4 md:pr-12 bg-muted/50"
                        onClick={openCommandPalette}
                        readOnly
                    />
                    <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                        <Command className="h-3 w-3" />K
                    </kbd>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Dialer */}
                <Button variant="ghost" size="icon" onClick={openDialer}>
                    <Phone className="h-5 w-5" />
                </Button>

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </div>

            {/* Notifications */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <Badge
                                variant="destructive"
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                            >
                                {unreadCount}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                    <div className="flex items-center justify-between px-4 py-2">
                        <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" className="h-auto px-2 text-[10px]" onClick={markAllAsRead}>
                                Mark all read
                            </Button>
                        )}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="max-h-[300px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                No notifications
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <DropdownMenuItem
                                    key={n.id}
                                    className={`flex flex-col items-start p-4 gap-1 cursor-pointer ${!n.read ? 'bg-muted/50' : ''}`}
                                    onClick={() => {
                                        markAsRead(n.id);
                                        if (n.link_url) router.push(n.link_url);
                                    }}
                                >
                                    <div className="flex w-full justify-between items-center px-1">
                                        <span className={`text-sm ${!n.read ? 'font-semibold' : ''}`}>{n.title}</span>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {n.message}
                                    </p>
                                </DropdownMenuItem>
                            ))
                        )}
                    </div>
                    <DropdownMenuSeparator />
                    <Link href="/dashboard" className="w-full">
                        <DropdownMenuItem className="w-full text-center justify-center text-xs text-primary cursor-pointer">
                            View all notifications
                        </DropdownMenuItem>
                    </Link>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || "User"} />
                            <AvatarFallback className="bg-primary/10 text-primary">{profile?.full_name?.[0] || "U"}</AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none">{profile?.full_name || "User"}</p>
                            <p className="text-xs leading-none text-muted-foreground">
                                {profile?.email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/dashboard/settings">
                        <DropdownMenuItem className="cursor-pointer">
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile Settings</span>
                        </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive cursor-pointer"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
