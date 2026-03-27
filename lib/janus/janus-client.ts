/**
 * Lightweight Janus Client for SIP Plugin
 * 
 * Handles Janus session management and SIP plugin signaling over WebSockets.
 * Includes keepalive pings to prevent session timeouts.
 */

export type JanusMessage = {
    janus: string;
    transaction: string;
    session_id?: number;
    handle_id?: number;
    plugin?: string;
    candidate?: Record<string, unknown> | { completed: boolean };
    body?: Record<string, unknown>;
    jsep?: RTCSessionDescriptionInit;
    plugindata?: {
        data: {
            event: string;
            [key: string]: unknown;
        };
    };
    [key: string]: unknown;
};

export class JanusClient {
    private ws: WebSocket | null = null;
    private sessionId: number | null = null;
    private handleId: number | null = null;
    private transactions: Map<string, (res: JanusMessage) => void> = new Map();
    private eventHandlers: Map<string, (data: JanusMessage) => void> = new Map();
    private keepaliveInterval: ReturnType<typeof setInterval> | null = null;

    public get activeHandleId(): number | null {
        return this.handleId;
    }

    constructor(private url: string, private secret?: string) { }

    public async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url, "janus-protocol");
                this.ws.onopen = () => resolve();
                this.ws.onerror = (err: Event) => {
                    console.error("[JanusClient] WebSocket connection error:", err);
                    reject(new Error(`WebSocket connection to ${this.url} failed. Ensure the server is reachable and SSL is valid.`));
                };
                this.ws.onclose = () => {
                    console.warn("[JanusClient] WebSocket closed. Stopping keepalive.");
                    this.stopKeepalive();
                };
                this.ws.onmessage = (msg) => {
                    try {
                        this.handleMessage(JSON.parse(msg.data));
                    } catch {
                        console.error("[JanusClient] Failed to parse message:", msg.data);
                    }
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    public async createSession(): Promise<number> {
        const res = await this.send({ janus: "create" });
        this.sessionId = (res as unknown as { data: { id: number } }).data.id;
        // Start sending keepalive pings every 25 seconds (Janus default timeout is 60s)
        this.startKeepalive();
        return this.sessionId!;
    }

    public async attachPlugin(plugin: string = "janus.plugin.sip"): Promise<number> {
        if (!this.sessionId) throw new Error("No Janus session");
        const res = await this.send({
            janus: "attach",
            plugin,
            session_id: this.sessionId
        });
        this.handleId = (res as unknown as { data: { id: number } }).data.id;
        return this.handleId!;
    }

    public async sendMessage(body: Record<string, unknown>, jsep?: RTCSessionDescriptionInit): Promise<JanusMessage> {
        if (!this.sessionId || !this.handleId) throw new Error("Not attached");
        return this.send({
            janus: "message",
            body,
            jsep,
            session_id: this.sessionId,
            handle_id: this.handleId
        });
    }

    public async sendTrickleCandidate(candidate: Record<string, unknown> | { completed: boolean } | null): Promise<void> {
        if (!this.sessionId || !this.handleId) return;
        // If candidate is null, it means ICE gathering is complete
        const payload = candidate || { completed: true };
        this.send({
            janus: "trickle",
            candidate: payload,
            session_id: this.sessionId,
            handle_id: this.handleId
        }).catch(e => console.warn("[JanusClient] Failed to send trickle candidate:", e));
    }

    public onEvent(type: string, handler: (data: JanusMessage) => void) {
        this.eventHandlers.set(type, handler);
    }

    private startKeepalive() {
        this.stopKeepalive();
        this.keepaliveInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN && this.sessionId) {
                const msg = JSON.stringify({
                    janus: "keepalive",
                    session_id: this.sessionId,
                    transaction: Math.random().toString(36).substring(7)
                });
                this.ws.send(msg);
            }
        }, 25000); // Every 25 seconds
    }

    private stopKeepalive() {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }
    }

    private handleMessage(msg: JanusMessage) {
        // Skip verbose logging for keepalive acks
        if (msg.janus !== "ack" || msg.plugindata) {
            console.log("[JanusClient] <<< Received:", JSON.stringify(msg, null, 2));
        }

        // Handle session timeout — Janus destroyed our session
        if (msg.janus === "timeout") {
            console.warn("[JanusClient] ⏰ Session timed out! Janus destroyed the session.");
            this.sessionId = null;
            this.handleId = null;
            this.stopKeepalive();
            const handler = this.eventHandlers.get("timeout");
            if (handler) handler(msg);
            return;
        }

        if (msg.transaction && this.transactions.has(msg.transaction)) {
            const resolve = this.transactions.get(msg.transaction);
            if (resolve) resolve(msg);
            this.transactions.delete(msg.transaction);
        }

        if (msg.janus === "event" && msg.plugindata) {
            const data = msg.plugindata.data as Record<string, unknown>;

            // Janus SIP plugin uses data.result.event for success events
            // and data.error_code for error events
            let event: string | undefined;
            const result = data.result as Record<string, unknown> | undefined;

            if (result && typeof result === "object") {
                event = result.event as string;
            }

            // If there's an error_code, emit it as sip_error (not always registration_failed)
            if (data.error_code || (result && result.error_code)) {
                const code = data.error_code || (result?.error_code as number);
                const err = data.error || (result?.error as string) || (result?.reason as string);
                console.error(`[JanusClient] ❌ SIP Error ${code}: ${err}`);
                if (!event) {
                    event = "sip_error";
                }
            }

            console.log(`[JanusClient] Event type: "${event}", registered handlers:`, Array.from(this.eventHandlers.keys()));

            if (event) {
                const handler = this.eventHandlers.get(event);
                if (handler) {
                    console.log(`[JanusClient] ✅ Found handler for "${event}", calling it...`);
                    handler(msg);
                } else {
                    console.warn(`[JanusClient] ⚠️ No handler registered for event "${event}". Full msg:`, JSON.stringify(msg, null, 2));
                }
            } else {
                console.warn(`[JanusClient] ⚠️ Could not determine event type from data:`, JSON.stringify(data, null, 2));
            }
        }

        // Check for JSEP in ANY incoming message and emit it as a dedicated event
        // The SDP answer can arrive with the accepted event OR as a separate message
        const rawMsg = msg as Record<string, unknown>;
        if (rawMsg.jsep || (msg as Record<string, unknown>)["jsep"]) {
            const jsep = (rawMsg.jsep || (msg as Record<string, unknown>)["jsep"]) as RTCSessionDescriptionInit;
            console.log(`[JanusClient] 📄 JSEP detected in message! type=${jsep.type}`);
            const jsepHandler = this.eventHandlers.get("jsep");
            if (jsepHandler) jsepHandler({ ...msg, jsep } as JanusMessage);
        }

        // Handle incoming trickle ICE candidates from Janus
        if (msg.janus === "trickle" && msg.candidate) {
            console.log(`[JanusClient] 🧊 Received incoming trickle ICE candidate from Janus`);
            const trickleHandler = this.eventHandlers.get("trickle");
            if (trickleHandler) trickleHandler(msg);
        }
    }

    private send(payload: Partial<JanusMessage>): Promise<JanusMessage> {
        return new Promise((resolve, reject) => {
            const transaction = Math.random().toString(36).substring(7);
            const msg = {
                ...payload,
                transaction,
                token: this.secret
            };

            const timeout = setTimeout(() => {
                this.transactions.delete(transaction);
                reject(new Error(`Transaction ${transaction} timed out`));
            }, 10000);

            this.transactions.set(transaction, (res) => {
                clearTimeout(timeout);
                if (res.janus === "error") {
                    const err = res.error as { code?: number; reason?: string } | undefined;
                    reject(new Error(`Janus error ${err?.code || "unknown"}: ${err?.reason || JSON.stringify(res.error)}`));
                }
                else resolve(res);
            });

            this.ws?.send(JSON.stringify(msg));
        });
    }

    public disconnect() {
        this.stopKeepalive();
        this.ws?.close();
        this.sessionId = null;
        this.handleId = null;
    }
}
