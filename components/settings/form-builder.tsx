"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit, Code, Copy, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useActiveProfile } from "@/hooks/use-data";
import { toast } from "sonner";

interface WebForm {
    id: string;
    name: string;
    description: string;
    submit_button_text: string;
    success_message: string;
    is_active: boolean;
    created_at: string;
    schema: Record<string, unknown>[]; // MVP: just a basic predefined schema on the backend
}

export function FormBuilder() {
    const { data: profile } = useActiveProfile();
    const [forms, setForms] = useState<WebForm[]>([]);
    const [loading, setLoading] = useState(true);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<Partial<WebForm> | null>(null);
    const [saving, setSaving] = useState(false);

    const [embedOpen, setEmbedOpen] = useState(false);
    const [selectedEmbed, setSelectedEmbed] = useState<WebForm | null>(null);
    const [copied, setCopied] = useState(false);

    const supabase = createClient();
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    const fetchForms = useCallback(async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('web_forms')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setForms(data);
        } else if (error && error.code === '42P01') {
            console.log('web_forms table does not exist yet (pending migration)');
        }
        setLoading(false);
    }, [profile?.organization_id, supabase]);

    useEffect(() => {
        fetchForms();
    }, [fetchForms]);

    const handleSave = async () => {
        if (!editingForm?.name || !profile?.organization_id) return;
        setSaving(true);

        const payload = {
            organization_id: profile.organization_id,
            name: editingForm.name,
            description: editingForm.description || '',
            submit_button_text: editingForm.submit_button_text || 'Submit',
            success_message: editingForm.success_message || 'Thank you!',
        };

        let err;
        if (editingForm.id) {
            const { error } = await supabase
                .from('web_forms')
                .update(payload)
                .eq('id', editingForm.id);
            err = error;
        } else {
            const { error } = await supabase
                .from('web_forms')
                .insert([payload]);
            err = error;
        }

        if (err) {
            toast.error(err.code === '42P01' ? "Please deploy database migrations first." : "Failed to save form.");
        } else {
            toast.success("Form saved successfully.");
            setDialogOpen(false);
            fetchForms();
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this form? All embedded versions will stop working.")) return;
        const { error } = await supabase.from('web_forms').delete().eq('id', id);
        if (error) {
            toast.error("Failed to delete form.");
        } else {
            toast.success("Form deleted.");
            fetchForms();
        }
    };

    const copyEmbedCode = (formId: string) => {
        const endpoint = `${baseUrl}/api/public/forms/${formId}/submit`;
        const html = `<form action="${endpoint}" method="POST" class="nanosol-form">\n  <label>Email *</label>\n  <input type="email" name="email" required />\n  <label>First Name</label>\n  <input type="text" name="first_name" />\n  <label>Last Name</label>\n  <input type="text" name="last_name" />\n  <button type="submit">Submit</button>\n</form>`;

        navigator.clipboard.writeText(html);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Embed code copied to clipboard");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Lead Capture Forms</h3>
                    <p className="text-sm text-muted-foreground">
                        Create custom HTML forms to capture leads directly into your CRM.
                    </p>
                </div>
                <Button onClick={() => { setEditingForm({}); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Form
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : forms.length === 0 ? (
                <Card className="border-dashed bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Code className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                        <h3 className="text-lg font-medium">No forms created yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
                            Create a lead capture form to embed on your website or landing pages.
                        </p>
                        <Button onClick={() => { setEditingForm({}); setDialogOpen(true); }}>
                            Create your first form
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {forms.map(form => (
                        <Card key={form.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">{form.name}</CardTitle>
                                        <CardDescription>{form.description || "No description provided."}</CardDescription>
                                    </div>
                                    <Badge variant={form.is_active ? "default" : "secondary"}>
                                        {form.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardFooter className="flex justify-between pt-4 border-t border-border/50 bg-muted/10">
                                <Button variant="outline" size="sm" onClick={() => { setSelectedEmbed(form); setEmbedOpen(true); }}>
                                    <Code className="h-4 w-4 mr-2" />
                                    Get Code
                                </Button>
                                <div className="space-x-2">
                                    <Button variant="ghost" size="sm" onClick={() => { setEditingForm(form); setDialogOpen(true); }}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(form.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Editor Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingForm?.id ? "Edit Form" : "Create New Form"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Form Name</Label>
                            <Input
                                placeholder="e.g. Website Contact Form"
                                value={editingForm?.name || ""}
                                onChange={(e) => setEditingForm({ ...editingForm, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description (Internal)</Label>
                            <Input
                                placeholder="e.g. Embedded on the main pricing page"
                                value={editingForm?.description || ""}
                                onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Submit Button Text</Label>
                            <Input
                                placeholder="e.g. Get Started"
                                value={editingForm?.submit_button_text || ""}
                                onChange={(e) => setEditingForm({ ...editingForm, submit_button_text: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Success Message</Label>
                            <Input
                                placeholder="e.g. Thanks for your interest! We'll be in touch."
                                value={editingForm?.success_message || ""}
                                onChange={(e) => setEditingForm({ ...editingForm, success_message: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                            Note: The form fields (Email, Name, Phone, Company) are fixed in this MVP version. You can customize the styling via CSS on your website.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving || !editingForm?.name}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Form"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Embed Dialog */}
            <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Embed Form: {selectedEmbed?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Copy this HTML snippet and place it anywhere on your website. Submissions will automatically create new Contacts in your CRM.
                        </p>
                        <div className="relative">
                            <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto border">
                                <code className="text-muted-foreground language-html">{`<form action="${baseUrl}/api/public/forms/${selectedEmbed?.id}/submit" method="POST" class="nanosol-form">
  <label>Email *</label>
  <input type="email" name="email" required />

  <label>First Name</label>
  <input type="text" name="first_name" />

  <label>Last Name</label>
  <input type="text" name="last_name" />

  <label>Phone</label>
  <input type="tel" name="phone" />

  <label>Company</label>
  <input type="text" name="company" />

  <button type="submit">${selectedEmbed?.submit_button_text || 'Submit'}</button>
</form>`}</code>
                            </pre>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => copyEmbedCode(selectedEmbed?.id || '')} className="w-full sm:w-auto">
                            {copied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {copied ? "Copied" : "Copy HTML"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
