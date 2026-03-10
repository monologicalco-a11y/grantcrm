import '@testing-library/jest-dom';

// Basic polyfills for Next.js server components
(global as any).Request = class {
    constructor(public url: string, public init?: any) { }
};
(global as any).Response = class {
    constructor(public body?: any, public init?: any) { }
    static json(data: any, init?: any) {
        return new (global as any).Response(JSON.stringify(data), {
            ...init,
            headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
        });
    }
    async json() { return JSON.parse(this.body); }
};
(global as any).NextResponse = class extends (global as any).Response {
    static json(data: any, init?: any) {
        return (global as any).Response.json(data, init);
    }
};
(global as any).Headers = Map;
(global as any).FormData = class {
    private data = new Map();
    append(k: string, v: any) { this.data.set(k, v); }
    get(k: string) { return this.data.get(k); }
    entries() { return this.data.entries(); }
};
