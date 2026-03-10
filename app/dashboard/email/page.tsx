"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Mail,
    Send,
    Inbox,
    Archive,
    Trash2,
    Star,
    Plus,
    Search,
    MoreHorizontal,
    Paperclip,
    Clock,
    Loader2,
    Edit,
    Zap,
    MailOpen,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useEmailTemplates, useDeleteEmailTemplate, useEmailSequences, useActiveProfile, useDeleteEmailSequence, useUpdateEmailSequence, useSMTPConfigs } from "@/hooks/use-data";
import { useEmails, useEmailBatchAction } from "@/hooks/use-email";
import { useRealtime } from "@/hooks/use-realtime";
import { TemplateDialog } from "@/components/email/template-dialog";
import { EmailComposerDialog } from "@/components/email/email-composer-dialog";
import { SequenceDialog } from "@/components/email/sequence-dialog";
import { SequenceEnrollmentsManager } from "@/components/email/sequence-enrollments-manager";
import { EmailAnalytics } from "@/components/email/email-analytics";
import type { EmailTemplate, EmailSequence, Email } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Play, Pause } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PaginationControls } from "@/components/ui/pagination-controls";


// Note: Email inbox would need IMAP/API integration - templates work with database

// Email folders type
type EmailFolder = "inbox" | "sent" | "starred" | "archive" | "trash" | "sequences" | "templates" | "analytics";

// ... existing interfaces ...

