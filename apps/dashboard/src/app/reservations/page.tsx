'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Search, Clock, Package, AlertTriangle, Loader2 } from 'lucide-react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

import { useAuth } from '@/lib/auth';
import { listReservationsAction, getInventoryAction } from '@/app/actions/inventory';
import { Product, InventoryReservation } from '@/types';

function ReservationStatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        RESERVED: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        COMMITTED: 'bg-green-500/10 text-green-500 border-green-500/20',
        RELEASED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        EXPIRED: 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    return (
        <Badge variant="outline" className={variants[status] || variants.RESERVED}>
            {status}
        </Badge>
    );
}

export default function ReservationsPage() {
    const { token, isLoading: authLoading } = useAuth();

    const [reservations, setReservations] = useState<InventoryReservation[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // Parallel fetch: reservations needing products for names
            const [resRes, prodRes] = await Promise.all([
                listReservationsAction(token),
                getInventoryAction(token)
            ]);
            setReservations(resRes);
            setProducts(prodRes);
        } catch (err) {
            console.error('Failed to fetch reservations data', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!authLoading && token) {
            fetchData();
        }
    }, [fetchData, authLoading, token]);

    // Enrich with product data
    const enrichedReservations = reservations.map(res => {
        const product = products.find(p => p.id === res.productId);
        return {
            ...res,
            productName: product ? product.name : 'Unknown Product',
        };
    });

    const filteredReservations = enrichedReservations.filter(
        (res) =>
            res.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            res.productName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeReservations = reservations.filter((r) => r.status === 'RESERVED').length;
    const committedReservations = reservations.filter((r) => r.status === 'COMMITTED').length;
    const releasedReservations = reservations.filter((r) => r.status === 'RELEASED').length;
    const totalQuantityReserved = reservations
        .filter((r) => r.status === 'RESERVED')
        .reduce((sum, r) => sum + r.quantity, 0);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Reservations</h1>
                <p className="text-zinc-400 mt-1">
                    Track inventory reservations from active orders
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                    <Clock className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Active</p>
                                    <p className="text-2xl font-bold text-white">{loading ? '-' : activeReservations}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <Package className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Committed</p>
                                    <p className="text-2xl font-bold text-white">{loading ? '-' : committedReservations}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Package className="h-6 w-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Released</p>
                                    <p className="text-2xl font-bold text-white">{loading ? '-' : releasedReservations}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <AlertTriangle className="h-6 w-6 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Qty Reserved</p>
                                    <p className="text-2xl font-bold text-white">{loading ? '-' : totalQuantityReserved}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Reservations Table */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white">Recent Reservations</CardTitle>
                                <CardDescription>
                                    {filteredReservations.length} reservations found
                                </CardDescription>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="Search by order or product..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400">Reservation ID</TableHead>
                                    <TableHead className="text-zinc-400">Order ID</TableHead>
                                    <TableHead className="text-zinc-400">Product</TableHead>
                                    <TableHead className="text-zinc-400">Quantity</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-zinc-400">Created</TableHead>
                                    <TableHead className="text-zinc-400">Expires/Released</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && reservations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                                            Loading reservations...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredReservations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                                            No reservations found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredReservations.map((reservation) => (
                                        <TableRow
                                            key={reservation.id}
                                            className="border-zinc-800 hover:bg-zinc-800/50"
                                        >
                                            <TableCell className="font-mono text-sm text-zinc-400">
                                                {reservation.id}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-blue-400">
                                                {reservation.orderId}
                                            </TableCell>
                                            <TableCell className="text-white">
                                                {reservation.productName}
                                            </TableCell>
                                            <TableCell className="text-white font-medium">
                                                {reservation.quantity}
                                            </TableCell>
                                            <TableCell>
                                                <ReservationStatusBadge status={reservation.status} />
                                            </TableCell>
                                            <TableCell className="text-zinc-500 text-sm">
                                                {format(new Date(reservation.createdAt), 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell className="text-zinc-500 text-sm">
                                                {reservation.status === 'RESERVED' && reservation.expiresAt
                                                    ? format(new Date(reservation.expiresAt), 'HH:mm')
                                                    : reservation.status === 'RELEASED' && 'releasedAt' in reservation && reservation.releasedAt
                                                        ? format(new Date(reservation.releasedAt as string), 'HH:mm')
                                                        : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Info Card */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-800/50 border-zinc-700">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-zinc-300">Reservation Lifecycle</h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    <strong className="text-yellow-500">RESERVED</strong> → Inventory locked, awaiting payment confirmation.
                                    <strong className="text-green-500 ml-2">COMMITTED</strong> → Payment successful, stock deducted.
                                    <strong className="text-blue-500 ml-2">RELEASED</strong> → Payment failed, stock returned.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
