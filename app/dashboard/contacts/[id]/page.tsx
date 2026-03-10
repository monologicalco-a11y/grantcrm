"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    ArrowLeft,
    Mail,
    Phone,
    Building2,
    Calendar,
    CheckSquare,
    DollarSign,
    History,
    FileText,
    MessageSquare,
    MoreHorizontal,
    Edit2,
    Send,
    Plus
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { LeadScoreBadge } from "@/components/contacts/lead-score-badge";
import { createClient } from "@/lib/supabase/client";
import { useActiveProfile } from "@/hooks/use-data";
import { toast } from "sonner";
import { Contact, Deal, Task } from "@/types";
import { Loader2, Sparkles } from "lucide-react";

interface Activity {
    id: string;
    type: string;
    title: string;
    description: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
}

function getInitials(firstName: string, lastName?: string | null) {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

export default function ContactDetailPage() {
    const params = useParams();
    const router = useRouter();
    const contactId = params.id as string;
    const { data: profile } = useActiveProfile();
    const supabase = createClient();

    const [contact, setContact] = useState<Contact | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [noteContent, setNoteContent] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isScoring, setIsScoring] = useState(false);

    const handleScoreContact = async () => {
        if (isScoring) return;
        setIsScoring(true);
        try {
            const response = await fetch('/api/contacts/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId })
            });
            const result = await response.json();

            if (result.success) {
                toast.success(`Lead score updated to ${result.score}`);
                setContact(prev => prev ? { ...prev, lead_score: result.score, score_reason: result.reason } : null);
            } else {
                toast.error(result.error || "Failed to score contact");
            }
        } catch (error) {
            toast.error("Failed to score contact");
        } finally {
            setIsScoring(false);
        }
    };

    useEffect(() => {
        if (!profile?.organization_id || !contactId) return;

        async function fetchContactData() {
            setLoading(true);

            // 1. Fetch Contact
            const { data: contactData } = await supabase
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .eq('organization_id', profile!.organization_id)
                .single();

            if (contactData) setContact(contactData);

            // 2. Fetch Activities (Timeline)
            const { data: activityData } = await supabase
                .from('activities')
                .select('*, created_by_profile:profiles(full_name, avatar_url)')
                .eq('contact_id', contactId)
                .order('created_at', { ascending: false });

            if (activityData) setActivities(activityData);

            // 3. Fetch Deals
            const { data: dealsData } = await supabase
                .from('deals')
                .select('*')
                .eq('contact_id', contactId)
                .order('created_at', { ascending: false });

            if (dealsData) setDeals(dealsData);

            // 4. Fetch Tasks
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('*, assigned_to_profile:profiles(full_name)')
                .eq('contact_id', contactId)
                .order('due_date', { ascending: true });

            if (tasksData) setTasks(tasksData);

            setLoading(false);
        }

        fetchContactData();
    }, [contactId, profile, supabase]);

    const handleAddNote = async () => {
        if (!noteContent.trim() || !profile?.organization_id) return;
        setIsSavingNote(true);

        const { data, error } = await supabase
            .from('activities')
            .insert({
                organization_id: profile.organization_id,
                contact_id: contactId,
                type: 'note',
                title: 'Note added',
                description: noteContent,
                created_by: profile.id
            })
            .select('*, created_by_profile:profiles(full_name, avatar_url)')
            .single();

        if (error) {
            toast.error("Failed to save note");
        } else if (data) {
            toast.success("Note added");
            setActivities([data, ...activities]);
            setNoteContent("");
        }
        setIsSavingNote(false);
    };

    if (loading) {
        return <div className="p-8 space-y-4 animate-pulse">
            <div className="h-24 bg-muted rounded-lg"></div>
            <div className="h-64 bg-muted rounded-lg"></div>
        </div>;
    }

    if (!contact) {
        return <div className="p-8 text-center text-muted-foreground">
            <h2>Contact not found</h2>
            <Button variant="link" onClick={() => router.push('/dashboard/contacts')}>Back to contacts</Button>
        </div>;
    }

    return (
        <div className="flex flex-col gap-6 p-4 max-w-6xl mx-auto">
            {/* Top Navigation */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/contacts')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <span>Contacts</span>
                <span>/</span>
                <span className="text-foreground">{contact.first_name} {contact.last_name}</span>
            </div>

            {/* Header Profile Card */}
            <Card>
                <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarFallback className="text-2xl">
                                {getInitials(contact.first_name, contact.last_name)}
                            </AvatarFallback>
                        </Avatar>

                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">
                                {contact.first_name} {contact.last_name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground py-1">
                                {contact.job_title && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="h-4 w-4" />
                                        {contact.job_title} {contact.company ? `at ${contact.company}` : ''}
                                    </span>
                                )}
                                {contact.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-4 w-4" />
                                        <a href={`mailto:${contact.email}`} className="hover:underline text-primary">{contact.email}</a>
                                    </span>
                                )}
                                {contact.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-4 w-4" />
                                        <a href={`tel:${contact.phone}`} className="hover:underline text-primary">{contact.phone}</a>
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <LeadScoreBadge score={contact.lead_score || 0} reason={contact.score_reason} />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                                    onClick={handleScoreContact}
                                    disabled={isScoring}
                                >
                                    {isScoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                    Score Now
                                </Button>
                                {contact.tags?.map(tag => (
                                    <Badge key={tag} variant="secondary">{tag}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-4 md:mt-0 w-full md:w-auto">
                        <div className="flex gap-2">
                            <Button className="flex-1 md:flex-none">
                                <Mail className="mr-2 h-4 w-4" /> Email
                            </Button>
                            <Button variant="outline" className="flex-1 md:flex-none">
                                <Phone className="mr-2 h-4 w-4" /> Call
                            </Button>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground text-right mt-2">
                            Added {format(new Date(contact.created_at), 'MMM d, yyyy')}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Main Content Tabs */}
            <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
                    <TabsTrigger value="timeline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                        <History className="mr-2 h-4 w-4" /> Timeline
                    </TabsTrigger>
                    <TabsTrigger value="deals" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                        <DollarSign className="mr-2 h-4 w-4" /> Deals ({deals.length})
                    </TabsTrigger>
                    <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                        <CheckSquare className="mr-2 h-4 w-4" /> Tasks ({tasks.filter(t => t.status !== 'completed').length})
                    </TabsTrigger>
                    <TabsTrigger value="info" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
                        <FileText className="mr-2 h-4 w-4" /> Details
                    </TabsTrigger>
                </TabsList>

                {/* TIMELINE TAB */}
                <TabsContent value="timeline" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left Column: Timeline Feed */}
                        <div className="md:col-span-2 space-y-6">

                            {/* Note Composer */}
                            <Card>
                                <CardContent className="p-4 flex flex-col gap-3">
                                    <Textarea
                                        placeholder="Take a note... (Press Cmd+Enter to save)"
                                        className="min-h-[100px] resize-none border-none focus-visible:ring-0 bg-muted/50"
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                handleAddNote();
                                            }
                                        }}
                                    />
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs text-muted-foreground flex items-center">
                                            <Edit2 className="h-3 w-3 mr-1" /> Rich text supported
                                        </div>
                                        <Button size="sm" onClick={handleAddNote} disabled={!noteContent.trim() || isSavingNote}>
                                            <Send className="mr-2 h-3 w-3" /> Save Note
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Feed */}
                            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                {activities.length === 0 && (
                                    <div className="text-center p-8 text-muted-foreground border rounded-lg border-dashed">
                                        No activities logged yet.
                                    </div>
                                )}
                                {activities.map((activity) => (
                                    <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                                            {activity.type === 'note' && <MessageSquare className="h-4 w-4" />}
                                            {activity.type === 'call' && <Phone className="h-4 w-4" />}
                                            {activity.type === 'email' && <Mail className="h-4 w-4" />}
                                            {activity.type === 'meeting' && <Calendar className="h-4 w-4" />}
                                            {activity.type === 'system' && <History className="h-4 w-4" />}
                                            {activity.type === 'task' && <CheckSquare className="h-4 w-4" />}
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-semibold text-sm">{activity.title}</div>
                                                <div className="text-xs text-muted-foreground">{format(new Date(activity.created_at), 'MMM d, h:mm a')}</div>
                                            </div>
                                            {activity.description && (
                                                <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                                                    {activity.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column: Widgets */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Upcoming Tasks</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {tasks.filter(t => t.status !== 'completed').slice(0, 3).map(task => (
                                        <div key={task.id} className="flex gap-3 text-sm">
                                            <div className="mt-0.5">
                                                <div className="h-4 w-4 rounded border flex items-center justify-center"></div>
                                            </div>
                                            <div>
                                                <p className="font-medium">{task.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Due {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'No date'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {tasks.filter(t => t.status !== 'completed').length === 0 && (
                                        <p className="text-xs text-muted-foreground">No upcoming tasks.</p>
                                    )}
                                    <Button variant="link" className="p-0 h-auto text-xs" onClick={() => {
                                        const tabs = document.querySelector('[role="tablist"]') as HTMLElement;
                                        if (tabs) {
                                            const tasksTab = Array.from(tabs.querySelectorAll('button')).find(b => b.textContent?.includes('Tasks'));
                                            tasksTab?.click();
                                        }
                                    }}>View all tasks</Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').slice(0, 3).map(deal => (
                                        <div key={deal.id} className="flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-medium">{deal.name}</p>
                                                <p className="text-xs text-muted-foreground">{deal.stage}</p>
                                            </div>
                                            <div className="font-medium">
                                                ${deal.value?.toLocaleString() || '0'}
                                            </div>
                                        </div>
                                    ))}
                                    {deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').length === 0 && (
                                        <p className="text-xs text-muted-foreground">No active deals.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* DEALS TAB */}
                <TabsContent value="deals" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Deals</CardTitle>
                                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Deal</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {deals.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">No deals associated with this contact.</div>
                            ) : (
                                <div className="space-y-4">
                                    {deals.map(deal => (
                                        <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <div>
                                                <div className="font-medium">{deal.name}</div>
                                                <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                                                    <span>Stage: {deal.stage}</span>
                                                    <span>•</span>
                                                    <span>Probability: {deal.probability}%</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">${deal.value?.toLocaleString()}</div>
                                                {deal.expected_close_date && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Close: {format(new Date(deal.expected_close_date), 'MMM d, yyyy')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TASKS TAB */}
                <TabsContent value="tasks" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Tasks</CardTitle>
                                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> New Task</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {tasks.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">No tasks associated with this contact.</div>
                            ) : (
                                <div className="space-y-2">
                                    {tasks.map(task => (
                                        <div key={task.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <CheckSquare className={cn("h-5 w-5", task.status === 'completed' ? "text-primary" : "text-muted-foreground")} />
                                            <div className="flex-1">
                                                <div className={cn("font-medium", task.status === 'completed' && "line-through text-muted-foreground")}>{task.title}</div>
                                                <div className="text-xs text-muted-foreground flex gap-3">
                                                    {task.due_date && <span>Due: {format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}</span>}
                                                    {task.priority && <span>Priority: <span className="capitalize">{task.priority}</span></span>}
                                                </div>
                                            </div>
                                            {task.status !== 'completed' && (
                                                <Button size="sm" variant="outline">Mark Done</Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* INFO TAB */}
                <TabsContent value="info" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Contact Details</CardTitle>
                                <Button size="sm" variant="outline"><Edit2 className="h-4 w-4 mr-2" /> Edit</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">First Name</h4>
                                <p>{contact.first_name || '-'}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Last Name</h4>
                                <p>{contact.last_name || '-'}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Email</h4>
                                <p>{contact.email || '-'}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Phone</h4>
                                <p>{contact.phone || '-'}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Company</h4>
                                <p>{contact.company || '-'}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Job Title</h4>
                                <p>{contact.job_title || '-'}</p>
                            </div>
                            <div className="md:col-span-2 mt-4 pt-4 border-t">
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Custom Fields</h4>
                                {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(contact.custom_fields).map(([key, value]) => (
                                            <div key={key}>
                                                <h5 className="text-xs font-medium text-muted-foreground capitalize mb-1">{key.replace(/_/g, ' ')}</h5>
                                                <p className="text-sm">{String(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No custom fields defined.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

