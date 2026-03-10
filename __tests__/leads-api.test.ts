process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';

// Mock everything first
jest.doMock('next/server', () => {
    return {
        NextResponse: class MockNextResponse {
            static json(data: unknown, init?: ResponseInit) {
                return {
                    status: init?.status || 200,
                    json: async () => data,
                    headers: new Map(Object.entries(init?.headers || {}))
                };
            }
            static redirect(url: string | URL, status?: number) {
                return {
                    status: typeof status === 'number' ? status : 302,
                    headers: new Map([['Location', url.toString()]])
                };
            }
        }
    };
});

const m = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    then: jest.fn().mockImplementation((cb) => cb({ data: null, error: null })),
};

jest.doMock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => m)
}));

jest.doMock('@/lib/automations/engine', () => ({
    evaluateTriggers: jest.fn(() => Promise.resolve())
}));

// Now require the route
/* eslint-disable @typescript-eslint/no-require-imports */
const { POST } = require('@/app/api/public/leads/route');
const { createClient } = require('@supabase/supabase-js');
/* eslint-enable @typescript-eslint/no-require-imports */
const mockSupabase = createClient();

describe('Leads API', () => {
    const mockFormId = 'form-123';

    beforeEach(() => {
        jest.clearAllMocks();

        // Default success for form fetch
        mockSupabase.single.mockResolvedValueOnce({
            data: {
                id: 'form-123',
                organization_id: 'org-123',
                name: 'Test Form',
                status: 'active',
                config: { 'email': 'email', 'name': 'first_name' }
            },
            error: null
        });

        // Success for contact insert
        mockSupabase.single.mockResolvedValueOnce({
            data: { id: 'contact-123', first_name: 'Test', last_name: 'User' },
            error: null
        });

        // Success for admin fetch (then)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockSupabase.then.mockImplementationOnce((cb: any) => cb({
            data: [{ user_id: 'admin-123' }],
            error: null
        }));
    });

    it('should process a valid lead submission via JSON', async () => {
        const mockRequest = {
            headers: new Map([
                ['content-type', 'application/json'],
                ['x-form-id', mockFormId]
            ]),
            json: jest.fn().mockResolvedValue({
                email: 'test@example.com',
                name: 'Test User'
            }),
            clone: function () { return this; }
        } as unknown as Request;

        const response = await POST(mockRequest);
        const data = await response.json();

        if (response.status === 500) console.log('TEST ERROR DATA:', data);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.id).toBe('contact-123');
    });

    it('should process a valid lead submission via Form Data', async () => {
        const mockFormData = new Map([
            ['x-form-id', mockFormId],
            ['email', 'test@example.com'],
            ['first_name', 'Test']
        ]);

        const mockRequest = {
            headers: new Map([
                ['content-type', 'application/x-www-form-urlencoded']
            ]),
            formData: jest.fn().mockResolvedValue({
                get: (key: string) => mockFormData.get(key),
                entries: () => mockFormData.entries()
            }),
            clone: function () { return this; }
        } as unknown as Request;

        const response = await POST(mockRequest);
        const data = await response.json();

        if (response.status === 500) console.log('TEST ERROR DATA:', data);

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('should return 400 if form id is missing', async () => {
        const mockRequest = {
            headers: new Map([
                ['content-type', 'application/json']
            ]),
            json: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
            clone: function () { return this; }
        } as unknown as Request;

        const response = await POST(mockRequest);

        if (response.status === 500) {
            const data = await response.json();
            console.log('TEST ERROR DATA:', data);
        }

        expect(response.status).toBe(400);
    });
});
