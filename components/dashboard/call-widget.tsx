"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Phone,
    X,
    Minimize2,
    Pause,
    Play,
    SkipForward,
    Square,
    Clock,
    History as HistoryIcon,
    LayoutGrid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useDialerStore } from "@/lib/stores";
import { SipService } from "@/lib/services/sip-service";
import { useContactsPaginated, useContactByPhone } from "@/hooks/use-data";
import { useDebounce } from "@/hooks/use-debounce";

// Sub-components
import { DialerPad } from "./dialer/dialer-pad";
import { ActiveCall } from "./dialer/active-call";
import { CallHistory } from "./dialer/call-history";

const StatusBadge = ({ sipStatus }: { sipStatus: string }) => {
    const statusMap: Record<string, { color: string; label: string }> = {
        connected: { color: "bg-green-500", label: "Ready" },
        connecting: { color: "bg-yellow-500 animate-pulse", label: "Connecting" },
        disconnected: { color: "bg-red-500", label: "Offline" },
        error: { color: "bg-red-600", label: "Error" },
    };
    const s = statusMap[sipStatus] || statusMap.disconnected;
    return (
        <Badge variant="outline" className="h-5 gap-1.5 px-2 border-muted/50 bg-muted/20">
            <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
        </Badge>
    );
};

export function CallWidget() {
    const {
        isOpen,
        isInCall,
        currentNumber,
        callStatus,
        callDuration,
        closeDialer,
        openDialer,
        setCurrentNumber,
        startCall,
        autoDialerActive,
        isAutoDialerPaused,
        toggleAutoDialerPause,
        terminateAutoDialer,
        skipCurrent,
        nextAutoDialNumber,
        updateQueueStatus,
        stopAutoDialer,
        autoDialerQueue,
    } = useDialerStore();

    const { data: contact } = useContactByPhone(currentNumber || null);

    // Auto-dialer loop: trigger next call when queue is active and not in call
    const autoDialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Clear any pending timeout when dependencies change
        if (autoDialTimeoutRef.current) {
            clearTimeout(autoDialTimeoutRef.current);
            autoDialTimeoutRef.current = null;
        }

        // Only proceed if auto-dialer is active, not paused, and not in a call
        if (!autoDialerActive || isAutoDialerPaused || isInCall) {
            return;
        }

        // Check for pending items in queue
        const pendingItems = autoDialerQueue.filter(q => !q.lastStatus);
        if (pendingItems.length === 0) {
            // Queue exhausted, stop auto-dialer
            stopAutoDialer();
            return;
        }

        // Add a small delay before dialing next number (gives user a moment)
        autoDialTimeoutRef.current = setTimeout(() => {
            const nextItem = nextAutoDialNumber();
            if (nextItem) {
                // Trigger the call
                setCurrentNumber(nextItem.number);
                startCall();
                SipService.getInstance().call(nextItem.number);
            }
        }, 1500); // 1.5 second delay between calls

        return () => {
            if (autoDialTimeoutRef.current) {
                clearTimeout(autoDialTimeoutRef.current);
            }
        };
    }, [autoDialerActive, isAutoDialerPaused, isInCall, autoDialerQueue, nextAutoDialNumber, setCurrentNumber, startCall, stopAutoDialer]);


    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [isOnHold, setIsOnHold] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [durationDisplay, setDurationDisplay] = useState("00:00");
    const [showKeypad, setShowKeypad] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sipStatus, setSipStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
    const [recentCalls, setRecentCalls] = useState<Array<{ number: string; name?: string; time: Date; status: string }>>([]);

    const debouncedSearch = useDebounce(searchQuery, 300);
    const { data: searchResults } = useContactsPaginated({ search: debouncedSearch, limit: 5 });

    useEffect(() => {
        const interval = setInterval(() => {
            const sip = SipService.getInstance();
            setSipStatus(sip.isRegistered ? "connected" : sip.isConnected ? "connecting" : "disconnected");
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!isInCall) return;
        const interval = setInterval(() => {
            const mins = Math.floor(callDuration / 60);
            const secs = callDuration % 60;
            setDurationDisplay(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [isInCall, callDuration]);

    const handleCall = useCallback((numberOverride?: string) => {
        const target = numberOverride || currentNumber;
        if (target) {
            startCall();
            if (target !== currentNumber) setCurrentNumber(target);
            SipService.getInstance().call(target);
        }
    }, [currentNumber, startCall, setCurrentNumber]);

    const handleHangup = () => {
        // If in auto-dial mode, mark current as answered before hangup
        if (autoDialerActive && currentNumber) {
            updateQueueStatus(currentNumber, "answered");
        }
        SipService.getInstance().hangup();
    };

    const handleQuickDial = (phone: string) => {
        setCurrentNumber(phone);
        setSearchQuery("");
        handleCall(phone);
    };

    if (!isOpen) {
        return (
            <motion.button
                layoutId="dialer-bubble"
                className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-green-600 shadow-xl flex items-center justify-center text-white hover:bg-green-700 transition-colors"
                onClick={openDialer}
                title="Open Dialer"
            >
                <Phone className="h-6 w-6" />
                {sipStatus === "connected" && <span className="absolute top-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />}
            </motion.button>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                layoutId="dialer-container"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={cn(
                    "fixed bottom-6 right-6 z-50 bg-background/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden transition-all duration-500",
                    isMinimized ? "w-16 h-16 rounded-full" : "w-[380px] h-[600px] max-h-[90vh]"
                )}
            >
                {isMinimized ? (
                    <button
                        className="h-full w-full flex items-center justify-center"
                        onClick={() => setIsMinimized(false)}
                        title="Expand Dialer"
                    >
                        <Phone className="h-6 w-6 text-primary" />
                    </button>
                ) : (
                    <div className="h-full flex flex-col">
                        {/* Header */}
                        <div className={cn(
                            "px-5 py-4 flex items-center justify-between transition-all border-b border-white/5",
                            autoDialerActive ? "bg-primary/10" : "bg-transparent"
                        )}>
                            <div className="flex flex-col gap-1">
                                <h2 className="text-sm font-bold flex items-center gap-2">
                                    {autoDialerActive ? "Power Dialer" : "Cloud Communications"}
                                    {autoDialerActive && <Badge className="bg-primary hover:bg-primary h-4 px-1.5 text-[10px] uppercase">Auto</Badge>}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <StatusBadge sipStatus={sipStatus} />
                                    {isInCall && (
                                        <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-mono text-muted-foreground border-white/10 bg-white/5">
                                            <Clock className="h-3 w-3 mr-1" /> {durationDisplay}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {autoDialerActive && (
                                    <div className="flex items-center mr-2 px-1.5 py-1 bg-muted/40 rounded-lg gap-1 border border-white/5">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-background/50" onClick={toggleAutoDialerPause} title="Pause">
                                            {isAutoDialerPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-background/50" onClick={skipCurrent} title="Skip">
                                            <SkipForward className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:text-destructive" onClick={terminateAutoDialer} title="Stop">
                                            <Square className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted/50" onClick={() => setIsMinimized(true)} title="Minimize">
                                    <Minimize2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={closeDialer} title="Close">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-5 pb-6 scrollbar-hide">
                            {isInCall ? (
                                <ActiveCall
                                    contact={contact ? {
                                        first_name: contact.first_name,
                                        last_name: contact.last_name ?? "",
                                        company: contact.company ?? ""
                                    } : null}
                                    status={callStatus}
                                    duration={durationDisplay}
                                    isMuted={isMuted}
                                    onMuteToggle={() => {
                                        const n = !isMuted;
                                        setIsMuted(n);
                                        SipService.getInstance().mute(n);
                                    }}
                                    isOnHold={isOnHold}
                                    onHoldToggle={() => setIsOnHold(!isOnHold)}
                                    isSpeakerOn={isSpeakerOn}
                                    onSpeakerToggle={() => setIsSpeakerOn(!isSpeakerOn)}
                                    showKeypad={showKeypad}
                                    onKeypadToggle={() => setShowKeypad(!showKeypad)}
                                    onHangup={handleHangup}
                                />
                            ) : (
                                <Tabs defaultValue="dial" className="w-full mt-4">
                                    <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 mb-6 rounded-xl border border-white/5">
                                        <TabsTrigger value="dial" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                            <LayoutGrid className="h-4 w-4 mr-2" /> Dialer
                                        </TabsTrigger>
                                        <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                            <HistoryIcon className="h-4 w-4 mr-2" /> History
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="dial" className="mt-0 outline-none">
                                        <DialerPad
                                            currentNumber={currentNumber}
                                            onNumberChange={setCurrentNumber}
                                            onKeyPress={(k) => setCurrentNumber(currentNumber + k)}
                                            searchQuery={searchQuery}
                                            onSearchChange={setSearchQuery}
                                            searchResults={(searchResults?.data || []).map(c => ({
                                                id: c.id,
                                                first_name: c.first_name,
                                                last_name: c.last_name ?? "",
                                                phone: c.phone ?? "",
                                                company: c.company ?? ""
                                            }))}
                                            onQuickDial={handleQuickDial}
                                        />
                                        <div className="mt-6 flex justify-center">
                                            <Button
                                                className="w-full h-14 rounded-2xl bg-green-600 text-white text-lg font-semibold shadow-lg shadow-green-600/20 hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                onClick={() => handleCall()}
                                                disabled={!currentNumber || sipStatus !== "connected"}
                                            >
                                                <Phone className="mr-3 h-6 w-6" /> Dial Number
                                            </Button>
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="history" className="mt-0 outline-none">
                                        <CallHistory
                                            calls={recentCalls}
                                            onDial={handleQuickDial}
                                            onClear={() => setRecentCalls([])}
                                        />
                                    </TabsContent>
                                </Tabs>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
