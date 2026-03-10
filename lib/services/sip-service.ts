/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

// Use any for dependencies and types to avoid SSR type issues or missing deep imports
import { useDialerStore } from "@/lib/stores";
import { toast } from "sonner";

let _JsSIP: any = null;
let _JanusUA: any = null;

interface SipConfig {
    uri: string;
    password?: string;
    auth_user?: string;
    protocol?: string;
    ws_servers: string | string[];
    display_name?: string;
    outbound_proxy?: string;
    registrar_server?: string;
    sip_domain?: string;
    janus_url?: string;
    janus_secret?: string;
}

// Declare global type for window storage
declare global {
    interface Window {
        __SIP_SERVICE__?: SipService;
    }
}

export class SipService {
    private uas: Map<string, any> = new Map();
    private sessions: Map<string, any> = new Map();
    private _activeUAId: string | null = null;
    private _isConnected: Map<string, boolean> = new Map();
    private _isRegistered: Map<string, boolean> = new Map();
    private _isHangingUp: boolean = false;
    private _remoteStream: any = null;

    private constructor() { }

    public static getInstance(): SipService {
        if (typeof window !== "undefined") {
            // Lazy load dependencies to fix SSR Next.js prerender
            Promise.all([
                import("jssip"),
                import("@/lib/janus/janus-ua")
            ]).then(([jssipMod, janusMod]) => {
                _JsSIP = (jssipMod as any).defaultOptions ? jssipMod : (jssipMod as any).default || jssipMod;
                _JanusUA = (janusMod as any).JanusUA;
                if (typeof _JsSIP.debug !== "undefined") _JsSIP.debug.enable('JsSIP:*');
            }).catch(e => console.error("Failed to load SIP deps", e));

            if (!window.__SIP_SERVICE__) {
                window.__SIP_SERVICE__ = new SipService();
            }
            return window.__SIP_SERVICE__;
        }
        return new SipService();
    }

    public get activeUAId() { return this._activeUAId; }
    public set activeUAId(id: string | null) { this._activeUAId = id; }

    public isConnected(id?: string) {
        const targetId = id || this._activeUAId;
        return targetId ? (this._isConnected.get(targetId) || false) : false;
    }

    public isRegistered(id?: string) {
        const targetId = id || this._activeUAId;
        return targetId ? (this._isRegistered.get(targetId) || false) : false;
    }

    public hasUA(id?: string) {
        const targetId = id || this._activeUAId;
        return targetId ? this.uas.has(targetId) : this.uas.size > 0;
    }

    public get remoteStream() { return this._remoteStream; }

    public async connect(config: SipConfig, id: string = "default") {
        if (typeof window === "undefined") return;

        // If already connected for this ID, don't re-connect
        if (this.uas.has(id) && this._isConnected.get(id)) return;

        // Special handling for demo mode - don't attempt real SIP connection
        if (config.uri.includes("demo.local") || id === "demo" || id === "default") {
            console.log(`[SIP] Entering demo mode for account ${id}`);
            this.enableDemoMode(id);
            if (!this._activeUAId) this._activeUAId = id;
            return;
        }

        // --- Universal Janus Bridge Implementation ---
        const bridgeUrl = config.janus_url || "wss://sip.nanocall.space:8989";
        try {
            console.log(`[SIP] Connecting via Janus Bridge for ${id}: ${bridgeUrl}`);
            const { JanusUA: JanusUAImpl } = await import("@/lib/janus/janus-ua");
            const janusUa = new JanusUAImpl({
                uri: config.uri,
                password: config.password,
                auth_user: config.auth_user,
                display_name: config.display_name,
                janus_url: bridgeUrl,
                janus_secret: config.janus_secret,
                proxy: config.registrar_server || config.sip_domain
            }) as any;

            this.uas.set(id, janusUa);
            this.setupJanusHandlers(id, janusUa);
            await janusUa.register();

            if (!this._activeUAId) this._activeUAId = id;
            return;
        } catch (err) {
            console.error(`[SIP] Janus connection failed for ${id}:`, err);
            toast.error("Failed to connect to Janus Bridge");
            return;
        }

    }

    public disconnect(id?: string) {
        if (id) {
            const ua = this.uas.get(id);
            if (ua) {
                ua.stop();
                this.uas.delete(id);
            }
            this._isConnected.delete(id);
            this._isRegistered.delete(id);
            this.sessions.delete(id);
            if (this._activeUAId === id) this._activeUAId = null;
        } else {
            // Disconnect all
            this.uas.forEach((ua) => ua.stop());
            this.uas.clear();
            this._isConnected.clear();
            this._isRegistered.clear();
            this.sessions.clear();
            this._activeUAId = null;
        }
        this._remoteStream = null;
    }

