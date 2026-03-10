"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, Settings2, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePipelines, useCreatePipeline, useUpdatePipeline, useDeletePipeline } from "@/hooks/use-deals";
import { useActiveProfile } from "@/hooks/use-settings";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Pipeline } from "@/types";

interface Stage {
    id: string;
    name: string;
    order: number;
    color: string;
}

export default function PipelineSettingsPage() {
    const { data: pipelines, isLoading, mutate } = usePipelines();
    const { trigger: createPipeline } = useCreatePipeline();
    const { trigger: updatePipeline } = useUpdatePipeline();
    const { trigger: deletePipeline } = useDeletePipeline();
    const { data: profile } = useActiveProfile();
    const router = useRouter();

    const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editStages, setEditStages] = useState<Stage[]>([]);

    const handleStartCreate = () => {
        setEditingPipelineId("new");
        setEditName("New Pipeline");
        setEditStages([
            { id: "lead", name: "Lead", order: 0, color: "bg-slate-500" },
            { id: "closed-won", name: "Closed Won", order: 1, color: "bg-green-500" }
        ]);
    };

    const handleStartEdit = (pipeline: Pipeline) => {
        setEditingPipelineId(pipeline.id);
        setEditName(pipeline.name);
        setEditStages(pipeline.stages || []);
    };

    const handleAddStage = () => {
        const newId = `stage-${Date.now()}`;
        setEditStages([...editStages, { id: newId, name: "New Stage", order: editStages.length, color: "bg-blue-500" }]);
    };

    const handleRemoveStage = (id: string) => {
        setEditStages(editStages.filter(s => s.id !== id));
    };

    const handleSave = async () => {
        if (!profile?.organization_id) return;

        try {
            if (editingPipelineId === "new") {
                await createPipeline({
                    organization_id: profile.organization_id,
                    name: editName,
                    stages: editStages,
                    is_default: (pipelines?.length || 0) === 0
                });
                toast.success("Pipeline created");
            } else if (editingPipelineId) {
                await updatePipeline({
                    id: editingPipelineId,
                    updates: { name: editName, stages: editStages }
                });
                toast.success("Pipeline updated");
            }
            setEditingPipelineId(null);
            mutate();
        } catch {
            toast.error("Failed to save pipeline");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this pipeline? All related deals will be affected.")) return;
        try {
            await deletePipeline(id);
            toast.success("Pipeline deleted");
            mutate();
        } catch {
            toast.error("Failed to delete pipeline");
        }
    };

    if (isLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Pipeline Management</h1>
                    <p className="text-muted-foreground">Configure your sales stages and multiple pipelines.</p>
                </div>
            </div>

            {editingPipelineId ? (
                <Card>
                    <CardHeader>
                        <CardTitle>{editingPipelineId === "new" ? "Create Pipeline" : "Edit Pipeline"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Pipeline Name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label>Stages</Label>
                                <Button size="sm" variant="outline" onClick={handleAddStage}>
                                    <Plus className="w-3 h-3 mr-1" /> Add Stage
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {editStages.map((stage, index) => (
                                    <div key={stage.id} className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border">
                                        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <Input
                                            value={stage.name}
                                            onChange={(e) => {
                                                const newStages = [...editStages];
                                                newStages[index].name = e.target.value;
                                                setEditStages(newStages);
                                            }}
                                            className="bg-background"
                                        />
                                        <SelectColor
                                            value={stage.color}
                                            onChange={(color) => {
                                                const newStages = [...editStages];
                                                newStages[index].color = color;
                                                setEditStages(newStages);
                                            }}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive h-8 w-8 hover:bg-destructive/10"
                                            onClick={() => handleRemoveStage(stage.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" onClick={() => setEditingPipelineId(null)}>Cancel</Button>
                            <Button onClick={handleSave} className="gap-2">
                                <Save className="w-4 h-4" /> Save Pipeline
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {pipelines?.map((p) => (
                        <Card key={p.id}>
                            <CardContent className="flex items-center justify-between p-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-lg">{p.name}</h3>
                                        {p.is_default && <Badge variant="secondary">Default</Badge>}
                                    </div>
                                    <div className="flex gap-1 overflow-hidden">
                                        {p.stages?.map((s, i) => (
                                            <div key={i} className={`h-2 w-8 rounded-full ${s.color || 'bg-slate-300'}`} title={s.name} />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleStartEdit(p)}>
                                        <Settings2 className="w-4 h-4 mr-2" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    <Button variant="outline" className="border-dashed h-24 border-2" onClick={handleStartCreate}>
                        <Plus className="w-5 h-5 mr-2" /> Create New Pipeline
                    </Button>
                </div>
            )}
        </div>
    );
}

function SelectColor({ value, onChange }: { value: string, onChange: (c: string) => void }) {
    const colors = [
        "bg-slate-500", "bg-gray-500", "bg-zinc-500", "bg-neutral-500", "bg-stone-500",
        "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-lime-500",
        "bg-green-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-sky-500",
        "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500",
        "bg-pink-500", "bg-rose-500"
    ];

    return (
        <div className="flex gap-1 overflow-x-auto p-1 max-w-[150px]">
            <div className={`w-6 h-6 rounded-full ${value} shrink-0 ring-2 ring-offset-2 ring-primary`} />
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="text-xs border rounded p-1"
                aria-label="Select stage color"
            >
                {colors.map(c => (
                    <option key={c} value={c}>{c.replace('bg-', '').replace('-500', '')}</option>
                ))}
            </select>
        </div>
    );
}
