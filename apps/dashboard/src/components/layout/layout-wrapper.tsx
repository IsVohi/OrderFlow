'use client';

import { useAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';

/**
 * Layout wrapper that conditionally shows sidebar based on auth state
 * Public routes (login/signup) get full-width, no sidebar
 * Authenticated routes get sidebar layout
 */
export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Public routes - no sidebar
    if (!isAuthenticated) {
        return <>{children}</>;
    }

    // Authenticated routes - with sidebar
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-8">
                {children}
            </main>
        </div>
    );
}
