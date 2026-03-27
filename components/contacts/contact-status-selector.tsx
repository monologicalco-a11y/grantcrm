"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useContactStatuses, useUpdateContact } from "@/hooks/use-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";

interface ContactStatusSelectorProps {
    contactId: string;
    currentStatus?: string | null;
}

export function ContactStatusSelector({ contactId, currentStatus }: ContactStatusSelectorProps) {
    const { data: statuses, isLoading: loadingStatuses } = useContactStatuses();
    const { trigger: updateContact, isMutating: isUpdating } = useUpdateContact();

    // Ensure we match case-insensitively for robustness
    const normalizedValue = React.useMemo(() => 
        currentStatus?.toLowerCase() || "new", 
    [currentStatus]);

    const handleStatusChange = async (statusName: string) => {
        if (statusName.toLowerCase() === normalizedValue) return;

        try {
            await updateContact({
                id: contactId,
                updates: { status: statusName.toLowerCase() }
            });
            toast.success(`Status updated to ${statusName.replace(/_/g, ' ')}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to update status");
        }
    };

    if (loadingStatuses) {
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }

    const selectedStatus = statuses?.find((s) => s.name.toLowerCase() === normalizedValue);

    return (
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-muted-foreground/90 uppercase tracking-widest whitespace-nowrap bg-muted/30 px-2 py-1 rounded-md border border-white/5">Status</span>
            <Select
                value={normalizedValue}
                onValueChange={handleStatusChange}
                disabled={isUpdating}
            >
                <SelectTrigger className="h-9 w-[180px] text-xs font-semibold bg-background/50 hover:bg-background border-primary/20 transition-all shadow-md">
                    {isUpdating ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="min-w-[180px]">
                    <ScrollArea className="h-[300px]">
                        <div className="p-1">
                            {statuses?.map((status) => (
                                <SelectItem 
                                    key={status.id} 
                                    value={status.name.toLowerCase()}
                                    className="text-xs focus:bg-primary/10 cursor-pointer rounded-lg py-2"
                                >
                                    <div className="flex items-center gap-2 py-0.5">
                                         <div className={cn(
                                            "h-2 w-2 rounded-full shrink-0",
                                            status.color === 'red' && "bg-red-500",
                                            status.color === 'blue' && "bg-blue-500",
                                            status.color === 'green' && "bg-green-500",
                                            status.color === 'orange' && "bg-orange-500",
                                            status.color === 'purple' && "bg-purple-500",
                                            status.color === 'yellow' && "bg-yellow-500",
                                            status.color === 'slate' && "bg-slate-500",
                                            (!status.color || status.color === 'gray') && "bg-slate-400"
                                        )} />
                                        {status.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </div>
                    </ScrollArea>
                </SelectContent>
            </Select>
        </div>
    );
}