    public async injectVoicemail(file: File) {
        const ua = this._activeUAId ? this.uas.get(this._activeUAId) : null;
        if (ua && 'injectAudioFile' in ua && typeof ua.injectAudioFile === 'function') {
            await (ua as any).injectAudioFile(file);
        } else {
            console.warn("[SIP] Voicemail drop is only supported on the Janus engine");
            toast.error("Voicemail drop requires active cloud engine setup");
        }
    }

    public call(target: string, accountId?: string) {
        const id = accountId || this._activeUAId;
        const ua = id ? this.uas.get(id) : null;
        const registered = id ? this._isRegistered.get(id) : false;

        if (!ua || !registered) {
            console.warn(`[SIP] Cannot place call: Account ${id} not ready. Falling back to simulation.`);
            this.simulateCall();
            return;
        }

        if (_JanusUA && ua instanceof _JanusUA) {
            // Ensure remote audio element exists for WebRTC audio playback
            let remoteAudio = document.getElementById("sip-remote-audio") as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
            if (!remoteAudio) {
                remoteAudio = document.createElement("audio") as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
                remoteAudio.id = "sip-remote-audio";
                remoteAudio.autoplay = true;
                document.body.appendChild(remoteAudio);
            }

            const { selectedMicrophoneId, selectedSpeakerId } = useDialerStore.getState();
            if (selectedSpeakerId && typeof remoteAudio.setSinkId === "function") {
                remoteAudio.setSinkId(selectedSpeakerId).catch(console.error);
            }

            ua.call(target, selectedMicrophoneId || undefined);
            return;
        }

        let remoteAudio = document.getElementById("sip-remote-audio") as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
        if (!remoteAudio) {
            remoteAudio = document.createElement("audio") as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
            remoteAudio.id = "sip-remote-audio";
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
        }

        const eventHandlers = {
            progress: () => useDialerStore.getState().setCallStatus("ringing"),
            failed: (e: { cause: string }) => {
                if (this._isHangingUp) {
                    this._isHangingUp = false;
                    useDialerStore.getState().endCall();
                    return;
                }

                // Map JsSIP causes to standard statuses
                let status: "failed" | "busy" | "rejected" | "no-answer" = "failed";
                const cause = e.cause;

                if (cause === _JsSIP.C.causes.BUSY) status = "busy";
                else if (cause === _JsSIP.C.causes.REJECTED) status = "rejected";
                else if (cause === _JsSIP.C.causes.NO_ANSWER || cause === _JsSIP.C.causes.REQUEST_TIMEOUT) status = "no-answer";

                console.log(`[SIP] Call failed: ${cause} -> mapping to ${status}`);

                window.dispatchEvent(new CustomEvent("sip:call:failed", { detail: { ...e, mappedStatus: status } }));

                // Update queue if auto-dialer is active
                const store = useDialerStore.getState();
                if (store.autoDialerActive && store.currentNumber) {
                    store.updateQueueStatus(store.currentNumber, status);
                }

                useDialerStore.getState().endCall();
            },
            ended: () => {
                const id = accountId || this._activeUAId;
                if (id) this.sessions.delete(id);
                useDialerStore.getState().endCall();
            },
            confirmed: () => {
                useDialerStore.getState().setCallStatus("active");
            },
            peerconnection: (e: { peerconnection: RTCPeerConnection }) => {
                const peerconnection = e.peerconnection as RTCPeerConnection;
                peerconnection.ontrack = (event: RTCTrackEvent) => {
                    if (event.track.kind === "audio" && remoteAudio) {
                        this._remoteStream = event.streams[0];
                        remoteAudio.srcObject = this._remoteStream;
                        const { selectedSpeakerId } = useDialerStore.getState();
                        if (selectedSpeakerId && typeof remoteAudio.setSinkId === "function") {
                            remoteAudio.setSinkId(selectedSpeakerId).catch(console.error);
                        }
                        remoteAudio.play().catch(() => { });
                    }
                };
            }
        };

        const options = {
            eventHandlers,
            mediaConstraints: { audio: true, video: false },
            rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false }
        };

