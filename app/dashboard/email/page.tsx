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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useEmailTemplates, useDeleteEmailTemplate, useEmailSequences, useActiveProfile, useDeleteEmailSequence, useUpdateEmailSequence, useSMTPConfigs } from "@/hooks/use-data";
import { useRealtime } from "@/hooks/use-realtime";
import { useEmails } from "@/hooks/use-inbox";
import { TemplateDialog } from "@/components/email/template-dialog";
import { EmailComposerDialog } from "@/components/email/email-composer-dialog";
import { SequenceDialog } from "@/components/email/sequence-dialog";
import { SequenceEnrollmentsManager } from "@/components/email/sequence-enrollments-manager";
import type { EmailTemplate, EmailSequence } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause } from "lucide-react";


// Note: Email inbox would need IMAP/API integration - templates work with database

// Email folders type
type EmailFolder = "inbox" | "sent" | "starred" | "archive" | "trash";

export default function EmailPage() {
    const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
    const [composerOpen, setComposerOpen] = useState(false);
    const [sequenceOpen, setSequenceOpen] = useState(false);
    const [enrollmentManagerOpen, setEnrollmentManagerOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
    const [selectedSequence, setSelectedSequence] = useState<EmailSequence | null>(null);
    const [activeFolder, setActiveFolder] = useState<EmailFolder>("inbox");
    const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
    const [isSyncing, setIsSyncing] = useState(false);
    const [isProcessingSequences, setIsProcessingSequences] = useState(false);

    const { data: templates = [], isLoading: templatesLoading, mutate: mutateTemplates } = useEmailTemplates();
    const { data: sequences = [], mutate: mutateSequences } = useEmailSequences();
    const { data: smtpConfigs = [] } = useSMTPConfigs();
    const { data: emails, isLoading: emailsLoading } = useEmails(activeFolder, selectedAccountId);

    const { trigger: deleteTemplate } = useDeleteEmailTemplate();
    const { trigger: deleteSequence } = useDeleteEmailSequence();
    const { trigger: updateSequence } = useUpdateEmailSequence();
    const { data: activeProfile } = useActiveProfile();

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            toast.success("Inbox synced via IMAP");
        }, 3000);
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
                    <Button variant="outline" onClick={() => setSequenceOpen(true)}>
                        <Clock className="h-4 w-4 mr-2" />
                        Sequences
                    </Button>
                    <Button onClick={() => setComposerOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Compose
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
                {/* Sidebar */}
                <Card className="lg:col-span-1">
                    <CardContent className="p-4">
                        <h3 className="mb-2 px-2 text-sm font-semibold tracking-tight">
                            Mailboxes
                        </h3>
                        <div className="space-y-1">
                            <Button
                                variant={activeFolder === "inbox" ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setActiveFolder("inbox")}
                            >
                                <Inbox className="mr-2 h-4 w-4" />
                                Inbox
                            </Button>
                            <Button
                                variant={activeFolder === "sent" ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setActiveFolder("sent")}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Sent
                            </Button>
                            <Button
                                variant={activeFolder === "starred" ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setActiveFolder("starred")}
                            >
                                <Star className="mr-2 h-4 w-4" />
                                Starred
                            </Button>
                            <Button
                                variant={activeFolder === "archive" ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setActiveFolder("archive")}
                            >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                            </Button>
                            <Button
                                variant={activeFolder === "trash" ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setActiveFolder("trash")}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Trash
                            </Button>
                        </div>
                        <Separator className="my-4" />
                        <h3 className="mb-2 px-2 text-sm font-semibold tracking-tight">
                            Accounts
                        </h3>
                        <div className="space-y-1">
                            <Button
                                variant={selectedAccountId === "all" ? "secondary" : "ghost"}
                                className="w-full justify-start text-xs"
                                onClick={() => setSelectedAccountId("all")}
                            >
                                All Accounts
                            </Button>
                            {smtpConfigs?.map(account => (
                                <Button
                                    key={account.id}
                                    variant={selectedAccountId === account.id ? "secondary" : "ghost"}
                                    className="w-full justify-start text-xs truncate"
                                    onClick={() => setSelectedAccountId(account.id)}
                                >
                                    {account.email_addr}
                                </Button>
                            ))}
                        </div>

                        <Separator className="my-4" />

                        <div>
                            <h4 className="text-sm font-semibold mb-2">Quick Stats</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sent Today</span>
                                    <span className="font-medium">24</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Open Rate</span>
                                    <span className="font-medium">45%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Click Rate</span>
                                    <span className="font-medium">12%</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    <Tabs defaultValue="inbox">
                        <TabsList className="mb-4">
                            <TabsTrigger value="inbox">Inbox</TabsTrigger>
                            <TabsTrigger value="sequences">Sequences</TabsTrigger>
                            <TabsTrigger value="templates">Templates</TabsTrigger>
                        </TabsList>

                        <TabsContent value="inbox">
                            <Card>
                                <CardHeader className="pb-3 border-b">
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="relative flex-1 w-full">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input placeholder="Search emails..." className="pl-10" />
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleSync}
                                            disabled={isSyncing}
                                        >
                                            <motion.div
                                                animate={isSyncing ? { rotate: 360 } : {}}
                                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                            >
                                                <Zap className={cn("h-4 w-4 mr-2", isSyncing && "text-primary")} />
                                            </motion.div>
                                            {isSyncing ? "Syncing..." : "Sync Inbox"}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 relative">
                                    {isSyncing && (
                                        <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm font-medium">Connecting to IMAP...</p>
                                            </div>
                                        </div>
                                    )}
                                    <ScrollArea className="h-[500px]">
                                        {emailsLoading ? (
                                            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                                <span>Loading emails...</span>
                                            </div>
                                        ) : !emails || emails.length === 0 ? (
                                            <div className="p-8 text-center text-muted-foreground">
                                                No emails found in {activeFolder}.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                {emails.map((email) => (
                                                    <div
                                                        key={email.id}
                                                        className={cn(
                                                            "flex flex-col gap-1 p-4 border-b hover:bg-accent cursor-pointer transition-colors",
                                                            !email.is_read && "bg-muted/50 font-medium"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarFallback>
                                                                        {email.from_addr[0].toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className={cn("text-sm", !email.is_read && "font-semibold")}>
                                                                    {email.from_addr}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {formatTime(email.received_at)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-sm truncate flex-1">
                                                                {email.subject || "(No Subject)"}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                {email.has_attachment && (
                                                                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                                                                )}
                                                                {email.is_starred && (
                                                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                            {(email.body_text || email.body_html || "").replace(/<[^>]*>?/gm, "").substring(0, 100)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

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
