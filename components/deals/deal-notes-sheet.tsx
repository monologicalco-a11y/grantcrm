"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2, Send, Loader2 } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useDealNotes, useCreateDealNote, useDeleteDealNote } from "@/hooks/use-deal-notes";
import { useActiveProfile } from "@/hooks/use-data";
import type { Deal } from "@/types";

interface DealNotesSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    deal: Deal | null;
}

export function DealNotesSheet({ open, onOpenChange, deal }: DealNotesSheetProps) {
    const { data: activeProfile } = useActiveProfile();
    const { data: notes, isLoading, mutate } = useDealNotes(deal?.id || null);
    const { trigger: createNote } = useCreateDealNote();
    const { trigger: deleteNote } = useDeleteDealNote();

    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim() || !deal || !activeProfile) return;

        setIsSubmitting(true);
        try {
            await createNote({
                deal_id: deal.id,
                author_id: activeProfile.id,
                content: content.trim(),
            });
            setContent("");
            mutate();
            toast.success("Note added successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to add note");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (noteId: string) => {
        if (!confirm("Delete this note?")) return;
        try {
            await deleteNote(noteId);
            mutate();
            toast.success("Note deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete note");
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col h-full border-l">
                <SheetHeader className="pb-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        Deal Notes
                    </SheetTitle>
                    <SheetDescription className="truncate">
                        {deal?.name}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : notes?.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground bg-muted/20 rounded-lg">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No notes have been added to this deal yet.</p>
                        </div>
                    ) : (
                        notes?.map((note) => {
                            const isAuthor = note.author_id === activeProfile?.id;
                            const canDelete = isAuthor || activeProfile?.role === "admin" || activeProfile?.role === "manager";

                            return (
                                <div key={note.id} className="group relative bg-muted/30 p-4 rounded-lg flex gap-3 text-sm">
                                    <Avatar className="h-8 w-8 shrink-0">
                                        <AvatarImage src={note.author?.avatar_url} />
                                        <AvatarFallback>{note.author?.full_name?.[0] || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-foreground">
                                                {note.author?.full_name || 'Unknown User'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                                    </div>
                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(note.id)}
                                            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="pt-4 border-t space-y-3 shrink-0">
                    <Textarea
                        placeholder="Type your note here..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="resize-none min-h-[100px]"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground ml-1">
                            Press <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border">Cmd+Enter</kbd> to submit
                        </span>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !content.trim()}
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Save Note
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
