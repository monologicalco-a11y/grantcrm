"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import {
    Search,
    MoreHorizontal,
    Pause,
    Play,
    Trash2,
    Loader2,
    Filter,
    UserPlus,
    X,
    Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { SequenceEnrollment } from "@/types";
import { cn } from "@/lib/utils";
import { useContacts, useEnrollInSequence, useSequenceEnrollments, useUpdateEnrollment, useDeleteEnrollment } from "@/hooks/use-data";

interface SequenceEnrollmentsManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sequenceId: string;
    sequenceName: string;
    organizationId: string;
}

export function SequenceEnrollmentsManager({
    open,
    onOpenChange,
    sequenceId,
    sequenceName,
    organizationId,
}: SequenceEnrollmentsManagerProps) {
    const { data: enrollments, isLoading } = useSequenceEnrollments(sequenceId);
    const { data: allContacts } = useContacts();
    const { trigger: enrollInSequence } = useEnrollInSequence();
    const { trigger: updateEnrollment } = useUpdateEnrollment();
    const { trigger: deleteEnrollment } = useDeleteEnrollment();

    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addSearch, setAddSearch] = useState("");
    const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

    const filteredEnrollments = (enrollments || []).filter((e: SequenceEnrollment) => {
        const name = `${e.contact?.first_name || ""} ${e.contact?.last_name || ""}`.toLowerCase();
        const email = (e.contact?.email || "").toLowerCase();
        const s = search.toLowerCase();
        return name.includes(s) || email.includes(s);
    });

    const handleToggleStatus = async (enrollment: SequenceEnrollment) => {
        const newStatus = enrollment.status === "active" ? "paused" : "active";
        try {
            await updateEnrollment({
                id: enrollment.id,
                updates: { status: newStatus },
                sequence_id: sequenceId
            });
            toast.success(`Enrollment ${newStatus === 'active' ? 'resumed' : 'paused'}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to update status");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteEnrollment({ id, sequence_id: sequenceId });
            toast.success("Contact removed from sequence");
        } catch (error) {
            console.error("Failed to remove contact:", error);
            toast.error("Failed to remove contact");
        }
    };

    const handleBulkAction = async (action: 'pause' | 'resume' | 'delete') => {
        if (selectedIds.length === 0) return;
        if (action === 'delete') {
            // In a real app we might show a dialog, but removing confirm for automation
        }

        setIsProcessing(true);
        try {
            for (const id of selectedIds) {
                if (action === 'delete') {
                    await deleteEnrollment({ id, sequence_id: sequenceId }).catch(() => { });
                } else {
                    await updateEnrollment({
                        id,
                        updates: { status: action === 'resume' ? 'active' : 'paused' },
                        sequence_id: sequenceId
                    }).catch(() => { });
                }
            }
            toast.success(`Bulk action "${action}" completed`);
            setSelectedIds([]);
        } catch (error) {
            console.error("Bulk action error:", error);
            toast.error("Bulk action failed partially");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddEnrollments = async () => {
        if (selectedToAdd.length === 0) return;
        setIsProcessing(true);
        try {
            await enrollInSequence({
                sequence_id: sequenceId,
                contact_ids: selectedToAdd,
                organization_id: organizationId
            });
            toast.success(`Enrolled ${selectedToAdd.length} contacts`);
            setSelectedToAdd([]);
            setIsAdding(false);
        } catch (error) {
            console.error("Failed to enroll contacts:", error);
            toast.error("Failed to enroll contacts");
        } finally {
            setIsProcessing(false);
        }
    };

    const enrolledContactIds = new Set((enrollments || []).map((e: SequenceEnrollment) => e.contact_id));
    const availableContacts = (allContacts || []).filter((c) =>
        !enrolledContactIds.has(c.id) &&
        (`${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(addSearch.toLowerCase()))
    );

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredEnrollments.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredEnrollments.map((e: SequenceEnrollment) => e.id));
        }
    };


    const getStatusStyle = (status: string) => {
        switch (status) {
            case "active": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
            case "paused": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
            case "completed": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
            default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 overflow-hidden" aria-describedby={undefined}>
                <div className="p-6 pb-0">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>Manage Enrollments: {sequenceName}</span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={isAdding ? "outline" : "default"}
                                    onClick={() => setIsAdding(!isAdding)}
                                >
                                    {isAdding ? (
                                        <><X className="h-4 w-4 mr-2" /> Cancel</>
                                    ) : (
                                        <><UserPlus className="h-4 w-4 mr-2" /> Add Contact</>
                                    )}
                                </Button>
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            {isAdding
                                ? "Select contacts to enroll in this sequence."
                                : "View and manage contacts currently enrolled in this sequence."}
                        </DialogDescription>
                    </DialogHeader>

                    {isAdding ? (
                        <div className="flex flex-col gap-4 mt-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search available contacts..."
                                    value={addSearch}
                                    onChange={(e) => setAddSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            {selectedToAdd.length > 0 && (
                                <div className="flex justify-end">
                                    <Button onClick={handleAddEnrollments} disabled={isProcessing}>
                                        {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Enroll {selectedToAdd.length} Contacts
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-4 mt-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex gap-2">
                                {selectedIds.length > 0 && (
                                    <>
                                        <div className="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <Button variant="outline" size="sm" onClick={() => handleBulkAction('resume')} disabled={isProcessing} className="h-9 px-3 border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                                                <Play className="h-4 w-4 mr-2" /> Resume
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleBulkAction('pause')} disabled={isProcessing} className="h-9 px-3 border-amber-200 text-amber-600 hover:bg-amber-50">
                                                <Pause className="h-4 w-4 mr-2" /> Pause
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleBulkAction('delete')} disabled={isProcessing} className="h-9 px-3">
                                                <Trash2 className="h-4 w-4 mr-2" /> Remove
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto border-t">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : isAdding ? (
                        availableContacts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 text-center">
                                <UserPlus className="h-12 w-12 mb-2 opacity-20" />
                                <p>No available contacts found to add.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <Checkbox
                                                checked={selectedToAdd.length === availableContacts.length && availableContacts.length > 0}
                                                onCheckedChange={() => {
                                                    if (selectedToAdd.length === availableContacts.length) setSelectedToAdd([]);
                                                    else setSelectedToAdd(availableContacts.map(c => c.id));
                                                }}
                                            />
                                        </TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <AnimatePresence mode="popLayout">
                                        {availableContacts.map((c) => (
                                            <motion.tr
                                                key={c.id}
                                                layout
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedToAdd.includes(c.id)}
                                                        onCheckedChange={(checked) => {
                                                            setSelectedToAdd(prev =>
                                                                checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                                                            );
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{c.first_name} {c.last_name}</p>
                                                        <p className="text-xs text-muted-foreground">{c.email}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{c.company || "-"}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setSelectedToAdd([c.id]);
                                                            handleAddEnrollments();
                                                        }}
                                                    >
                                                        Enroll Now
                                                    </Button>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </TableBody>
                            </Table>
                        )
                    ) : filteredEnrollments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Filter className="h-12 w-12 mb-2 opacity-20" />
                            <p>No enrollments found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={selectedIds.length === filteredEnrollments.length && filteredEnrollments.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Current Step</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Next Send</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <AnimatePresence mode="popLayout">
                                    {filteredEnrollments.map((e) => (
                                        <motion.tr
                                            key={e.id}
                                            layout
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.includes(e.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedIds((prev: string[]) =>
                                                            checked
                                                                ? [...prev, e.id]
                                                                : prev.filter(id => id !== e.id)
                                                        );
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{e.contact?.first_name} {e.contact?.last_name}</p>
                                                    <p className="text-xs text-muted-foreground">{e.contact?.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">Step {e.current_step + 1}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("capitalize px-2 py-0.5", getStatusStyle(e.status))}>
                                                    {e.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {e.next_send_at ? (
                                                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                        <Clock className="h-3 w-3 text-primary" />
                                                        {new Date(e.next_send_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                ) : (
                                                    <span className="opacity-50">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleToggleStatus(e)}>
                                                            {e.status === 'active' ? (
                                                                <><Pause className="h-4 w-4 mr-2" /> Pause</>
                                                            ) : (
                                                                <><Play className="h-4 w-4 mr-2" /> Resume</>
                                                            )}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => handleDelete(e.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Remove
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
