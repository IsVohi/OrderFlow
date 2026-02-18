import { z } from 'zod';

/**
 * User roles in the OrderFlow system
 * - USER: Customer who creates orders
 * - SELLER: Inventory manager who manages products
 * - ADMIN: System operator with full access
 */
export const UserRole = {
    USER: 'USER',
    SELLER: 'SELLER',
    ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Login schema - validates email and password
 */
export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Signup schema - validates email, password, confirm password, and role
 */
export const signupSchema = z
    .object({
        email: z
            .string()
            .min(1, 'Email is required')
            .email('Invalid email address'),
        password: z
            .string()
            .min(1, 'Password is required')
            .min(8, 'Password must be at least 8 characters')
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                'Password must contain uppercase, lowercase, and number'
            ),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
        role: z.enum(['USER', 'SELLER', 'ADMIN'], {
            message: 'Please select a role',
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export type SignupFormData = z.infer<typeof signupSchema>;

/**
 * JWT payload structure
 */
export interface JWTPayload {
    sub: string; // User ID
    email: string;
    role: UserRole;
    exp: number; // Expiration timestamp
    iat: number; // Issued at timestamp
}

/**
 * User session data (derived from JWT)
 */
export interface User {
    id: string;
    email: string;
    role: UserRole;
}

/**
 * Auth API response types
 */
export interface AuthResponse {
    token: string;
    user: User;
}

export interface AuthError {
    message: string;
    code?: string;
}
