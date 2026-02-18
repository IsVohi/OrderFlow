/**
 * JWT Identity Types and Utilities
 * Used for extracting user identity from JWT tokens for data isolation
 */

export type UserRole = 'USER' | 'SELLER' | 'ADMIN';

export interface JwtIdentity {
    sub: string;
    role: UserRole;
    email?: string;
}

export interface RequestWithIdentity {
    identity?: JwtIdentity;
}

/**
 * Decodes a JWT token and extracts identity information
 * Note: This is a mock implementation for demo purposes.
 * In production, use proper JWT verification with secret/public key.
 */
export function decodeJwtIdentity(token: string | undefined): JwtIdentity | null {
    if (!token) return null;

    try {
        // Remove 'Bearer ' prefix if present
        const cleanToken = token.replace(/^Bearer\s+/i, '');

        // Split JWT parts
        const parts = cleanToken.split('.');
        if (parts.length !== 3) return null;

        // Decode payload (middle part)
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));

        // Validate required fields
        if (!payload.sub || !payload.role) return null;

        // Check expiration
        if (payload.exp && payload.exp < Date.now()) {
            return null;
        }

        return {
            sub: payload.sub,
            role: payload.role as UserRole,
            email: payload.email,
        };
    } catch {
        return null;
    }
}

/**
 * Checks if identity has the specified role
 */
export function hasRole(identity: JwtIdentity | null, role: UserRole): boolean {
    return identity?.role === role;
}

/**
 * Checks if identity is an admin
 */
export function isAdmin(identity: JwtIdentity | null): boolean {
    return hasRole(identity, 'ADMIN');
}

/**
 * Checks if identity is a seller
 */
export function isSeller(identity: JwtIdentity | null): boolean {
    return hasRole(identity, 'SELLER');
}

/**
 * Checks if identity is a regular user
 */
export function isUser(identity: JwtIdentity | null): boolean {
    return hasRole(identity, 'USER');
}
