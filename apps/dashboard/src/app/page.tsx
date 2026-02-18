'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, roleDefaultRoutes } from '@/lib/auth';

/**
 * Root page - redirects based on authentication state
 * - Unauthenticated: redirects to /login
 * - Authenticated: redirects to role-based default route
 */
export default function RootPage() {
    const { user, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.replace('/login');
        } else if (user) {
            router.replace(roleDefaultRoutes[user.role]);
        }
    }, [user, isLoading, isAuthenticated, router]);

    // Show loading spinner while determining redirect
    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
