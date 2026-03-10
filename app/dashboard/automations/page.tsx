"use client";

import { Plus, Workflow as WorkflowIcon, MoreVertical, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkflows, useDeleteWorkflow, useUpdateWorkflow, useCreateWorkflow } from "@/hooks/use-workflows";
import { useActiveProfile } from "@/hooks/use-data";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExecutionLogs } from "@/components/automations/execution-logs";

export default function AutomationPage() {
    const { data: profile } = useActiveProfile();
    const { data: workflows, isLoading } = useWorkflows();
    const { trigger: deleteWorkflow } = useDeleteWorkflow();
    const { trigger: updateWorkflow } = useUpdateWorkflow();
    const { trigger: createWorkflow } = useCreateWorkflow();

    const handleCreate = async () => {
        if (!profile?.organization_id) {
            toast.error("Unable to create workflow: Organization not found");
            return;
        }
        try {
            await createWorkflow({
                organization_id: profile.organization_id,
                name: "New Automation",
                description: "Describe your automation here...",
                nodes: [],
                edges: [],
                is_active: false
            });
            toast.success("Workflow created successfully");
        } catch (error) {
            console.error("Error creating workflow:", error);
            const message = error instanceof Error ? error.message : "Failed to create workflow";
            toast.error(message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this workflow?")) return;
        try {
            await deleteWorkflow(id);
            toast.success("Workflow deleted");
        } catch {
            toast.error("Failed to delete workflow");
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await updateWorkflow({ id, updates: { is_active: !currentStatus } });
            toast.success(`Workflow ${!currentStatus ? "activated" : "deactivated"}`);
        } catch {
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center text-left">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Workflows & Automation</h1>
                    <p className="text-muted-foreground">Design and manage visual automation sequences.</p>
                </div>
                <Button onClick={handleCreate} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Workflow
                </Button>
            </div>

            <Tabs defaultValue="workflows" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="workflows">Workflows</TabsTrigger>
                    <TabsTrigger value="logs">Execution Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="workflows">
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <Card key={i} className="animate-pulse">
                                    <CardHeader className="h-32 bg-muted/50" />
                                </Card>
                            ))}
                        </div>
                    ) : workflows?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl">
                            <WorkflowIcon className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No workflows found</h3>
                            <p className="text-muted-foreground mb-4 text-center max-w-sm">
                                Start by creating your first visual automation to streamline your sales process.
                            </p>
                            <Button onClick={handleCreate}>Create Your First Workflow</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {workflows?.map((workflow) => (
                                <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader className="flex flex-row items-start justify-between space-y-0 text-left">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-xl">{workflow.name}</CardTitle>
                                                <Badge variant={workflow.is_active ? "default" : "secondary"}>
                                                    {workflow.is_active ? "Active" : "Draft"}
                                                </Badge>
                                            </div>
                                            <CardDescription>{workflow.description}</CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/automations/builder/${workflow.id}`}>
                                                        Edit Workflow
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => toggleStatus(workflow.id, workflow.is_active)}>
                                                    {workflow.is_active ? (
                                                        <span className="flex items-center text-yellow-600">
                                                            <Pause className="w-4 h-4 mr-2" /> Deactivate
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center text-green-600">
                                                            <Play className="w-4 h-4 mr-2" /> Activate
                                                        </span>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(workflow.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </CardHeader>
                                    <CardContent className="text-left">
                                        <div className="text-xs text-muted-foreground">
                                            Last updated {format(new Date(workflow.updated_at), "MMM d, yyyy")}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="logs">
                    <ExecutionLogs />
                </TabsContent>
            </Tabs>
        </div>
    );
}

