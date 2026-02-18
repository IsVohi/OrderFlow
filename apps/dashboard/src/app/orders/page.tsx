'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { listOrdersAction } from '@/app/actions/orders';
import { useAuth } from '@/lib/auth';
import { Order, OrderStatus } from '@/types';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Loader2,
} from 'lucide-react';

// Status badge styling
const statusStyles: Record<OrderStatus, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    CONFIRMED: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    PAYMENT_PENDING: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    PAID: 'bg-green-500/10 text-green-500 border-green-500/20',
    FULFILLED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    CANCELLED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.05 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
};

export default function OrdersPage() {
    const { user, token, isLoading: authLoading } = useAuth();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const [orders, setOrders] = useState<Order[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const result = await listOrdersAction({
                page,
                limit: pageSize,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                customerId: search || undefined, // Simple customer ID filtering
            }, token);
            setOrders(result.orders);
            setTotal(result.total);
            setPages(result.pages);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, statusFilter, search, token]);

    useEffect(() => {
        if (!authLoading && token) {
            fetchOrders();
        }
    }, [fetchOrders, authLoading, token]);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Orders</h1>
                <p className="text-zinc-400 mt-1">
                    View and manage all orders in the system
                </p>
            </div>

            {/* Filters */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Search by Customer ID..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                            />
                        </div>

                        {/* Status Filter */}
                        <Tabs
                            value={statusFilter}
                            onValueChange={(v) => {
                                setStatusFilter(v as OrderStatus | 'ALL');
                                setPage(1);
                            }}
                        >
                            <TabsList className="bg-zinc-800">
                                <TabsTrigger value="ALL" className="data-[state=active]:bg-zinc-700">
                                    All
                                </TabsTrigger>
                                <TabsTrigger value="PENDING" className="data-[state=active]:bg-zinc-700">
                                    Pending
                                </TabsTrigger>
                                <TabsTrigger value="FULFILLED" className="data-[state=active]:bg-zinc-700">
                                    Fulfilled
                                </TabsTrigger>
                                <TabsTrigger value="FAILED" className="data-[state=active]:bg-zinc-700">
                                    Failed
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-white">
                            {total} {total === 1 ? 'Order' : 'Orders'}
                        </CardTitle>
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-800 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Order ID</TableHead>
                                <TableHead className="text-zinc-400">Status</TableHead>
                                <TableHead className="text-zinc-400">Payment</TableHead>
                                <TableHead className="text-zinc-400">Inventory</TableHead>
                                <TableHead className="text-zinc-400">Customer</TableHead>
                                <TableHead className="text-zinc-400 text-right">Amount</TableHead>
                                <TableHead className="text-zinc-400">Created</TableHead>
                                <TableHead className="text-zinc-400"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                                        Loading orders...
                                    </TableCell>
                                </TableRow>
                            ) : orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                                        No orders found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <TableRow
                                        key={order.id}
                                        className="border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                                    >
                                        <TableCell className="font-mono text-sm text-zinc-300">
                                            {order.id}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={statusStyles[order.status]}>
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    order.paymentStatus === 'CAPTURED'
                                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                        : order.paymentStatus === 'FAILED'
                                                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                            : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                                }
                                            >
                                                {order.paymentStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    order.inventoryStatus === 'COMMITTED'
                                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                        : order.inventoryStatus === 'RELEASED'
                                                            ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                }
                                            >
                                                {order.inventoryStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-zinc-400">
                                            {order.customerId}
                                        </TableCell>
                                        <TableCell className="text-right text-white font-medium">
                                            ${Number(order.totalAmount).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </TableCell>
                                        <TableCell className="text-zinc-400 text-sm">
                                            {format(new Date(order.createdAt), 'MMM d, HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/orders/${order.id}`}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-zinc-400 hover:text-white"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
                        <p className="text-sm text-zinc-500">
                            Showing {(page - 1) * pageSize + 1} to{' '}
                            {Math.min(page * pageSize, total)} of {total} orders
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="border-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                                disabled={page === pages || loading}
                                className="border-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
