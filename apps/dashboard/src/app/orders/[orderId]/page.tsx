'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getOrderAction, updateOrderStatusAction } from '../../actions/orders';
import { useAuth } from '@/lib/auth';
import { OrderStatus, OrderEvent, Order } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import {
    ArrowLeft,
    Package,
    CreditCard,
    Warehouse,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Copy,
    Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Saga step definitions
const sagaSteps = [
    { key: 'order.created', label: 'Order Created', icon: Package, service: 'order-service' },
    { key: 'order.confirmed', label: 'Inventory Reserved', icon: Warehouse, service: 'inventory-service' },
    { key: 'order.paid', label: 'Payment Captured', icon: CreditCard, service: 'payment-service' },
    { key: 'order.fulfilled', label: 'Order Fulfilled', icon: CheckCircle, service: 'order-service' },
];

const compensationSteps = [
    { key: 'order.payment_failed', label: 'Payment Failed', icon: XCircle, service: 'payment-service' },
    { key: 'order.cancelled', label: 'Order Cancelled', icon: AlertTriangle, service: 'order-service' },
];

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

function TimelineStep({
    step,
    event,
    isCompleted,
    isCurrent,
    isCompensation,
}: {
    step: typeof sagaSteps[0];
    event?: OrderEvent;
    isCompleted: boolean;
    isCurrent: boolean;
    isCompensation?: boolean;
}) {
    const Icon = step.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex gap-4"
        >
            {/* Connector Line */}
            <div className="flex flex-col items-center">
                <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${isCompensation
                        ? 'border-red-500 bg-red-500/10'
                        : isCompleted
                            ? 'border-green-500 bg-green-500/10'
                            : isCurrent
                                ? 'border-blue-500 bg-blue-500/10 animate-pulse'
                                : 'border-zinc-700 bg-zinc-800'
                        }`}
                >
                    <Icon
                        className={`h-5 w-5 ${isCompensation
                            ? 'text-red-500'
                            : isCompleted
                                ? 'text-green-500'
                                : isCurrent
                                    ? 'text-blue-500'
                                    : 'text-zinc-500'
                            }`}
                    />
                </div>
                <div className="w-0.5 h-12 bg-zinc-700" />
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
                <div className="flex items-center gap-2">
                    <h3
                        className={`font-medium ${isCompensation
                            ? 'text-red-500'
                            : isCompleted || isCurrent
                                ? 'text-white'
                                : 'text-zinc-500'
                            }`}
                    >
                        {step.label}
                    </h3>
                    {isCompensation && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                            Compensation
                        </Badge>
                    )}
                </div>
                <p className="text-sm text-zinc-500 mt-1">{step.service}</p>
                {event && (
                    <div className="mt-2 text-xs text-zinc-400">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss.SSS')}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.orderId as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { toast } = useToast();



    const { user, token } = useAuth();

    const handleAction = async (action: 'confirm' | 'pay' | 'fulfill' | 'cancel') => {
        if (!token || !order) return;
        setActionLoading(action);

        try {
            await updateOrderStatusAction(order.id, action, token);
            toast({
                title: 'Order Updated',
                description: `Order successfully ${action}ed`,
            });
            // Refresh order immediately
            const updated = await getOrderAction(order.id, token);
            if (updated) setOrder(updated);
        } catch (error) {
            toast({
                title: 'Action Failed',
                description: `Failed to ${action} order`,
                variant: 'destructive',
            });
        } finally {
            setActionLoading(null);
        }
    };

    useEffect(() => {
        let isMounted = true;

        async function fetchOrder() {
            if (!token) return;

            try {
                const data = await getOrderAction(orderId, token);
                if (isMounted) {
                    if (data) {
                        setOrder(data);
                    } else {
                        setError('Order not found or access denied');
                    }
                }
            } catch (err) {
                if (isMounted) setError('Failed to load order');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        if (token) {
            fetchOrder();
        } else {
            // Wait for token or handle not logged in
            // setLoading(false); // don't stop loading until we check token availability logic
        }
    }, [orderId, token]);

    // Polling for updates (since events come in async)
    useEffect(() => {
        if (!order || !token) return;

        // Stop polling if final state reached
        if (['FULFILLED', 'FAILED', 'CANCELLED'].includes(order.status)) return;

        const interval = setInterval(async () => {
            const data = await getOrderAction(orderId, token);
            if (data) setOrder(data);
        }, 3000);

        return () => clearInterval(interval);
    }, [order, orderId, token]);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="space-y-6">
                <Link href="/orders">
                    <Button variant="ghost" className="text-zinc-400 hover:text-white">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Orders
                    </Button>
                </Link>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="pt-6">
                        <div className="text-center py-12">
                            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-white">Order Not Found</h2>
                            <p className="text-zinc-400 mt-2">
                                {error || `Order ID "${orderId}" does not exist or you do not have permission to view it.`}
                            </p>
                            <Link href="/create-order" className="mt-4 inline-block">
                                <Button variant="outline" className="border-zinc-700">
                                    Create New Order
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const eventTypes = order.events.map((e) => e.type);
    const isFailed = order.status === 'FAILED' || order.status === 'CANCELLED';
    const hasCompensation = eventTypes.includes('InventoryReleased') || eventTypes.includes('PaymentFailed');

    const copyCorrelationId = () => {
        navigator.clipboard.writeText(order.correlationId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            {/* Back Button */}
            <Link href="/orders">
                <Button variant="ghost" className="text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Orders
                </Button>
            </Link>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white font-mono">{order.id}</h1>
                        <Badge variant="outline" className={statusStyles[order.status]}>
                            {order.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-zinc-500">Correlation ID:</span>
                        <code className="text-sm text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                            {order.correlationId}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            onClick={copyCorrelationId}
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                        {copied && <span className="text-xs text-green-500">Copied!</span>}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-white">
                        ${Number(order.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-zinc-500">
                        {format(new Date(order.createdAt), 'MMMM d, yyyy HH:mm:ss')}
                    </div>
                </div>
            </div>

            {/* Actions Toolbar - Role-Based */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4 flex flex-wrap gap-2 items-center justify-between">
                    <div className="text-sm text-zinc-400">
                        Available Actions
                    </div>
                    <div className="flex gap-2">
                        {/* USER Role: Can pay for PAYMENT_PENDING orders */}
                        {user?.role === 'USER' && (
                            <>
                                {(order.status === 'CONFIRMED' || order.status === 'PAYMENT_PENDING') && (
                                    <Link href={`/orders/${order.id}/payment`}>
                                        <Button
                                            size="sm"
                                            className="bg-purple-600 hover:bg-purple-700 text-white"
                                        >
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            Pay Now
                                        </Button>
                                    </Link>
                                )}
                                {['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'FAILED'].includes(order.status) && (
                                    <span className="text-sm text-zinc-500 italic">
                                        {order.status === 'PENDING' && 'Waiting for seller confirmation'}
                                        {order.status === 'PAID' && 'Payment successful - Awaiting fulfillment'}
                                        {order.status === 'FULFILLED' && 'Order completed'}
                                        {(order.status === 'CANCELLED' || order.status === 'FAILED') && 'Order closed'}
                                    </span>
                                )}
                            </>
                        )}

                        {/* SELLER Role: Can confirm PENDING and fulfill PAID orders */}
                        {user?.role === 'SELLER' && (
                            <>
                                {order.status === 'PENDING' && (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction('confirm')}
                                            disabled={!!actionLoading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {actionLoading === 'confirm' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Confirm Order
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleAction('cancel')}
                                            disabled={!!actionLoading}
                                        >
                                            {actionLoading === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Reject
                                        </Button>
                                    </>
                                )}
                                {order.status === 'PAID' && (
                                    <Button
                                        size="sm"
                                        onClick={() => handleAction('fulfill')}
                                        disabled={!!actionLoading}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {actionLoading === 'fulfill' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Fulfill Order
                                    </Button>
                                )}
                                {['CONFIRMED', 'PAYMENT_PENDING', 'FULFILLED', 'CANCELLED', 'FAILED'].includes(order.status) && (
                                    <span className="text-sm text-zinc-500 italic">
                                        {(order.status === 'CONFIRMED' || order.status === 'PAYMENT_PENDING') && 'Waiting for customer payment'}
                                        {order.status === 'FULFILLED' && 'Order completed'}
                                        {(order.status === 'CANCELLED' || order.status === 'FAILED') && 'No actions available'}
                                    </span>
                                )}
                            </>
                        )}

                        {/* ADMIN Role: Can perform any action (existing logic) */}
                        {user?.role === 'ADMIN' && (
                            <>
                                {order.status === 'PENDING' && (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction('confirm')}
                                            disabled={!!actionLoading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {actionLoading === 'confirm' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Confirm Order
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleAction('cancel')}
                                            disabled={!!actionLoading}
                                        >
                                            {actionLoading === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Cancel Order
                                        </Button>
                                    </>
                                )}
                                {(order.status === 'CONFIRMED' || order.status === 'PAYMENT_PENDING') && (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction('pay')}
                                            disabled={!!actionLoading}
                                            className="bg-purple-600 hover:bg-purple-700 text-white"
                                        >
                                            {actionLoading === 'pay' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Mark Paid (Admin)
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleAction('cancel')}
                                            disabled={!!actionLoading}
                                        >
                                            {actionLoading === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Cancel Order
                                        </Button>
                                    </>
                                )}
                                {order.status === 'PAID' && (
                                    <Button
                                        size="sm"
                                        onClick={() => handleAction('fulfill')}
                                        disabled={!!actionLoading}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {actionLoading === 'fulfill' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Fulfill Order
                                    </Button>
                                )}
                                {['FULFILLED', 'CANCELLED', 'FAILED'].includes(order.status) && (
                                    <span className="text-sm text-zinc-500 italic">No actions available</span>
                                )}
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Failure Alert */}
            {isFailed && order.failureReason && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="bg-red-500/10 border-red-500/20">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-start gap-3">
                                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                                <div>
                                    <h3 className="font-medium text-red-500">Order Failed</h3>
                                    <p className="text-sm text-red-400 mt-1">{order.failureReason}</p>
                                    <p className="text-xs text-red-400/70 mt-2">
                                        Compensation actions were executed to maintain data consistency.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Saga Timeline */}
                <div className="lg:col-span-2">
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">
                                {hasCompensation ? 'Saga Timeline (With Compensation)' : 'Saga Timeline'}
                            </CardTitle>
                            <p className="text-sm text-zinc-500">
                                Visual representation of the order processing saga
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-0">
                                {/* Normal saga steps */}
                                {sagaSteps.map((step, index) => {
                                    const event = order.events.find((e) => e.type === step.key);
                                    const isCompleted = !!event;
                                    const lastCompletedIndex = sagaSteps.findIndex(
                                        (s) => !order.events.find((e) => e.type === s.key)
                                    );
                                    const isCurrent =
                                        !hasCompensation &&
                                        index === (lastCompletedIndex === -1 ? sagaSteps.length : lastCompletedIndex);

                                    // Skip steps after payment if failed
                                    if (hasCompensation && index > 2 && !event) return null;

                                    return (
                                        <TimelineStep
                                            key={step.key}
                                            step={step}
                                            event={event}
                                            isCompleted={isCompleted}
                                            isCurrent={isCurrent}
                                        />
                                    );
                                })}

                                {/* Compensation steps */}
                                {hasCompensation && (
                                    <>
                                        <Separator className="my-4 bg-red-500/20" />
                                        <div className="text-xs text-red-500 uppercase tracking-wider mb-4 font-medium">
                                            Compensation Flow
                                        </div>
                                        {compensationSteps.map((step) => {
                                            const event = order.events.find((e) => e.type === step.key);
                                            if (!event) return null;

                                            return (
                                                <TimelineStep
                                                    key={step.key}
                                                    step={step}
                                                    event={event}
                                                    isCompleted={true}
                                                    isCurrent={false}
                                                    isCompensation={true}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Order Details Sidebar */}
                <div className="space-y-6">
                    {/* Order Info */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white text-base">Order Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">Customer</div>
                                <div className="text-white font-mono mt-1">{order.customerId}</div>
                            </div>
                            <Separator className="bg-zinc-800" />
                            <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">Status</div>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant="outline" className={statusStyles[order.status]}>
                                        {order.status}
                                    </Badge>
                                </div>
                            </div>
                            <Separator className="bg-zinc-800" />
                            <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">Payment</div>
                                <div className="text-white mt-1">{order.paymentStatus}</div>
                            </div>
                            <Separator className="bg-zinc-800" />
                            <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider">Inventory</div>
                                <div className="text-white mt-1">{order.inventoryStatus}</div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line Items */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white text-base">Line Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-start">
                                    <div>
                                        <div className="text-white">{item.productName}</div>
                                        <div className="text-sm text-zinc-500">
                                            Qty: {item.quantity} × ${Number(item.price).toFixed(2)}
                                        </div>
                                    </div>
                                    <div className="text-white font-medium">
                                        ${(Number(item.quantity) * Number(item.price)).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                            <Separator className="bg-zinc-800 my-4" />
                            <div className="flex justify-between items-center font-medium">
                                <span className="text-zinc-400">Total</span>
                                <span className="text-white text-lg">${Number(order.totalAmount).toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Shipping */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white text-base">Shipping Address</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-zinc-400 text-sm space-y-1">
                                <div>{order.shippingAddress.street}</div>
                                <div>
                                    {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                                    {order.shippingAddress.zipCode}
                                </div>
                                <div>{order.shippingAddress.country}</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Event Log */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-white">Event Log</CardTitle>
                    <p className="text-sm text-zinc-500">Raw events received for this order</p>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                            {order.events.map((event) => (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-zinc-800 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="font-medium text-white">{event.type}</span>
                                            <span className="ml-2 text-xs text-zinc-500">{event.service}</span>
                                        </div>
                                        <span className="text-xs text-zinc-500">
                                            {format(new Date(event.timestamp), 'HH:mm:ss.SSS')}
                                        </span>
                                    </div>
                                    <pre className="mt-2 text-xs text-zinc-400 bg-zinc-900 p-2 rounded overflow-x-auto">
                                        {JSON.stringify(event.payload, null, 2)}
                                    </pre>
                                </motion.div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </motion.div>
    );
}
