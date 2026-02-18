import { AuthResponse, User, UserRole, LoginFormData, SignupFormData } from './types';

/**
 * ⚠️ SECURITY DISCLAIMER ⚠️
 * MOCK AUTHENTICATION FOR DEMO ONLY.
 * 
 * I used a mock implementation here for the demo. In production, I would use
 * a real provider (Auth0/Cognito) and httpOnly cookies.
 */

/**
 * Mock JWT token generator
 * In production, this would be handled by the backend
 */
function generateMockToken(user: User): string {
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        iat: Date.now(),
    };
    // Base64 encode the payload (mock JWT)
    return `mock.${btoa(JSON.stringify(payload))}.signature`;
}

/**
 * Mock user database for demo purposes
 */
const mockUsers: Map<string, { password: string; user: User }> = new Map([
    [
        'admin@orderflow.io',
        {
            password: 'Admin123!',
            user: { id: 'user-admin-001', email: 'admin@orderflow.io', role: 'ADMIN' },
        },
    ],
    [
        'seller@orderflow.io',
        {
            password: 'Seller123!',
            user: { id: 'user-seller-001', email: 'seller@orderflow.io', role: 'SELLER' },
        },
    ],
    [
        'user@orderflow.io',
        {
            password: 'User1234!',
            user: { id: 'user-customer-001', email: 'user@orderflow.io', role: 'USER' },
        },
    ],
]);

/**
 * Simulates network delay for realistic UX
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock Login API
 * POST /api/auth/login
 */
export async function loginAPI(data: LoginFormData): Promise<AuthResponse> {
    await delay(800); // Simulate network latency

    const record = mockUsers.get(data.email.toLowerCase());

    if (!record) {
        throw new Error('Invalid email or password');
    }

    if (record.password !== data.password) {
        throw new Error('Invalid email or password');
    }

    const token = generateMockToken(record.user);

    return {
        token,
        user: record.user,
    };
}

/**
 * Mock Signup API
 * POST /api/auth/signup
 */
export async function signupAPI(data: SignupFormData): Promise<AuthResponse> {
    await delay(1000); // Simulate network latency

    const email = data.email.toLowerCase();

    // Check if user already exists
    if (mockUsers.has(email)) {
        throw new Error('An account with this email already exists');
    }

    // Create new user
    const newUser: User = {
        id: `user-${Date.now()}`,
        email,
        role: data.role as UserRole,
    };

    // Store in mock database
    mockUsers.set(email, {
        password: data.password,
        user: newUser,
    });

    const token = generateMockToken(newUser);

    return {
        token,
        user: newUser,
    };
}

/**
 * Validates and decodes a JWT token
 * In production, this would verify the signature with the server
 */
export function decodeToken(token: string): User | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(atob(parts[1]));

        // Check expiration
        if (payload.exp < Date.now()) {
            return null;
        }

        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    } catch {
        return null;
    }
}

/**
 * Token storage utilities
 * In production, tokens should be stored in httpOnly cookies
 */
const TOKEN_KEY = 'orderflow_auth_token';

export function storeToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(TOKEN_KEY, token);
    }
}

export function getStoredToken(): string | null {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(TOKEN_KEY);
    }
    return null;
}

export function clearToken(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
    }
}

/**
 * Get current user from stored token
 */
export function getCurrentUser(): User | null {
    const token = getStoredToken();
    if (!token) return null;
    return decodeToken(token);
}
