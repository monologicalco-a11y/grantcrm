"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Play, Pause, Volume2, VolumeX, Hash, PhoneForwarded, PhoneOff, FileAudio } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useWaveform } from "@/hooks/use-waveform";
import { VoicemailUpload } from "./voicemail-upload";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface Contact {
    first_name: string;
    last_name?: string | null;
    company?: string | null;
}

interface ActiveCallProps {
    contact: Contact | null;
    status: string;
    duration: string;
    isMuted: boolean;
    onMuteToggle: () => void;
    isOnHold: boolean;
    onHoldToggle: () => void;
    isSpeakerOn: boolean;
    onSpeakerToggle: () => void;
    showKeypad: boolean;
    onKeypadToggle: () => void;
    onHangup: () => void;
}

export const ActiveCall = ({
    contact,
    status,
    duration,
    isMuted,
    onMuteToggle,
    isOnHold,
    onHoldToggle,
    isSpeakerOn,
    onSpeakerToggle,
    showKeypad,
    onKeypadToggle,
    onHangup
}: ActiveCallProps) => {
    const [stream, setStream] = React.useState<MediaStream | null>(null);
    React.useEffect(() => {
        const getStream = async () => {
            const { SipService } = await import("@/lib/services/sip-service");
            setStream(SipService.getInstance().remoteStream);
        };
        getStream();
    }, []);
    const volumes = useWaveform(stream, status === "active", 20);
    const [voicemailFile, setVoicemailFile] = useState<File | null>(null);
    const [isDropping, setIsDropping] = useState(false);
    const [quality, setQuality] = useState<"good" | "fair" | "poor" | "unknown">("unknown");

    useEffect(() => {
        const handleQuality = (e: CustomEvent<{ quality: "good" | "fair" | "poor" | "unknown" }>) => {
            if (e.detail?.quality) setQuality(e.detail.quality);
        };
        window.addEventListener("sip:call:quality", handleQuality as EventListener);
        return () => window.removeEventListener("sip:call:quality", handleQuality as EventListener);
    }, []);

    const handleDTMF = async (key: string) => {
        try {
            const { SipService } = await import("@/lib/services/sip-service");
            await SipService.getInstance().sendDTMF(key);
            // Optional: Play local DTMF sound here if desired
        } catch (error) {
            console.error("Failed to send DTMF", error);
        }
    };

    const handleVoicemailDrop = async () => {
        if (!voicemailFile) {
            toast.error("Please upload a voicemail file first");
            return;
        }

        try {
            setIsDropping(true);
            toast.success("Dropping voicemail...");
            const { SipService } = await import("@/lib/services/sip-service");
            await SipService.getInstance().injectVoicemail(voicemailFile);
        } catch (error) {
            console.error("Voicemail drop failed", error);
            setIsDropping(false);
        }
    };

    return (
        <div className="space-y-6 flex flex-col items-center py-4">
            {/* Visualizer */}
            <div className="w-full h-24 flex items-center justify-center gap-1.5 px-10">
                {volumes.map((vol, i) => (
                    <motion.div
                        key={i}
                        className={cn(
                            "w-1.5 bg-primary/40 rounded-full",
                            status === "active" ? "bg-primary" : "bg-muted-foreground/30 h-1"
                        )}
                        initial={{ height: "4px" }}
                        animate={{ height: status === "active" ? `${vol}%` : "4px" }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                ))}
            </div>

            <div className="text-center">
                <p className="text-xl font-bold">{contact?.first_name || "Unknown"} {contact?.last_name || ""}</p>
                <p className="text-sm text-muted-foreground">{contact?.company || "Outbound Call"}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                    <span className={cn(
                        "h-2 w-2 rounded-full",
                        status === "active" ? "bg-green-500 animate-pulse" : "bg-yellow-500"
                    )} />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {status} • {duration}
                    </span>
                    {status === "active" && quality !== "unknown" && (
                        <div className="flex items-center ml-1" title={`Network Quality: ${quality}`}>
                            <div className="flex items-end gap-[1px] h-3 w-3">
                                <div className={cn("w-[3px] rounded-t-sm", quality === "poor" ? "bg-red-500 h-[30%]" : quality === "fair" ? "bg-yellow-500 h-[30%]" : "bg-green-500 h-[30%]")} />
                                <div className={cn("w-[3px] rounded-t-sm", quality === "poor" ? "bg-muted h-[60%]" : quality === "fair" ? "bg-yellow-500 h-[60%]" : "bg-green-500 h-[60%]")} />
                                <div className={cn("w-[3px] rounded-t-sm", quality === "poor" ? "bg-muted h-full" : quality === "fair" ? "bg-muted h-full" : "bg-green-500 h-full")} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full px-6">
                <CallControlButton
                    icon={isMuted ? MicOff : Mic}
                    label={isMuted ? "Unmute" : "Mute"}
                    active={isMuted}
                    onClick={onMuteToggle}
                    variant={isMuted ? "destructive" : "outline"}
                />
                <CallControlButton
                    icon={isOnHold ? Play : Pause}
                    label={isOnHold ? "Resume" : "Hold"}
                    active={isOnHold}
                    onClick={onHoldToggle}
                />
                <CallControlButton
                    icon={isSpeakerOn ? Volume2 : VolumeX}
                    label="Speaker"
                    active={isSpeakerOn}
                    onClick={onSpeakerToggle}
                />
                <CallControlButton
                    icon={Hash}
                    label="Keypad"
                    active={showKeypad}
                    onClick={onKeypadToggle}
                />
                <CallControlButton
                    icon={PhoneForwarded}
                    label="Transfer"
                    onClick={() => { }}
                />
            </div>

            <div className="pt-2 w-full px-6 flex flex-col items-center">
                <VoicemailUpload file={voicemailFile} onUpload={setVoicemailFile} />

                <AnimatePresence>
                    {voicemailFile && status === "active" && !isDropping && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="w-full mb-4"
                        >
                            <Button
                                variant="secondary"
                                className="w-full bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 shadow-sm"
                                onClick={handleVoicemailDrop}
                            >
                                <FileAudio className="mr-2 h-4 w-4" />
                                Drop Voicemail
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showKeypad && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="w-full mt-4"
                        >
                            <div className="grid grid-cols-3 gap-3 p-4 bg-muted/20 rounded-2xl border border-white/5">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                                    <Button
                                        key={key}
                                        variant="ghost"
                                        className="h-12 text-xl font-medium bg-background/50 hover:bg-primary/20 rounded-xl"
                                        onClick={() => handleDTMF(key)}
                                    >
                                        {key}
                                    </Button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="pt-2 w-full px-6">
                <Button
                    variant="destructive"
                    className="w-full h-14 rounded-2xl shadow-lg shadow-red-500/20 text-lg font-semibold hover:scale-[1.02] transition-transform"
                    onClick={onHangup}
                >
                    <PhoneOff className="mr-2 h-6 w-6" />
                    End Call
                </Button>
            </div>
        </div>
    );
};

interface ControlButtonProps {
    icon: React.ElementType;
    label: string;
    active?: boolean;
    onClick: () => void;
    variant?: "outline" | "destructive" | "default" | "secondary" | "ghost" | "link";
}

const CallControlButton = ({ icon: Icon, label, active, onClick, variant = "outline" }: ControlButtonProps) => (
    <div className="flex flex-col items-center gap-1.5">
        <Button
            variant={variant}
            size="icon"
            className={cn(
                "h-14 w-14 rounded-2xl transition-all shadow-sm",
                active && variant === "outline" && "bg-primary/10 border-primary text-primary"
            )}
            onClick={onClick}
            title={label}
        >
            <Icon className="h-6 w-6" />
        </Button>
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
);
