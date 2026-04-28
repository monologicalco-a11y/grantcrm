import { JanusClient, type JanusMessage } from "./janus-client";

export interface JanusUAOptions {
    uri: string;
    password?: string;
    auth_user?: string;
    proxy?: string;
    display_name?: string;
    janus_url: string;
    janus_secret?: string;
}

export class JanusUA {
    private client: JanusClient;
    private pc: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private options: JanusUAOptions;
    private handlers: Map<string, Array<(...args: unknown[]) => void>> = new Map();
    private statsInterval: ReturnType<typeof setInterval> | null = null;

    constructor(options: JanusUAOptions) {
        this.options = options;
        this.client = new JanusClient(options.janus_url, options.janus_secret);
        this.setupJanusHandlers();
    }

    private setupJanusHandlers() {
        this.client.onEvent("registered", (data) => this.emit("registered", data));
        this.client.onEvent("registration_failed", (data) => this.emit("registration_failed", data));
        this.client.onEvent("sip_error", (data) => this.emit("sip_error", data));
        this.client.onEvent("calling", (data) => {
            console.log("[JanusUA] 📞 SIP INVITE sent (calling)");
            this.emit("calling", data);
        });
        this.client.onEvent("proceeding", () => {
            console.log("[JanusUA] ⏳ Call proceeding (183 Session Progress)");
        });
        this.client.onEvent("ringing", (data) => {
            console.log("[JanusUA] 🔔 Remote party is ringing");
            this.emit("ringing", data);
        });
        this.client.onEvent("progress", (data) => {
            console.log("[JanusUA] 🔔 Call progress (early media/ringing)");
            this.emit("progress", data);
        });
        this.client.onEvent("registering", () => {
            console.log("[JanusUA] SIP registering...");
        });
        this.client.onEvent("incomingcall", (data) => this.handleIncomingCall(data));
        this.client.onEvent("accepted", (data) => this.handleAccepted(data));
        this.client.onEvent("hangup", (data) => this.handleHangup(data));
        // JSEP handler — catches SDP answers that may arrive separately from the accepted event
        this.client.onEvent("jsep", (data) => {
            console.log(`[JanusUA] 📄 Received JSEP answer via dedicated handler`);
            if (data.jsep && this.pc) {
                console.log(`[JanusUA] Setting remote SDP from JSEP event, type: ${data.jsep.type}`);
                this.pc.setRemoteDescription(new RTCSessionDescription(data.jsep))
                    .then(() => console.log("[JanusUA] ✅ Remote description set via JSEP handler"))
                    .catch(e => console.error("[JanusUA] ❌ Failed to set remote description:", e));
            }
        });

        // Handle incoming ICE trickles from Janus
        this.client.onEvent("trickle", (data) => {
            if (this.pc && data.candidate && !(data.candidate as { completed?: boolean }).completed) {
                console.log(`[JanusUA] 🧊 Adding remote ICE candidate from Janus`);
                this.pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit))
                    .catch(e => console.warn("[JanusUA] ❌ Failed to add ICE candidate:", e));
            }
        });
    }

    public async register() {
        console.log("[JanusUA] Step 1: Connecting WebSocket to", this.options.janus_url);
        await this.client.connect();
        console.log("[JanusUA] Step 2: WebSocket connected! Creating session...");
        await this.client.createSession();
        console.log("[JanusUA] Step 3: Session created! Attaching SIP plugin...");
        await this.client.attachPlugin();
        console.log("[JanusUA] Step 4: Plugin attached! Sending SIP register...");
        // Janus SIP plugin requires proxy in SIP URI format: "sip:domain.com"
        let proxy = this.options.proxy;
        if (proxy && !proxy.startsWith("sip:")) {
            proxy = `sip:${proxy}`;
        }

        const registerPayload = {
            request: "register",
            username: this.options.uri,
            secret: this.options.password,
            authuser: this.options.auth_user,
            proxy: proxy,
            display_name: this.options.display_name,
        };
        console.log("[JanusUA] Register payload:", JSON.stringify(registerPayload, null, 2));

        await this.client.sendMessage(registerPayload);
        console.log("[JanusUA] Step 5: Register message sent! Waiting for Janus response...");
    }

    public async call(targetUri: string, audioDeviceId?: string) {
        // Ensure target is in full SIP URI format: sip:number@domain
        let sipUri = targetUri;
        if (!sipUri.startsWith("sip:")) {
            const domainMatch = this.options.uri.match(/@(.+)$/);
            const domain = domainMatch ? domainMatch[1] : "unknown";
            sipUri = `sip:${targetUri}@${domain}`;
        }
        console.log(`[JanusUA] Calling ${sipUri}`);

        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        this.pc.ontrack = (event) => {
            console.log(`[JanusUA] 🎵 ontrack fired! kind=${event.track.kind}, streams=${event.streams.length}`);
            this.emit("track", event);
        };

        this.pc.oniceconnectionstatechange = () => {
            console.log(`[JanusUA] ICE connection state: ${this.pc?.iceConnectionState}`);
        };

        this.pc.onconnectionstatechange = () => {
            console.log(`[JanusUA] PeerConnection state: ${this.pc?.connectionState}`);
        };

        const audioConstraints: boolean | MediaTrackConstraints = audioDeviceId
            ? { deviceId: { exact: audioDeviceId } }
            : true;

        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        this.localStream.getTracks().forEach(track => this.pc?.addTrack(track, this.localStream!));

        let signalingSent = false;
        const pendingCandidates: Array<Record<string, unknown> | { completed: boolean }> = [];

        this.pc.onicecandidate = (event) => {
            const candidateData = event.candidate 
                ? event.candidate as unknown as Record<string, unknown> 
                : { completed: true };

            if (event.candidate) {
                console.log("[JanusUA] 🧊 ICE candidate gathered:", event.candidate.candidate);
            } else {
                console.log("[JanusUA] 🧊 ICE gathering finished");
            }

            if (signalingSent) {
                this.client.sendTrickleCandidate(candidateData).catch(e => console.warn(e));
            } else {
                pendingCandidates.push(candidateData);
            }
        };

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        console.log("[JanusUA] Sending offer to Janus (trickle ICE enabled)");

        await this.client.sendMessage({
            request: "call",
            uri: sipUri,
        }, {
            type: "offer",
            sdp: offer.sdp
        });
        
        signalingSent = true;
        if (pendingCandidates.length > 0) {
            console.log(`[JanusUA] Sending ${pendingCandidates.length} buffered ICE candidates...`);
            for (const candidate of pendingCandidates) {
                this.client.sendTrickleCandidate(candidate).catch(e => console.warn(e));
            }
        }
    }

    public async hangup() {
        await this.client.sendMessage({ request: "hangup" });
        this.cleanup();
    }

    private handleAccepted(msg: JanusMessage) {
        // Note: We DO NOT setRemoteDescription here anymore.
        // janus-client.ts explicitly emits a 'jsep' event for ANY message containing a jsep object.
        // Applying it here and in the 'jsep' handler causes an InvalidStateError (double-set).
        this.emit("accepted", msg);
        this.startQualityMonitoring();
    }
    public async answer(jsepOffer: RTCSessionDescriptionInit, audioDeviceId?: string) {
        console.log(`[JanusUA] Answering incoming call with offer...`);

        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        this.pc.ontrack = (event) => {
            console.log(`[JanusUA] 🎵 ontrack fired for incoming call! kind=${event.track.kind}`);
            this.emit("track", event);
        };

        this.pc.oniceconnectionstatechange = () => {
            console.log(`[JanusUA] ICE connection state: ${this.pc?.iceConnectionState}`);
        };

        this.pc.onconnectionstatechange = () => {
            console.log(`[JanusUA] PeerConnection state: ${this.pc?.connectionState}`);
        };

        const audioConstraints: boolean | MediaTrackConstraints = audioDeviceId
            ? { deviceId: { exact: audioDeviceId } }
            : true;

        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        this.localStream.getTracks().forEach(track => this.pc?.addTrack(track, this.localStream!));

        let signalingSent = false;
        const pendingCandidates: Array<Record<string, unknown> | { completed: boolean }> = [];

        this.pc.onicecandidate = (event) => {
            const candidateData = event.candidate 
                ? event.candidate as unknown as Record<string, unknown> 
                : { completed: true };

            if (event.candidate) {
                console.log("[JanusUA] 🧊 ICE candidate gathered (incoming):", event.candidate.candidate);
            } else {
                console.log("[JanusUA] 🧊 ICE gathering finished (incoming)");
            }

            if (signalingSent) {
                this.client.sendTrickleCandidate(candidateData).catch(e => console.warn(e));
            } else {
                pendingCandidates.push(candidateData);
            }
        };

        await this.pc.setRemoteDescription(new RTCSessionDescription(jsepOffer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        console.log("[JanusUA] Sending answer to Janus");

        await this.client.sendMessage({
            request: "accept"
        }, {
            type: "answer",
            sdp: answer.sdp
        });
        
        signalingSent = true;
        if (pendingCandidates.length > 0) {
            console.log(`[JanusUA] Sending ${pendingCandidates.length} buffered ICE candidates (incoming)...`);
            for (const candidate of pendingCandidates) {
                this.client.sendTrickleCandidate(candidate).catch(e => console.warn(e));
            }
        }
    }

    public async decline() {
        console.log("[JanusUA] Declining incoming call");
        await this.client.sendMessage({ request: "decline" });
        this.cleanup();
    }

    private handleIncomingCall(msg: JanusMessage) {
        console.log("[JanusUA] 📞 Incoming call detected! Elevating to UI...", msg);
        this.emit("incomingcall", msg);
    }

    private handleHangup(msg: JanusMessage) {
        this.cleanup();
        this.emit("ended", msg);
    }

    public async sendDTMF(tone: string) {
        if (!this.pc) throw new Error("No active peer connection for DTMF");
        console.log(`[JanusUA] Sending DTMF tone: ${tone}`);
        await this.client.sendMessage({
            request: "dtmf",
            dtmf: tone
        });
    }

    public async replaceAudioTrack(newTrack: MediaStreamTrack) {
        if (!this.pc) throw new Error("No active peer connection to replace track");
        
        const senders = this.pc.getSenders();
        const audioSender = senders.find(s => s.track?.kind === "audio");
        
        if (audioSender) {
            await audioSender.replaceTrack(newTrack);
            console.log("[JanusUA] 🔄 Successfully hot-swapped audio track");
        } else {
            console.warn("[JanusUA] ⚠️ Could not find active audio sender to hot-swap");
        }
    }

    private startQualityMonitoring() {
        if (this.statsInterval) clearInterval(this.statsInterval);
        
        let previousTimestamp = 0;
        let previousPacketsReceived = 0;
        let previousPacketsLost = 0;

        this.statsInterval = setInterval(async () => {
            if (!this.pc) return;
            try {
                const stats = await this.pc.getStats();
                let quality = "good";

                stats.forEach(report => {
                    if (report.type === "inbound-rtp" && report.kind === "audio") {
                        const packetsReceived = report.packetsReceived || 0;
                        const packetsLost = report.packetsLost || 0;
                        const jitter = report.jitter || 0;

                        if (previousTimestamp > 0) {
                            const deltaReceived = packetsReceived - previousPacketsReceived;
                            const deltaLost = packetsLost - previousPacketsLost;
                            
                            if (deltaReceived > 0) {
                                const lossRate = deltaLost / (deltaReceived + deltaLost);
                                if (lossRate > 0.05 || jitter > 0.05) quality = "poor";
                                else if (lossRate > 0.02 || jitter > 0.03) quality = "fair";
                            }
                        }

                        previousTimestamp = report.timestamp;
                        previousPacketsReceived = packetsReceived;
                        previousPacketsLost = packetsLost;
                    }
                });

                this.emit("quality", quality);
            } catch (err) {
                console.warn("[JanusUA] Error getting WebRTC stats", err);
            }
        }, 2000);
    }

    public async injectAudioFile(file: File) {
        if (!this.pc) throw new Error("No active peer connection to inject audio into");

        console.log(`[JanusUA] 📼 Injecting voicemail file: ${file.name}`);

        const audioUrl = URL.createObjectURL(file);
        const audioElem = document.createElement("audio");
        audioElem.src = audioUrl;
        audioElem.id = "voicemail-injector";
        audioElem.style.display = "none";
        document.body.appendChild(audioElem);

        // Ensure playback
        await audioElem.play();

        // Capture the stream from the playing audio element
        // @ts-expect-error - captureStream exists on HTMLMediaElement in most modern browsers
        const capturedStream: MediaStream = audioElem.captureStream ? audioElem.captureStream() : (audioElem as unknown as { mozCaptureStream: () => MediaStream }).mozCaptureStream();
        const newAudioTrack = capturedStream.getAudioTracks()[0];

        if (!newAudioTrack) {
            throw new Error("Could not capture audio track from uploaded file");
        }

        // Find the RTCRtpSender that is currently transmitting audio
        const senders = this.pc.getSenders();
        const audioSender = senders.find(s => s.track?.kind === "audio");

        if (audioSender) {
            await audioSender.replaceTrack(newAudioTrack);
            console.log("[JanusUA] 🔄 Successfully replaced live mic with file audio track");
        } else {
            console.warn("[JanusUA] ⚠️ Could not find an active audio sender to replace");
        }

        // When the file finishes, cleanup and hangup automatically
        audioElem.onended = () => {
            console.log("[JanusUA] 🛑 Voicemail playback finished. Hanging up.");
            this.hangup();

            // Cleanup DOM and URL
            URL.revokeObjectURL(audioUrl);
            audioElem.remove();
        };
    }

    private cleanup() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        this.pc?.close();
        this.pc = null;
        this.localStream?.getTracks().forEach(t => t.stop());
        this.localStream = null;
    }

    public on(event: string, handler: (...args: never[]) => void) {
        if (!this.handlers.has(event)) this.handlers.set(event, []);
        this.handlers.get(event)?.push(handler as (...args: unknown[]) => void);
    }

    private emit(event: string, ...args: unknown[]) {
        this.handlers.get(event)?.forEach(h => h(...args));
    }

    public stop() {
        this.cleanup();
        this.client.disconnect();
    }
}
