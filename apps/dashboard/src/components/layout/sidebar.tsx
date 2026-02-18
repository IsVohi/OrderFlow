'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth, roleAccessibleRoutes } from '@/lib/auth';
import {
    LayoutDashboard,
    Package,
    Activity,
    Zap,
    Warehouse,
    LogOut,
    Menu,
    X,
    User,
    ClipboardList,
    PlusCircle,
    Shield,
    Inbox,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Navigation items with their routes and icons
 * Matches system design document specifications
 */
const allNavItems = [
    // ADMIN routes
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
    { name: 'Orders', href: '/orders', icon: Package, roles: ['ADMIN'] },
    { name: 'Observability', href: '/observability', icon: Activity, roles: ['ADMIN'] },
    { name: 'Chaos Testing', href: '/chaos', icon: Zap, roles: ['ADMIN'] },
    { name: 'Audit Log', href: '/audit-log', icon: Shield, roles: ['ADMIN'] },
    { name: 'Dead Letter Queue', href: '/dlq', icon: Inbox, roles: ['ADMIN'] },

    // SELLER routes
    { name: 'Orders', href: '/orders', icon: Package, roles: ['SELLER'] },
    { name: 'Inventory', href: '/inventory', icon: Warehouse, roles: ['SELLER'] },
    { name: 'Reservations', href: '/reservations', icon: ClipboardList, roles: ['SELLER'] },

    // USER routes
    { name: 'Create Order', href: '/create-order', icon: PlusCircle, roles: ['USER'] },
    { name: 'My Orders', href: '/orders', icon: Package, roles: ['USER'] },
];

/**
 * Role badge colors
 */
const roleBadgeStyles = {
    USER: 'bg-green-500/10 text-green-500 border-green-500/20',
    SELLER: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    ADMIN: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

/**
 * Role display names
 */
const roleDisplayNames = {
    USER: 'Customer',
    SELLER: 'Seller',
    ADMIN: 'Admin',
};

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout, isAuthenticated } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    // Don't render sidebar on public routes
    if (!isAuthenticated) {
        return null;
    }

    // Filter navigation items based on user role
    const navItems = allNavItems.filter(
        (item) => user && item.roles.includes(user.role)
    );

    return (
        <aside
            className={cn(
                'fixed left-0 top-0 z-40 h-screen border-r border-zinc-800 bg-zinc-950 transition-all duration-300',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo / Header */}
            <div className="flex h-16 items-center justify-between border-b border-zinc-800 px-4">
                {!collapsed && (
                    <Link href={user ? roleAccessibleRoutes[user.role][0] : '/'} className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
                            <Package className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-semibold text-white">OrderFlow</span>
                    </Link>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-zinc-400 hover:text-white"
                >
                    {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </Button>
            </div>

            {/* User Info */}
            {!collapsed && user && (
                <div className="p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center">
                            <User className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{user.email}</p>
                            <Badge variant="outline" className={cn('text-xs mt-1', roleBadgeStyles[user.role])}>
                                {roleDisplayNames[user.role]}
                            </Badge>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex flex-col gap-1 p-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/dashboard' && item.href !== '/create-order' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={`${item.name}-${item.href}`}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-zinc-800 text-white'
                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                            )}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {!collapsed && <span>{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Role Info */}
            {!collapsed && (
                <div className="absolute bottom-16 left-0 right-0 p-4">
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                        <p className="text-xs text-zinc-500">
                            {user?.role === 'USER' && 'Create orders and track saga progress'}
                            {user?.role === 'SELLER' && 'Manage inventory and view reservations'}
                            {user?.role === 'ADMIN' && 'Observe system health and run chaos tests'}
                        </p>
                    </div>
                </div>
            )}

            {/* Logout Button */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 p-2">
                <Button
                    variant="ghost"
                    className={cn(
                        'w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900',
                        collapsed && 'justify-center'
                    )}
                    onClick={logout}
                >
                    <LogOut className="h-5 w-5" />
                    {!collapsed && <span className="ml-3">Logout</span>}
                </Button>
            </div>
        </aside>
    );
}
