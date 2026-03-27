"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { useCreateContact, useUpdateContact, useContactStatuses } from "@/hooks/use-data";
import type { Contact } from "@/types";
import { CallHistory } from "@/components/dashboard/dialer/call-history";
import { useDialerStore } from "@/lib/stores";

interface ContactFormData {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company: string;
    job_title: string;
    status: string;
}

interface ContactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contact?: Contact | null;
    organizationId: string;
    ownerId?: string;
    onSuccess?: () => void;
}

export function ContactDialog({
    open,
    onOpenChange,
    contact,
    organizationId,
    ownerId,
    onSuccess,
}: ContactDialogProps) {
    const isEditing = !!contact;
    const { trigger: createContact, isMutating: isCreating } = useCreateContact();
    const { trigger: updateContact, isMutating: isUpdating } = useUpdateContact();
    const { data: statuses } = useContactStatuses();

    // Dialer hooks for the activity tab
    const { setCurrentNumber, openDialer, startCall } = useDialerStore();

    const handleDial = async (number: string) => {
        setCurrentNumber(number);
        openDialer();
        const { SipService } = await import("@/lib/services/sip-service");
        SipService.getInstance().call(number);
        startCall();
        // Optional: close the dialog when calling
        onOpenChange(false);
    };

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        control,
        formState: { errors },
    } = useForm<ContactFormData>({
        defaultValues: contact
            ? {
                first_name: contact.first_name,
                last_name: contact.last_name || "",
                email: contact.email || "",
                phone: contact.phone || "",
                company: contact.company || "",
                job_title: contact.job_title || "",
                status: contact.status || "new",
            }
            : {
                first_name: "",
                last_name: "",
                email: "",
                phone: "",
                company: "",
                job_title: "",
                status: "new",
            },
    });

    const watchedStatus = useWatch({
        control,
        name: "status",
    });

    useEffect(() => {
        if (contact) {
            reset({
                first_name: contact.first_name,
                last_name: contact.last_name || "",
                email: contact.email || "",
                phone: contact.phone || "",
                company: contact.company || "",
                job_title: contact.job_title || "",
                status: contact.status || "new",
            });
        } else {
            reset({
                first_name: "",
                last_name: "",
                email: "",
                phone: "",
                company: "",
                job_title: "",
                status: "new",
            });
        }
    }, [contact, reset]);

    const onSubmit = async (data: ContactFormData) => {
        try {
            if (isEditing && contact) {
                await updateContact({
                    id: contact.id,
                    updates: {
                        ...data,
                    },
                });
                toast.success("Contact updated successfully");
            } else {
                if (!organizationId) {
                    toast.error("Organization ID is missing.");
                    return;
                }
                await createContact({
                    ...data,
                    organization_id: organizationId,
                    owner_id: ownerId, // Automatically assign to the current agent creating the contact
                    tags: [],
                    custom_fields: {},
                });
                toast.success("Contact created successfully");
            }
            reset();
            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error("Error saving contact:", error);
            const errorObj = error as { message?: string; details?: string };
            const errorMessage = errorObj.message || errorObj.details || "Failed to save contact";
            toast.error(`Error: ${errorMessage}`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Edit Contact" : "Add New Contact"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update the contact's information."
                            : "Fill in the details to create a new contact."}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="details" className="w-full">
                    {isEditing && (
                        <div className="mb-4">
                            <TabsList className="w-full grid grid-cols-2">
                                <TabsTrigger value="details">Details</TabsTrigger>
                                <TabsTrigger value="activity">Activity</TabsTrigger>
                            </TabsList>
                        </div>
                    )}

                    <TabsContent value="details" className="mt-0">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name">First Name *</Label>
                                    <Input
                                        id="first_name"
                                        {...register("first_name", { required: "First name is required" })}
                                        placeholder="John"
                                    />
                                    {errors.first_name && (
                                        <p className="text-xs text-destructive">
                                            {errors.first_name.message}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name">Last Name</Label>
                                    <Input
                                        id="last_name"
                                        {...register("last_name")}
                                        placeholder="Smith"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    {...register("email", {
                                        pattern: {
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                            message: "Invalid email address",
                                        },
                                    })}
                                    placeholder="john@company.com"
                                />
                                {errors.email && (
                                    <p className="text-xs text-destructive">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    {...register("phone")}
                                    placeholder="+1 (555) 123-4567"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company">Company</Label>
                                    <Input
                                        id="company"
                                        {...register("company")}
                                        placeholder="Acme Inc"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="job_title">Job Title</Label>
                                    <Input
                                        id="job_title"
                                        {...register("job_title")}
                                        placeholder="CEO"
                                    />
                                </div>
                            </div>

                             <div className="space-y-2">
                                 <Label htmlFor="status">Status</Label>
                                 <Select
                                     value={watchedStatus}
                                     onValueChange={(value) => setValue("status", value)}
                                 >
                                     <SelectTrigger>
                                         <SelectValue placeholder="Select status" />
                                     </SelectTrigger>
                                     <SelectContent>
                                         <ScrollArea className="h-[200px]">
                                             <div className="p-1">
                                                 {statuses?.map((s) => (
                                                     <SelectItem key={s.id} value={s.name.toLowerCase()}>
                                                         {s.label}
                                                     </SelectItem>
                                                 ))}
                                             </div>
                                         </ScrollArea>
                                     </SelectContent>
                                 </Select>
                             </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isCreating || isUpdating}>
                                    {isCreating || isUpdating
                                        ? "Saving..."
                                        : isEditing
                                            ? "Update Contact"
                                            : "Create Contact"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="activity" className="mt-0 outline-none">
                        <div className="h-[432px] md:h-[500px] overflow-y-auto pr-2 -mr-2">
                            {contact && (
                                <CallHistory
                                    contactId={contact.id}
                                    onDial={handleDial}
                                />
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