export default function EmailPage() {
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [sequenceOpen, setSequenceOpen] = useState(false);
    const [enrollmentManagerOpen, setEnrollmentManagerOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
    const [activeFolder, setActiveFolder] = useState<EmailFolder>("inbox");
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const [isProcessingSequences, setIsProcessingSequences] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const { data: templates = [], isLoading: templatesLoading, mutate: mutateTemplates } = useEmailTemplates();
    const { data: sequences = [], mutate: mutateSequences } = useEmailSequences();
    const { data: smtpConfigs = [] } = useSMTPConfigs();
    const { trigger: batchAction, isMutating: isBatchMutating } = useEmailBatchAction();

    // Fetch emails
    const { data: emailsData, isLoading: emailsLoading, mutate: mutateEmails } = useEmails(activeFolder, currentPage, itemsPerPage);
    const emails: Email[] = emailsData?.data || [];
    const totalEmails = emailsData?.meta?.total || 0;
    const totalPages = Math.ceil(totalEmails / itemsPerPage);


    const { trigger: deleteTemplate } = useDeleteEmailTemplate();
    const { trigger: deleteSequence } = useDeleteEmailSequence();
    const { trigger: updateSequence } = useUpdateEmailSequence();
    const { data: activeProfile } = useActiveProfile();

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch("/api/email/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ organization_id: activeProfile?.organization_id })
            });
            const result = await res.json();
            if (result.success) {
                toast.success("Sync completed");
                mutateEmails();
            } else {
                toast.error("Sync failed", { description: result.error });
            }
        } catch (error) {
            console.error("Sync error:", error);
            toast.error("Failed to sync emails");
        } finally {
            setIsSyncing(false);
        }
    };

    // Helper to format date
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return "Yesterday";
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const handleNewTemplate = () => {
        setSelectedTemplate(null);
        setTemplateDialogOpen(true);
    };

    const handleEditTemplate = (template: EmailTemplate) => {
        setSelectedTemplate(template);
        setTemplateDialogOpen(true);
    };

    const handleDeleteTemplate = async (id: string) => {
        try {
            await deleteTemplate(id);
            mutateTemplates();
            toast.success("Template deleted");
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error("Failed to delete template");
        }
    };

    const handleDialogClose = (open: boolean) => {
        setTemplateDialogOpen(open);
        if (!open) {
            mutateTemplates();
        }
    };

    const handleEditSequence = (sequence: EmailSequence) => {
        setSelectedSequence(sequence);
        setSequenceOpen(true);
    };

    const handleDeleteSequence = async (id: string) => {
        if (!confirm("Are you sure you want to delete this sequence?")) return;
        try {
            await deleteSequence(id);
            mutateSequences();
            toast.success("Sequence deleted");
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error("Failed to delete sequence");
        }
    };

    const handleToggleSequence = async (sequence: EmailSequence) => {
        try {
            await updateSequence({
                id: sequence.id,
                updates: { is_active: !sequence.is_active }
            });
            mutateSequences();
            toast.success(`Sequence ${!sequence.is_active ? "activated" : "paused"}`);
        } catch (error) {
            console.error("Toggle failed:", error);
            toast.error("Failed to update sequence");
        }
    };

    const handleProcessSequences = async () => {
        setIsProcessingSequences(true);
        try {
            const response = await fetch("/api/sequences/process", { method: "POST" });
            const result = await response.json();

            if (result.success) {
                if (result.processed === 0) {
                    toast.info("No sequences due for processing", {
                        description: result.message
                    });
                } else {
                    toast.success("Sequence processing complete", {
                        description: `Report: ${result.successCount} sent, ${result.failureCount} failed.`,
                        duration: 5000,
                    });
                }
                mutateSequences();
            } else {
                toast.error("Processing failed", {
                    description: result.error || "Unknown error"
                });
            }
        } catch (error) {
            console.error("Process failed:", error);
            toast.error("Failed to process sequences");
        } finally {
            setIsProcessingSequences(false);
        }
    };

    const handleManageEnrollments = (sequence: EmailSequence) => {
        setSelectedSequence(sequence);
        setEnrollmentManagerOpen(true);
    };

    // New Functions for Selection & Batch Actions

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(emails.map(e => e.id));
            setSelectedEmails(allIds);
        } else {
            setSelectedEmails(new Set());
        }
    };

    const handleSelectEmail = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedEmails);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedEmails(newSelected);
    };

    const handleBatchAction = async (action: 'delete' | 'archive' | 'mark_read' | 'mark_unread') => {
        if (selectedEmails.size === 0) return;

        try {
            let destination: string | undefined;

            if (action === 'archive') {
                destination = 'archive';
            } else if (action === 'delete') {
                // If in trash, delete permanently, else move to trash
                if (activeFolder !== 'trash') {
                    destination = 'trash';
                }
            }

            // Map UI actions to API actions
            let apiAction: 'delete' | 'move' | 'mark_read' | 'mark_unread';
            if (action === 'archive' || (action === 'delete' && activeFolder !== 'trash')) {
                apiAction = 'move';
            } else if (action === 'delete' && activeFolder === 'trash') {
                apiAction = 'delete';
            } else {
                apiAction = action;
            }

            await batchAction({
                emailIds: Array.from(selectedEmails),
                action: apiAction,
                destination
            });

            toast.success(`Emails ${action}d`);
            setSelectedEmails(new Set());
            mutateEmails();
        } catch (error) {
            console.error("Batch action failed:", error);
            toast.error("Failed to update emails");
        }
    };

    // Real-time synchronization
    const realtimeKey = useMemo(() => (key: unknown) =>
        typeof key === "string" && (key === "email-sequences" || key.startsWith("sequence-enrollments")),
        []);
    useRealtime("email_sequences", realtimeKey);
    useRealtime("sequence_enrollments", realtimeKey);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Email</h1>
                    <p className="text-muted-foreground">
                        Manage emails and automated sequences
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => setComposerOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Compose
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
                {/* Sidebar */}
                <Card className="lg:col-span-1 border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-4">
                        <Button
                            className="w-full mb-4 shadow-sm"
                            size="lg"
                            onClick={() => setComposerOpen(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Compose
                        </Button>
                        <div className="space-y-1">
                            <Button
                                variant={activeFolder === "inbox" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "inbox" && "font-semibold")}
                                onClick={() => { setActiveFolder("inbox"); setCurrentPage(1); }}
                            >
                                <Inbox className="mr-2 h-4 w-4" />
                                Inbox
                            </Button>
                            <Button
                                variant={activeFolder === "sent" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "sent" && "font-semibold")}
                                onClick={() => { setActiveFolder("sent"); setCurrentPage(1); }}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Sent
                            </Button>
                            <Button
                                variant={activeFolder === "starred" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "starred" && "font-semibold")}
                                onClick={() => { setActiveFolder("starred"); setCurrentPage(1); }}
                            >
                                <Star className="mr-2 h-4 w-4" />
                                Starred
                            </Button>
                            <Button
                                variant={activeFolder === "archive" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "archive" && "font-semibold")}
                                onClick={() => { setActiveFolder("archive"); setCurrentPage(1); }}
                            >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                            </Button>
                            <Button
                                variant={activeFolder === "trash" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "trash" && "font-semibold")}
                                onClick={() => { setActiveFolder("trash"); setCurrentPage(1); }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Trash
                            </Button>
                        </div>

                        <Separator className="my-4" />

                        <h3 className="mb-2 px-2 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                            Automation
                        </h3>
                        <div className="space-y-1">
                            <Button
                                variant={activeFolder === "analytics" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "analytics" && "font-semibold")}
                                onClick={() => setActiveFolder("analytics")}
                            >
                                <Activity className="mr-2 h-4 w-4" />
                                Analytics
                            </Button>
                            <Button
                                variant={activeFolder === "sequences" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "sequences" && "font-semibold")}
                                onClick={() => setActiveFolder("sequences")}
                            >
                                <Zap className="mr-2 h-4 w-4" />
                                Sequences
                            </Button>
                            <Button
                                variant={activeFolder === "templates" ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", activeFolder === "templates" && "font-semibold")}
                                onClick={() => setActiveFolder("templates")}
                            >
                                <Mail className="mr-2 h-4 w-4" />
                                Templates
                            </Button>
                        </div>

                        <Separator className="my-4" />
                        <h3 className="mb-2 px-2 text-xs font-semibold tracking-tight text-muted-foreground uppercase">
                            Accounts
                        </h3>
                        <div className="space-y-1">
                            {smtpConfigs?.map(account => (
                                <div key={account.id} className="flex items-center px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 rounded-md cursor-pointer transition-colors">
                                    <div className={cn("h-2 w-2 rounded-full mr-2", account.is_active ? "bg-green-500" : "bg-red-500")} />
                                    <span className="truncate">{account.email_addr}</span>
                                </div>
                            ))}
                            {smtpConfigs?.length === 0 && (
                                <p className="text-xs text-muted-foreground px-2">No accounts configured</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    <Tabs defaultValue="inbox" value={['sequences', 'templates', 'analytics'].includes(activeFolder) ? activeFolder : 'inbox'}>
                        <TabsList className="hidden">
                            <TabsTrigger value="inbox">Inbox</TabsTrigger>
                            <TabsTrigger value="sequences">Sequences</TabsTrigger>
                            <TabsTrigger value="templates">Templates</TabsTrigger>
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        </TabsList>

                        {/* We reuse 'inbox' tab for all email lists */}
                        <TabsContent value="inbox" className="mt-0">
                            <Card className="border-border/50 shadow-sm">
                                <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={emails.length > 0 && selectedEmails.size === emails.length}
                                            onCheckedChange={handleSelectAll}
                                        />

                                        {selectedEmails.size > 0 ? (
                                            <div className="flex items-center gap-2 ml-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                                <Button variant="ghost" size="sm" onClick={() => handleBatchAction('archive')} disabled={isBatchMutating}>
                                                    <Archive className="h-4 w-4 mr-2" />
                                                    Archive
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleBatchAction('delete')} disabled={isBatchMutating} className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuItem onClick={() => handleBatchAction('mark_read')}>
                                                            <MailOpen className="h-4 w-4 mr-2" />
                                                            Mark as read
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleBatchAction('mark_unread')}>
                                                            <Mail className="h-4 w-4 mr-2" />
                                                            Mark as unread
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <span className="text-sm text-muted-foreground ml-2 border-l pl-3">
                                                    {selectedEmails.size} selected
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="relative ml-4">
                                                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    placeholder={`Search ${activeFolder}...`}
                                                    className="pl-9 h-9 w-[250px] bg-muted/30 border-none focus-visible:ring-1"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSync}
                                            disabled={isSyncing}
                                            className="h-8 w-8 p-0"
                                        >
                                            <motion.div
                                                animate={isSyncing ? { rotate: 360 } : {}}
                                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                            >
                                                <Zap className={cn("h-4 w-4", isSyncing && "text-primary fill-primary")} />
                                            </motion.div>
                                            <span className="sr-only">Sync</span>
                                        </Button>
                                        <PaginationControls
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                            totalItems={totalEmails}
                                            itemsPerPage={itemsPerPage}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 min-h-[500px] relative">
                                    {emailsLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        </div>
                                    ) : null}

                                    {!emailsLoading && emails.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                                            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                                                <Inbox className="h-8 w-8 opacity-50" />
                                            </div>
                                            <p className="text-lg font-medium">No emails found</p>
                                            <p className="text-sm">Your {activeFolder} is empty.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            {emails.map((email) => (
                                                <div
                                                    key={email.id}
                                                    className={cn(
                                                        "group flex items-center gap-4 p-4 border-b hover:bg-muted/30 transition-colors relative",
                                                        !email.is_read && "bg-muted/20 font-medium",
                                                        selectedEmails.has(email.id) && "bg-accent/40"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={selectedEmails.has(email.id)}
                                                        onCheckedChange={(checked) => handleSelectEmail(email.id, checked as boolean)}
                                                        className="mr-2"
                                                    />

                                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { /* Open email detail */ }}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className={cn("text-sm truncate max-w-[180px]", !email.is_read ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                                                    {email.from_name || email.from_addr}
                                                                </span>
                                                                {email.has_attachment && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                                                {formatTime(email.received_at)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className={cn("text-sm truncate max-w-[400px]", !email.is_read && "font-medium")}>
                                                                {email.subject || '(No Subject)'}
                                                                <span className="text-muted-foreground font-normal mx-2">-</span>
                                                                <span className="text-muted-foreground font-normal">
                                                                    {(email.body_text || "").substring(0, 60)}...
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 bg-background/80 backdrop-blur-sm p-1 rounded-md shadow-sm border">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBatchAction("archive")}>
                                                            <Archive className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleBatchAction("delete")}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Sequences & Templates Content (Keep existing if needed, or move to separate page) */}
                        <TabsContent value="sequences">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Email Sequences</CardTitle>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleProcessSequences}
                                                disabled={isProcessingSequences}
                                            >
                                                {isProcessingSequences ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Play className="h-4 w-4 mr-2" />
                                                )}
                                                Process Due
                                            </Button>
                                            <Button size="sm" onClick={() => {
                                                setSelectedSequence(null);
                                                setSequenceOpen(true);
                                            }}>
                                                <Plus className="h-4 w-4 mr-2" />
                                                New Sequence
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                        {sequences.map((sequence) => (
                                            <Card
                                                key={sequence.id}
                                                className="relative group overflow-hidden border-muted/60 hover:border-primary/50 hover:shadow-md transition-all duration-300"
                                            >
                                                <div className={cn(
                                                    "absolute top-0 left-0 w-1 h-full transition-colors",
                                                    sequence.is_active ? "bg-green-500" : "bg-muted"
                                                )} />

                                                <CardHeader className="pb-2">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                                <Zap className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <CardTitle className="text-lg leading-none mb-1">{sequence.name}</CardTitle>
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {sequence.steps?.length || 0} steps • {sequence.enrolled_count || 0} enrolled
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Badge
                                                            variant={sequence.is_active ? "default" : "secondary"}
                                                            className={cn(
                                                                "capitalize text-[10px] px-2 py-0",
                                                                sequence.is_active ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20" : ""
                                                            )}
                                                        >
                                                            {sequence.is_active ? "active" : "paused"}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>

                                                <CardContent>
                                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                                        <div className="p-3 rounded-lg bg-muted/40 border border-muted/40">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Open Rate</p>
                                                            <div className="flex items-end gap-2">
                                                                <span className="text-xl font-bold">{sequence.open_rate || 0}%</span>
                                                                <div className="flex-1 mb-1.5">
                                                                    <Progress value={sequence.open_rate || 0} className="h-1" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 rounded-lg bg-muted/40 border border-muted/40">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Reply Rate</p>
                                                            <div className="flex items-end gap-2">
                                                                <span className="text-xl font-bold">0%</span>
                                                                <div className="flex-1 mb-1.5 opacity-30">
                                                                    <Progress value={0} className="h-1 bg-muted [&>div]:bg-green-500" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 px-2 text-xs"
                                                                onClick={() => handleManageEnrollments(sequence)}
                                                            >
                                                                Enrollments
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                onClick={() => handleEditSequence(sequence)}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className={cn(
                                                                    "h-8 px-2 text-xs",
                                                                    sequence.is_active ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"
                                                                )}
                                                                onClick={() => handleToggleSequence(sequence)}
                                                            >
                                                                {sequence.is_active ? (
                                                                    <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</>
                                                                ) : (
                                                                    <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>
                                                                )}
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteSequence(sequence.id)}>
                                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                                        Delete Sequence
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="templates">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Email Templates</CardTitle>
                                        <Button size="sm" onClick={handleNewTemplate}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            New Template
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {templatesLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : templates.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p>No templates yet</p>
                                            <p className="text-sm">Create your first email template</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            {templates.map((template) => (
                                                <div
                                                    key={template.id}
                                                    className="p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                                                <Mail className="h-5 w-5 text-muted-foreground" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium">{template.name}</p>
                                                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                                    {template.subject}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleEditTemplate(template)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive"
                                                                onClick={() => handleDeleteTemplate(template.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="analytics">
                            <EmailAnalytics />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <TemplateDialog
                open={templateDialogOpen}
                onOpenChange={handleDialogClose}
                template={selectedTemplate}
                organizationId={activeProfile?.organization_id || ""}
            />

            <EmailComposerDialog
                open={composerOpen}
                onOpenChange={setComposerOpen}
                organizationId={activeProfile?.organization_id || ""}
            />

            <SequenceDialog
                open={sequenceOpen}
                onOpenChange={setSequenceOpen}
                sequence={selectedSequence}
                organizationId={activeProfile?.organization_id || ""}
                onSuccess={() => mutateSequences()}
            />

            <SequenceEnrollmentsManager
                open={enrollmentManagerOpen}
                onOpenChange={setEnrollmentManagerOpen}
                sequenceId={selectedSequence?.id || ""}
                sequenceName={selectedSequence?.name || ""}
                organizationId={selectedSequence?.organization_id || ""}
            />
        </motion.div>
    );
}
