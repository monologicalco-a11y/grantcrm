"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

interface BulkEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contactIds: string[];
    isSelectAllMatching: boolean;
    totalMatches: number;
    filters?: Record<string, string>;
    onSuccess: () => void;
}

export function BulkEmailDialog({
    open,
    onOpenChange,
    contactIds,
    isSelectAllMatching,
    totalMatches,
    filters,
    onSuccess
}: BulkEmailDialogProps) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);

    const recipientCount = isSelectAllMatching ? totalMatches : contactIds.length;

    const handleSend = async () => {
        if (!subject.trim() || !body.trim()) {
            toast.error("Subject and body are required");
            return;
        }

        setIsSending(true);
        try {
            const response = await fetch("/api/emails/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subject,
                    body,
                    contactIds: isSelectAllMatching ? [] : contactIds,
                    isSelectAllMatching,
                    filters: isSelectAllMatching ? filters : undefined
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to send bulk email");
            }

            const data = await response.json();
            toast.success(`Successfully queued ${data.queuedCount} emails for sending`);
            setSubject("");
            setBody("");
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send emails");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Send Bulk Email
                    </DialogTitle>
                    <DialogDescription>
                        Compose a message to send to <strong>{recipientCount}</strong> selected contacts.
                        You can use {'{{first_name}}'} and {'{{last_name}}'} as variables.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Input
                            placeholder="Subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={isSending}
                        />
                    </div>
                    <div className="space-y-2">
                        <Textarea
                            placeholder="Type your message here... Example: Hi {{first_name}},"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            disabled={isSending}
                            className="min-h-[200px] resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
                        Cancel
                    </Button>
                    <Button onClick={handleSend} disabled={isSending || !subject.trim() || !body.trim()}>
                        {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send {recipientCount} Emails
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
