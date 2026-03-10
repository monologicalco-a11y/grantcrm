"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Plus,
    MoreHorizontal,
    DollarSign,
    Calendar,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useDeals, useDeleteDeal, useActiveProfile, usePipelines } from "@/hooks/use-data";
import { DealDialog } from "@/components/deals/deal-dialog";
import { DealNotesSheet } from "@/components/deals/deal-notes-sheet";
import { DealFilters, type DealFilterValues } from "@/components/deals/deal-filters";
import type { Deal, Pipeline } from "@/types";

// Fallback pipeline stages if no pipeline is selected or available
const FALLBACK_STAGES = [
    { id: "lead", name: "Lead", color: "bg-slate-500" },
    { id: "qualified", name: "Qualified", color: "bg-blue-500" },
    { id: "proposal", name: "Proposal", color: "bg-yellow-500" },
    { id: "negotiation", name: "Negotiation", color: "bg-orange-500" },
    { id: "closed-won", name: "Closed Won", color: "bg-green-500" },
];

function DealCard({
    deal,
    onEdit,
    onNotes,
    onDelete,
}: {
    deal: Deal;
    onEdit: () => void;
    onNotes: () => void;
    onDelete: () => void;
}) {
    const contactName = deal.contact
        ? `${deal.contact.first_name} ${deal.contact.last_name || ""}`
        : "No contact";
    const initials = deal.contact
        ? `${deal.contact.first_name[0]}${deal.contact.last_name?.[0] || ""}`
        : "?";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
        >
            <div className="flex items-start justify-between mb-3">
                <h4 className="font-medium text-sm line-clamp-2">{deal.name}</h4>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onEdit}>Edit Deal</DropdownMenuItem>
                        <DropdownMenuItem onClick={onNotes}>View / Add Notes</DropdownMenuItem>
                        <DropdownMenuItem>View Contact</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="space-y-2">
                <div className="flex items-center text-lg font-bold text-primary">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(deal.value)}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{contactName}</span>
                </div>

                <div className="flex items-center justify-between">
                    {deal.expected_close_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(deal.expected_close_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })}
                        </div>
                    )}
                    <Badge variant="outline" className="text-xs">
                        {deal.probability}%
                    </Badge>
                </div>
            </div>
        </motion.div>
    );
}

export default function DealsPage() {
    const { data: pipelines } = usePipelines();
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [notesDeal, setNotesDeal] = useState<Deal | null>(null);
    const [filters, setFilters] = useState<DealFilterValues>({
        search: "",
        stage: "all",
        minValue: "",
        maxValue: "",
        minProbability: "",
        maxProbability: "",
    });

    const { data: deals, isLoading, mutate } = useDeals(selectedPipelineId);
    const { trigger: deleteDeal } = useDeleteDeal();
    const { data: activeProfile } = useActiveProfile();

    const selectedPipeline = pipelines?.find((p: Pipeline) => p.id === selectedPipelineId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stages = ((selectedPipeline?.stages as any[]) || FALLBACK_STAGES) as { id: string; name: string; color: string }[];

    const filteredDeals = (deals || []).filter((deal) => {
        const matchesSearch = deal.name.toLowerCase().includes(filters.search.toLowerCase());
        const matchesStage = filters.stage === "all" || deal.stage === filters.stage;
        const matchesMinValue = filters.minValue === "" || deal.value >= Number(filters.minValue);
        const matchesMaxValue = filters.maxValue === "" || deal.value <= Number(filters.maxValue);
        const matchesMinProb = filters.minProbability === "" || deal.probability >= Number(filters.minProbability);
        const matchesMaxProb = filters.maxProbability === "" || deal.probability <= Number(filters.maxProbability);

        return matchesSearch && matchesStage && matchesMinValue && matchesMaxValue && matchesMinProb && matchesMaxProb;
    });

    const getDealsForStage = (stageId: string) =>
        filteredDeals.filter((deal) => deal.stage === stageId);

    const totalPipelineValue = filteredDeals.reduce(
        (acc, deal) => acc + deal.value,
        0
    );
    const weightedValue = filteredDeals.reduce(
        (acc, deal) => acc + deal.value * (deal.probability / 100),
        0
    );

    const handleEdit = (deal: Deal) => {
        setEditingDeal(deal);
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this deal?")) return;
        try {
            await deleteDeal(id);
            toast.success("Deal deleted");
            mutate();
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete deal");
        }
    };

    const handleSuccess = () => {
        mutate();
        setEditingDeal(null);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Deals Pipeline</h1>
                    <p className="text-muted-foreground">
                        Track and manage your sales opportunities
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Pipeline" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Pipelines</SelectItem>
                            {pipelines?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DealFilters
                        stages={stages}
                        currentFilters={filters}
                        onFilterChange={setFilters}
                    />
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Deal
                    </Button>
                </div>
            </div>

            {/* Pipeline Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Pipeline Value
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(totalPipelineValue)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Weighted Pipeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">
                            {formatCurrency(weightedValue)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Deals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredDeals.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Kanban Board */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredDeals.length === 0 && filters.search === "" && filters.stage === "all" ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-xl bg-muted/30">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
                        <DollarSign className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">No deals yet</h2>
                    <p className="text-muted-foreground max-w-sm mb-8">
                        Your sales pipeline is empty. Start tracking your opportunities and grow your revenue today.
                    </p>
                    <Button size="lg" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Deal
                    </Button>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {stages.map((stage) => {
                        const stageDeals = getDealsForStage(stage.id);
                        const stageValue = stageDeals.reduce((acc, d) => acc + d.value, 0);

                        return (
                            <div
                                key={stage.id}
                                className="flex-shrink-0 w-[300px] bg-muted/30 rounded-lg"
                            >
                                {/* Stage Header */}
                                <div className="p-3 border-b">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                            <h3 className="font-semibold text-sm">{stage.name}</h3>
                                            <Badge variant="secondary" className="text-xs">
                                                {stageDeals.length}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {formatCurrency(stageValue)}
                                    </p>
                                </div>

                                {/* Deals */}
                                <div className="p-2 space-y-2 min-h-[200px]">
                                    {stageDeals.map((deal) => (
                                        <DealCard
                                            key={deal.id}
                                            deal={deal}
                                            onEdit={() => handleEdit(deal)}
                                            onNotes={() => setNotesDeal(deal)}
                                            onDelete={() => handleDelete(deal.id)}
                                        />
                                    ))}
                                    {stageDeals.length === 0 && (
                                        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                                            Drop deals here
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Deal Dialog */}
            <DealDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setEditingDeal(null);
                }}
                deal={editingDeal}
                pipelineId={selectedPipelineId === 'all' ? (pipelines?.[0]?.id || "") : selectedPipelineId}
                organizationId={activeProfile?.organization_id || ""}
                stages={stages}
                onSuccess={handleSuccess}
            />

            {/* Deal Notes Sheet */}
            <DealNotesSheet
                open={!!notesDeal}
                onOpenChange={(open) => {
                    if (!open) setNotesDeal(null);
                }}
                deal={notesDeal}
            />
        </motion.div>
    );
}