        try {
            console.log(`[SIP] Placing call from account ${id} to ${target}`);
            const session = (ua as any).call(target, options);
            this.sessions.set(id!, session);
        } catch (e) {
            console.error("Call error:", e);
            this.simulateCall();
        }
    }

    public async answer(jsepOffer?: RTCSessionDescriptionInit | undefined, accountId?: string) {
        const id = accountId || this._activeUAId;
        const session = id ? this.sessions.get(id) : null;

        const { selectedMicrophoneId, selectedSpeakerId } = useDialerStore.getState();
        const remoteAudio = document.getElementById("sip-remote-audio") as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };

        if (remoteAudio && selectedSpeakerId && typeof remoteAudio.setSinkId === "function") {
            remoteAudio.setSinkId(selectedSpeakerId).catch(console.error);
        }

        if (session && 'answer' in session && typeof session.answer === 'function' && jsepOffer) {
            await (session as any).answer(jsepOffer, selectedMicrophoneId || undefined);
        } else if (session) {
            (session as any).answer({
                mediaConstraints: { audio: selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true, video: false }
            });
        }
    }

    public async decline(accountId?: string) {
        const id = accountId || this._activeUAId;
        const session = id ? this.sessions.get(id) : null;
        if (session && 'decline' in session) {
            await (session as any).decline();
        } else if (session) {
            this.hangup(id || undefined);
        }
    }

    public hangup(accountId?: string) {
        const id = accountId || this._activeUAId;

        if (typeof document !== "undefined") {
            const remoteAudio = document.getElementById("sip-remote-audio") as HTMLAudioElement;
            if (remoteAudio) {
                remoteAudio.pause();
                remoteAudio.srcObject = null;
            }
        }
        this._remoteStream = null;

        const session = id ? this.sessions.get(id) : null;
        if (session) {
            try {
                this._isHangingUp = true;
                this.sessions.delete(id!);
                if ('hangup' in session) {
                    (session as any).hangup();
                } else {
                    (session as unknown as import('jssip/src/RTCSession').RTCSession).terminate();
                }
            } catch {
                this._isHangingUp = false;
            }
        }
        useDialerStore.getState().endCall();
    }

    public sendDTMF(tone: string, accountId?: string) {
        const id = accountId || this._activeUAId;
        const session = id ? this.sessions.get(id) : null;
        if (session) session.sendDTMF(tone);
    }

    public mute(isMuted: boolean, accountId?: string) {
        const id = accountId || this._activeUAId;
        const session = id ? this.sessions.get(id) : null;
        if (session) {
            if (isMuted) session.mute();
            else session.unmute();
        }
    }

    private setupEventHandlers(id: string) {
        const ua = this.uas.get(id);
        if (!ua) return;

        ua.on('connected', () => {
            console.log(`[SIP] ✅ Account ${id} connected to WebSocket`);
            this._isConnected.set(id, true);
        });

        ua.on('disconnected', (data: any) => {
            console.log(`[SIP] ❌ Account ${id} disconnected from WebSocket`, data);
            console.log(`[SIP] Disconnect reason:`, data?.error || 'Unknown');
            this._isConnected.set(id, false);
        });

        ua.on('registered', (data: any) => {
            console.log(`[SIP] ✅ Account ${id} successfully registered`, data);
            this._isRegistered.set(id, true);
        });

        ua.on('unregistered', (data: any) => {
            console.log(`[SIP] Account ${id} unregistered`, data);
            this._isRegistered.set(id, false);
        });

        ua.on('registrationFailed', (data: any) => {
            const statusCode = data?.response?.status_code;
            const reasonPhrase = data?.response?.reason_phrase;
            const cause = data?.cause || 'Unknown';

            console.warn(
                `[SIP] ⚠ Account ${id} registration failed — ` +
                `Cause: ${cause}` +
                (statusCode ? ` | Status: ${statusCode} ${reasonPhrase || ''}` : '')
            );

            if (data.response) {
                console.warn(`[SIP] Full registration response for ${id}:`, data.response);
            }

            this._isRegistered.set(id, false);
        });

        ua.on('registrationExpiring', () => {
            console.log(`[SIP] Account ${id} registration expiring, will re-register...`);
        });

        ua.on('newRTCSession', (data: { session: any; originator: string }) => {
            const session = data.session;
            if (session.direction === 'incoming') {
                console.log(`[SIP] Incoming call on account ${id}`);
                this.sessions.set(id, session);
                this._activeUAId = id; // Switch to the account receiving the call

                const store = useDialerStore.getState();
                store.setCurrentNumber(session.remote_identity.uri.user);
                store.openDialer();
                store.setCallStatus("ringing");

                session.on('ended', () => {
                    store.endCall();
                    this.sessions.delete(id);
                });
                session.on('failed', () => {
                    store.endCall();
                    this.sessions.delete(id);
                });
                session.on('accepted', () => {
                    store.setCallStatus("active");
                });
            }
        });
    }

    private setupJanusHandlers(id: string, ua: any) {
        ua.on('registered', () => {
            console.log(`[SIP] ✅ Account ${id} registered via Janus`);
            this._isRegistered.set(id, true);
            this._isConnected.set(id, true);
        });

        ua.on('incomingcall', (msg: unknown) => {
            const typedMsg = msg as { plugindata?: { data?: { result?: { username?: string, display_name?: string } } }, jsep?: RTCSessionDescriptionInit };
            console.log(`[SIP] 📞 Incoming call detected on account ${id}!`, typedMsg);
            const callerData = typedMsg.plugindata?.data?.result;
            const callerNumber = callerData?.username || "Unknown";
            const jsep = typedMsg.jsep;

            if (jsep) {
                // Set the active UA id so we answer on the right account
                this.activeUAId = id;
                // Dispatch to the global store
                useDialerStore.getState().setIncomingCall({
                    callerNumber,
                    name: callerData?.display_name,
                    jsep,
                    handleId: (ua as unknown as { handleId: number }).handleId || 0
                });
            } else {
                console.warn("[SIP] ⚠️ Incoming call missing JSEP offer. Cannot answer.");
            }
        });

        ua.on('registration_failed', (data: unknown) => {
            const msg = data as { plugindata?: { data?: { error_code?: number; error?: string } } };
            const errorCode = msg?.plugindata?.data?.error_code;
            const errorMsg = msg?.plugindata?.data?.error;
            console.error(`[SIP] ❌ Janus registration failed for ${id}: Error ${errorCode}: ${errorMsg}`);
            this._isRegistered.set(id, false);
            toast.error(`SIP Registration failed: ${errorMsg || 'Unknown error'}`);
        });

        ua.on('sip_error', (data: unknown) => {
            const msg = data as { plugindata?: { data?: { error_code?: number; error?: string } } };
            const errorCode = msg?.plugindata?.data?.error_code;
            const errorMsg = msg?.plugindata?.data?.error;
            console.warn(`[SIP] ⚠️ SIP error for ${id}: Error ${errorCode}: ${errorMsg}`);
            // Don't kill registration state — this is a call-level error, not registration
        });

        ua.on('accepted', () => {
            console.log(`[SIP] Janus call accepted`);
            useDialerStore.getState().setCallStatus("active");
        });

        ua.on('ended', () => {
            console.log(`[SIP] Janus call ended`);
            useDialerStore.getState().endCall();
        });

        ua.on('track', (event: any) => {
            console.log(`[SIP] Janus track received:`, event?.track?.kind, event?.streams?.length, 'streams');
            if (event.streams && event.streams[0]) {
                this._remoteStream = event.streams[0];
                let remoteAudio = document.getElementById("sip-remote-audio") as HTMLAudioElement;
                if (!remoteAudio) {
                    console.log("[SIP] Creating audio element for remote stream");
                    remoteAudio = document.createElement("audio");
                    remoteAudio.id = "sip-remote-audio";
                    remoteAudio.autoplay = true;
                    document.body.appendChild(remoteAudio);
                }
                remoteAudio.srcObject = this._remoteStream;
                remoteAudio.play().catch((e) => console.warn("[SIP] Audio play failed:", e));
                console.log("[SIP] ✅ Remote audio stream attached and playing");
            }
        });
    }

    private simulateCall() {
        const store = useDialerStore.getState();
        store.startCall();
        setTimeout(() => {
            if (store.callStatus === 'ended') return;
            store.setCallStatus("ringing");
            setTimeout(() => {
                if (store.callStatus === 'ended') return;
                store.setCallStatus("active");
            }, 2000);
        }, 1000);
    }

    public simulateIncomingCall(from: string) {
        const store = useDialerStore.getState();
        store.setCurrentNumber(from);
        store.openDialer();
        store.startCall();
        store.setCallStatus("ringing");
    }

    private enableDemoMode(id: string) {
        this._isConnected.set(id, true);
        this._isRegistered.set(id, true);
    }
}
