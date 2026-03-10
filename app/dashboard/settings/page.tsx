"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    User,
    Building2,
    Palette,
    Shield,
    Bell,
    Database,
    Key,
    Code,
    Globe,
    Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useActiveProfile, useUpdateProfile, useOrganization, useUpdateOrganization, useApiKeys, useUpdateApiKeys, useIntegrations, useSyncCalendar } from "@/hooks/use-data";
import { EmailAccountManager } from "@/components/settings/email-account-manager";
import { SipAccountManager } from "@/components/settings/sip-account-manager";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useRef, useState, Suspense } from "react";
import type { Profile, Organization, APIKeys, AIProvider } from "@/types";

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const { data: profile, isLoading: profileLoading } = useActiveProfile();
    const { data: org } = useOrganization(profile?.organization_id || null);
    const { data: apiKeys } = useApiKeys(profile?.organization_id || null);
    const { trigger: updateProfile, isMutating: isUpdatingProfile } = useUpdateProfile();
    const { trigger: updateOrg, isMutating: isUpdatingOrg } = useUpdateOrganization();
    const { trigger: updateApiKeys, isMutating: isUpdatingApiKeys } = useUpdateApiKeys();
    const { data: integrations } = useIntegrations(profile?.id || null);
    const { trigger: syncCalendar, isMutating: isSyncing } = useSyncCalendar();

    const router = useRouter();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab") || "profile";
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams, activeTab]);

    const isAdmin = profile?.role === "admin" || profile?.role === "manager";

    // Profile Form
    const profileForm = useForm({
        defaultValues: {
            full_name: profile?.full_name || "",
            phone: profile?.phone || "",
        }
    });

    // Organization Form
    const orgForm = useForm({
        defaultValues: {
            name: org?.name || "",
            slug: org?.slug || "",
            primary_color: org?.primary_color || "#3b82f6",
            logo_url: org?.logo_url || "",
        }
    });




    // API Keys Form
    const apiKeysForm = useForm({
        defaultValues: {
            openai_key: "",
            gemini_key: "",
            qwen_key: "",
            kimi_key: "",
            active_provider: (apiKeys?.active_provider || "openai") as AIProvider,
        }
    });

    const colorPreviewRef = useRef<HTMLDivElement>(null);
    const watchedPrimaryColor = useWatch({
        control: orgForm.control,
        name: "primary_color",
    });

    useEffect(() => {
        if (colorPreviewRef.current) {
            colorPreviewRef.current.style.backgroundColor = watchedPrimaryColor || "#3b82f6";
        }
    }, [watchedPrimaryColor]);

    // Refs to track previous data state to prevent infinite loops
    // Refs to track if forms have been initialized with data
    const profileInitialized = useRef(false);
    const orgInitialized = useRef(false);
    const apiKeysInitialized = useRef(false);

    // Init forms when data first loads
    useEffect(() => {
        if (profile && !profileInitialized.current) {
            profileForm.reset({ full_name: profile.full_name, phone: profile.phone });
            profileInitialized.current = true;
        }
    }, [profile, profileForm]);

    useEffect(() => {
        if (org && !orgInitialized.current) {
            orgForm.reset({ name: org.name, slug: org.slug, primary_color: org.primary_color, logo_url: org.logo_url });
            orgInitialized.current = true;
        }
    }, [org, orgForm]);



    useEffect(() => {
        if (apiKeys && !apiKeysInitialized.current) {
            apiKeysForm.reset({
                active_provider: apiKeys.active_provider || "openai",
                openai_key: "",
                gemini_key: "",
                qwen_key: "",
                kimi_key: "",
            });
            apiKeysInitialized.current = true;
        }
    }, [apiKeys, apiKeysForm]);


    // We do NOT block rendering on loading, because it unmounts the component and resets refs.
    if (profileLoading) {
        return (
            <div className="flex h-[400px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
                <p className="text-muted-foreground">Profile not found. Please log in again.</p>
                <Button onClick={() => router.push("/login")}>Go to Login</Button>
            </div>
        );
    }

    const onProfileSubmit = async (data: Partial<Profile>) => {
        try {
            await updateProfile({ id: profile.id, updates: data });
            toast.success("Profile updated successfully");
        } catch {
            toast.error("Failed to update profile");
        }
    };

    const onOrgSubmit = async (data: Partial<Organization>) => {
        try {
            await updateOrg({ id: org?.id || "", updates: data });
            toast.success("Organization updated successfully");
        } catch {
            toast.error("Failed to update organization");
        }
    };



    const onApiKeysSubmit = async (data: { openai_key: string; gemini_key: string; qwen_key: string; kimi_key: string; active_provider: AIProvider }) => {
        try {
            const updates: Partial<APIKeys> = {
                active_provider: data.active_provider,
            };
            // Only include keys that were entered (non-empty)
            if (data.openai_key) updates.openai_key_encrypted = data.openai_key;
            if (data.gemini_key) updates.gemini_key_encrypted = data.gemini_key;
            if (data.qwen_key) updates.qwen_key_encrypted = data.qwen_key;
            if (data.kimi_key) updates.kimi_key_encrypted = data.kimi_key;

            await updateApiKeys({ orgId: profile.organization_id, updates });
            toast.success("API keys saved successfully");
            apiKeysForm.reset({ openai_key: "", gemini_key: "", qwen_key: "", kimi_key: "", active_provider: data.active_provider });
        } catch {
            toast.error("Failed to save API keys");
        }
    };


    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account and organization settings
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 mb-8">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    {isAdmin && <TabsTrigger value="organization">Organization</TabsTrigger>}
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                    {isAdmin && <TabsTrigger value="developer">Developer</TabsTrigger>}
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                {/* Profile Settings */}
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Profile Settings
                            </CardTitle>
                            <CardDescription>
                                Manage your personal information and preferences
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="full_name">Full Name</Label>
                                        <Input id="full_name" {...profileForm.register("full_name")} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" value={profile.email} disabled />
                                        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" type="tel" {...profileForm.register("phone")} />
                                    </div>
                                </div>
                                <Button type="submit" disabled={isUpdatingProfile}>
                                    {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Organization Settings - Admin Only */}
                {isAdmin && (
                    <TabsContent value="organization">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    Organization Settings
                                </CardTitle>
                                <CardDescription>
                                    Configure your organization&apos;s branding and preferences
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <form onSubmit={orgForm.handleSubmit(onOrgSubmit)} className="space-y-6">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Organization Name</Label>
                                            <Input id="name" {...orgForm.register("name")} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="slug">Subdomain</Label>
                                            <div className="flex">
                                                <Input id="slug" {...orgForm.register("slug")} className="rounded-r-none" />
                                                <span className="flex items-center px-3 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                                                    .nanosol.app
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div>
                                        <h4 className="font-medium mb-4 flex items-center gap-2">
                                            <Palette className="h-4 w-4" />
                                            Branding
                                        </h4>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="primary_color">Primary Color</Label>
                                                <div className="flex gap-2">
                                                    <Input id="primary_color" {...orgForm.register("primary_color")} />
                                                    <div
                                                        ref={colorPreviewRef}
                                                        className="w-10 h-10 rounded-md border"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="logo_url">Logo URL</Label>
                                                <Input id="logo_url" {...orgForm.register("logo_url")} placeholder="https://..." />
                                            </div>
                                        </div>
                                    </div>

                                    <Button type="submit" disabled={isUpdatingOrg}>
                                        {isUpdatingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Organization
                                    </Button>
                                </form>

                                <Separator />

                                <div className="space-y-4">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <Database className="h-4 w-4" />
                                        Data Architecture
                                    </h4>
                                    <div className="rounded-lg border p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-medium">Sales Pipelines</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Manage your sales stages and create multiple custom pipelines.
                                                </p>
                                            </div>
                                            <Button asChild variant="outline">
                                                <Link href="/dashboard/settings/pipelines">
                                                    Manage Pipelines
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
                {/* Developer - Admin Only */}
                {isAdmin && (
                    <TabsContent value="developer">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Code className="h-5 w-5" />
                                    Developer Settings
                                </CardTitle>
                                <CardDescription>
                                    Manage API keys and developer access
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-medium">Public API Access</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Generate API keys for external integrations and custom apps.
                                            </p>
                                        </div>
                                        <Button asChild>
                                            <Link href="/dashboard/settings/developer">
                                                Manage Keys
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Integrations */}
                <TabsContent value="integrations">
                    <div className="space-y-6">
                        {/* Web Forms Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Globe className="h-5 w-5" />
                                    Web Forms
                                </CardTitle>
                                <CardDescription>
                                    Create and manage web-to-lead forms for your website
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-medium">Lead Capture Forms</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Create HTML forms to collect leads directly into your CRM.
                                            </p>
                                        </div>
                                        <Button asChild variant="outline">
                                            <Link href="/dashboard/settings/forms">
                                                Manage Forms
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Calendar Sync Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5" />
                                    Calendar Sync
                                </CardTitle>
                                <CardDescription>
                                    Connect your external calendars to sync meetings and events
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-6">
                                    {/* Google Calendar */}
                                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-blue-500/10 rounded-full">
                                                <Globe className="h-6 w-6 text-blue-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">Google Calendar</h4>
                                                <p className="text-xs text-muted-foreground">Sync events, meetings and busy times</p>
                                                {integrations?.find(i => i.provider === 'google') && (
                                                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Connected
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {integrations?.find(i => i.provider === 'google') ? (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={isSyncing}
                                                    onClick={async () => {
                                                        try {
                                                            await syncCalendar({ provider: 'google' });
                                                            toast.success("Calendar synced successfully!");
                                                        } catch (err) {
                                                            toast.error(err instanceof Error ? err.message : "Sync failed");
                                                        }
                                                    }}
                                                >
                                                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                                    Sync Now
                                                </Button>
                                            ) : (
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href="/api/integrations/google/auth">Connect</a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Outlook Calendar */}
                                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-orange-500/10 rounded-full">
                                                <Globe className="h-6 w-6 text-orange-500" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">Outlook / Microsoft 365</h4>
                                                <p className="text-xs text-muted-foreground">Sync your Outlook calendar events</p>
                                                {integrations?.find(i => i.provider === 'outlook') && (
                                                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Connected
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {integrations?.find(i => i.provider === 'outlook') ? (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={isSyncing}
                                                    onClick={async () => {
                                                        try {
                                                            await syncCalendar({ provider: 'outlook' });
                                                            toast.success("Calendar synced successfully!");
                                                        } catch (err) {
                                                            toast.error(err instanceof Error ? err.message : "Sync failed");
                                                        }
                                                    }}
                                                >
                                                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                                    Sync Now
                                                </Button>
                                            ) : (
                                                <Button variant="outline" size="sm" asChild>
                                                    <a href="/api/integrations/outlook/auth">Connect</a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* SIP Multi-Account Manager */}
                        {profile && (
                            <SipAccountManager userId={profile.id} orgId={profile.organization_id} />
                        )}

                        {isAdmin && (
                            <>
                                <EmailAccountManager orgId={profile.organization_id} />

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Key className="h-5 w-5" />
                                            AI Configuration
                                        </CardTitle>
                                        <CardDescription>
                                            Manage your API keys for AI-powered features. Keys are securely stored.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <form onSubmit={apiKeysForm.handleSubmit(onApiKeysSubmit)} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="active_provider">Active AI Provider</Label>
                                                <select
                                                    id="active_provider"
                                                    {...apiKeysForm.register("active_provider")}
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <option value="openai">OpenAI (GPT-4)</option>
                                                    <option value="gemini">Google Gemini</option>
                                                    <option value="qwen">Alibaba QWEN</option>
                                                    <option value="kimi">Moonshot KIMI</option>
                                                </select>
                                            </div>
                                            <Separator />
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="openai_key">OpenAI API Key</Label>
                                                    <Input id="openai_key" type="password" {...apiKeysForm.register("openai_key")} placeholder="sk-..." />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="gemini_key">Gemini API Key</Label>
                                                    <Input id="gemini_key" type="password" {...apiKeysForm.register("gemini_key")} placeholder="AIza..." />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="qwen_key">QWEN API Key</Label>
                                                    <Input id="qwen_key" type="password" {...apiKeysForm.register("qwen_key")} placeholder="qwen-..." />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="kimi_key">KIMI API Key</Label>
                                                    <Input id="kimi_key" type="password" {...apiKeysForm.register("kimi_key")} placeholder="kimi-..." />
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Only enter keys you wish to update. Leave fields empty to keep existing keys.
                                            </p>
                                            <Button type="submit" disabled={isUpdatingApiKeys}>
                                                {isUpdatingApiKeys && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Save AI Keys
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>

                            </>
                        )}
                    </div>
                </TabsContent>

                {/* Notifications */}
                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notification Preferences
                            </CardTitle>
                            <CardDescription>
                                Choose what notifications you want to receive
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Email Notifications</p>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email updates for important events
                                        </p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">New Lead Alerts</p>
                                        <p className="text-sm text-muted-foreground">
                                            Get notified when new leads are created
                                        </p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Deal Updates</p>
                                        <p className="text-sm text-muted-foreground">
                                            Notifications for deal stage changes
                                        </p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Task Reminders</p>
                                        <p className="text-sm text-muted-foreground">
                                            Reminders for upcoming and overdue tasks
                                        </p>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Missed Call Alerts</p>
                                        <p className="text-sm text-muted-foreground">
                                            Get notified about missed incoming calls
                                        </p>
                                    </div>
                                    <Switch />
                                </div>
                            </div>
                            <Button onClick={() => toast.success("Notification preferences saved")}>
                                Save Preferences
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security */}
                <TabsContent value="security">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    Security Settings
                                </CardTitle>
                                <CardDescription>
                                    Manage your account security
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPass">Current Password</Label>
                                        <Input id="currentPass" type="password" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="newPass">New Password</Label>
                                        <Input id="newPass" type="password" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPass">Confirm New Password</Label>
                                        <Input id="confirmPass" type="password" />
                                    </div>
                                </div>
                                <Button onClick={() => toast.success("Password update feature coming soon")}>
                                    Update Password
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="h-5 w-5" />
                                    Data Management
                                </CardTitle>
                                <CardDescription>
                                    Export or delete your data
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-lg border">
                                    <div>
                                        <p className="font-medium">Export All Data</p>
                                        <p className="text-sm text-muted-foreground">
                                            Download all your CRM data as JSON/CSV
                                        </p>
                                    </div>
                                    <Button variant="outline">Export</Button>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50">
                                    <div>
                                        <p className="font-medium text-destructive">Delete Account</p>
                                        <p className="text-sm text-muted-foreground">
                                            Permanently delete your account and all data
                                        </p>
                                    </div>
                                    <Button variant="destructive">Delete</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
