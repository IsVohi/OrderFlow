'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, UserRole, LoginFormData, SignupFormData } from './types';
import {
    loginAPI,
    signupAPI,
    storeToken,
    clearToken,
    getCurrentUser,
    getStoredToken,
} from './api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (data: LoginFormData) => Promise<void>;
    signup: (data: SignupFormData) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Role-based route mappings
 * Determines where each role should be redirected after login
 */
export const roleDefaultRoutes: Record<UserRole, string> = {
    USER: '/create-order',
    SELLER: '/inventory',
    ADMIN: '/dashboard',
};

/**
 * Routes accessible by each role
 */
export const roleAccessibleRoutes: Record<UserRole, string[]> = {
    USER: ['/create-order', '/orders'],
    SELLER: ['/inventory', '/reservations'],
    ADMIN: ['/dashboard', '/orders', '/observability', '/chaos', '/audit-log', '/dlq'],
};

/**
 * Public routes that don't require authentication
 */
export const publicRoutes = ['/login', '/signup'];

/**
 * AuthProvider component
 * Manages authentication state and provides auth methods to children
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    // Initialize auth state from stored token
    useEffect(() => {
        const storedUser = getCurrentUser();
        const storedToken = getStoredToken();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(storedUser);
        setToken(storedToken);
        setIsLoading(false);
    }, []);

    // Handle route protection
    useEffect(() => {
        if (isLoading) return;

        const isPublicRoute = publicRoutes.includes(pathname);
        const isAuthenticated = !!user;

        if (!isAuthenticated && !isPublicRoute) {
            // Redirect to login if not authenticated and trying to access protected route
            router.push('/login');
        } else if (isAuthenticated && isPublicRoute) {
            // Redirect to role-based default route if authenticated and on public route
            router.push(roleDefaultRoutes[user.role]);
        }
    }, [user, isLoading, pathname, router]);

    const login = useCallback(
        async (data: LoginFormData) => {
            const response = await loginAPI(data);
            storeToken(response.token);
            setUser(response.user);
            setToken(response.token);
            // Redirect based on role
            router.push(roleDefaultRoutes[response.user.role]);
        },
        [router]
    );

    const signup = useCallback(
        async (data: SignupFormData) => {
            const response = await signupAPI(data);
            storeToken(response.token);
            setUser(response.user);
            setToken(response.token);
            // Redirect based on role
            router.push(roleDefaultRoutes[response.user.role as UserRole]);
        },
        [router]
    );

    const logout = useCallback(() => {
        clearToken();
        setUser(null);
        setToken(null);
        router.push('/login');
    }, [router]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isLoading,
                isAuthenticated: !!user,
                login,
                signup,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * Hook to check if current user has access to a specific route
 */
export function useRouteAccess(route: string): boolean {
    const { user } = useAuth();
    if (!user) return false;
    return roleAccessibleRoutes[user.role].some((r) => route.startsWith(r));
}
