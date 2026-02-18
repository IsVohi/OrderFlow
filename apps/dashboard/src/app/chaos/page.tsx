'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Zap,
    Play,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Package,
    CreditCard,
    Warehouse,
    RefreshCw,
    Info,
} from 'lucide-react';

interface ChaosConfig {
    failNextPayment: boolean;
    delayInventory: boolean;
    delayInventoryMs: number;
    databaseTimeout: boolean;
    networkPartition: boolean;
}

interface SagaStep {
    name: string;
    status: 'pending' | 'running' | 'success' | 'failed' | 'compensated';
    icon: React.ElementType;
    timestamp?: Date;
    duration?: number;
}

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

// Saga Step Component
function SagaStepIndicator({
    step,
    isLast,
}: {
    step: SagaStep;
    isLast: boolean;
}) {
    const Icon = step.icon;
    const statusStyles = {
        pending: 'border-zinc-600 bg-zinc-800 text-zinc-500',
        running: 'border-blue-500 bg-blue-500/20 text-blue-500 animate-pulse',
        success: 'border-green-500 bg-green-500/20 text-green-500',
        failed: 'border-red-500 bg-red-500/20 text-red-500',
        compensated: 'border-yellow-500 bg-yellow-500/20 text-yellow-500',
    };

    return (
        <div className="flex items-center">
            <div className="flex flex-col items-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${statusStyles[step.status]}`}
                >
                    {step.status === 'running' ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : step.status === 'success' ? (
                        <CheckCircle className="w-5 h-5" />
                    ) : step.status === 'failed' ? (
                        <XCircle className="w-5 h-5" />
                    ) : (
                        <Icon className="w-5 h-5" />
                    )}
                </motion.div>
                <span className={`text-xs mt-2 ${step.status === 'pending' ? 'text-zinc-500' : 'text-zinc-300'}`}>
                    {step.name}
                </span>
                {step.duration && (
                    <span className="text-xs text-zinc-500">{step.duration}ms</span>
                )}
            </div>
            {!isLast && (
                <div
                    className={`w-16 h-0.5 mx-2 ${step.status === 'success'
                        ? 'bg-green-500'
                        : step.status === 'failed' || step.status === 'compensated'
                            ? 'bg-red-500'
                            : 'bg-zinc-700'
                        }`}
                />
            )}
        </div>
    );
}

export default function ChaosPage() {
    const [config, setConfig] = useState<ChaosConfig>({
        failNextPayment: false,
        delayInventory: false,
        delayInventoryMs: 3000,
        databaseTimeout: false,
        networkPartition: false,
    });

    const [isCreating, setIsCreating] = useState(false);
    const [orderId, setOrderId] = useState('');
    const [customerId, setCustomerId] = useState('cust_demo_001');
    const [productId, setProductId] = useState('prod_laptop');
    const [quantity, setQuantity] = useState(1);

    const [sagaSteps, setSagaSteps] = useState<SagaStep[]>([
        { name: 'Create Order', status: 'pending', icon: Package },
        { name: 'Reserve Inventory', status: 'pending', icon: Warehouse },
        { name: 'Capture Payment', status: 'pending', icon: CreditCard },
        { name: 'Fulfill Order', status: 'pending', icon: CheckCircle },
    ]);

    const [orderResult, setOrderResult] = useState<{
        status: 'success' | 'failed' | null;
        message: string;
        orderId?: string;
    }>({ status: null, message: '' });

    const [eventLog, setEventLog] = useState<
        { timestamp: Date; event: string; type: 'info' | 'success' | 'error' | 'warn' }[]
    >([]);

    const addLogEvent = useCallback((event: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        setEventLog((prev) => [
            { timestamp: new Date(), event, type },
            ...prev.slice(0, 19),
        ]);
    }, []);

    const resetSaga = () => {
        setSagaSteps([
            { name: 'Create Order', status: 'pending', icon: Package },
            { name: 'Reserve Inventory', status: 'pending', icon: Warehouse },
            { name: 'Capture Payment', status: 'pending', icon: CreditCard },
            { name: 'Fulfill Order', status: 'pending', icon: CheckCircle },
        ]);
        setOrderResult({ status: null, message: '' });
        setOrderId('');
    };

    const simulateOrderCreation = async () => {
        resetSaga();
        setIsCreating(true);
        setEventLog([]);

        const newOrderId = `ord_${Math.random().toString(36).substring(2, 10)}`;
        setOrderId(newOrderId);

        // Step 1: Create Order
        addLogEvent(`Creating order ${newOrderId}...`, 'info');
        setSagaSteps((prev) =>
            prev.map((s, i) => (i === 0 ? { ...s, status: 'running' } : s))
        );
        await new Promise((r) => setTimeout(r, 800));
        setSagaSteps((prev) =>
            prev.map((s, i) => (i === 0 ? { ...s, status: 'success', duration: 245 } : s))
        );
        addLogEvent(`Order ${newOrderId} created successfully`, 'success');

        // Step 2: Reserve Inventory
        addLogEvent('Reserving inventory...', 'info');
        setSagaSteps((prev) =>
            prev.map((s, i) => (i === 1 ? { ...s, status: 'running' } : s))
        );

        if (config.delayInventory) {
            addLogEvent(`⚠️ Injected delay: ${config.delayInventoryMs}ms`, 'warn');
            await new Promise((r) => setTimeout(r, config.delayInventoryMs));
        } else {
            await new Promise((r) => setTimeout(r, 600));
        }

        setSagaSteps((prev) =>
            prev.map((s, i) =>
                i === 1
                    ? { ...s, status: 'success', duration: config.delayInventory ? config.delayInventoryMs : 312 }
                    : s
            )
        );
        addLogEvent('Inventory reserved successfully', 'success');

        // Step 3: Capture Payment
        addLogEvent('Capturing payment...', 'info');
        setSagaSteps((prev) =>
            prev.map((s, i) => (i === 2 ? { ...s, status: 'running' } : s))
        );
        await new Promise((r) => setTimeout(r, 1000));

        if (config.failNextPayment) {
            // Payment Failed - Trigger Compensation
            setSagaSteps((prev) =>
                prev.map((s, i) => (i === 2 ? { ...s, status: 'failed', duration: 987 } : s))
            );
            addLogEvent('❌ Payment failed: Card declined', 'error');

            // Compensation: Release Inventory
            addLogEvent('⚡ Triggering compensation flow...', 'warn');
            await new Promise((r) => setTimeout(r, 500));
            setSagaSteps((prev) =>
                prev.map((s, i) =>
                    i === 1 ? { ...s, status: 'compensated', name: 'Inventory Released' } : s
                )
            );
            addLogEvent('Inventory released (compensation)', 'warn');

            // Update order status
            await new Promise((r) => setTimeout(r, 300));
            setSagaSteps((prev) =>
                prev.map((s, i) =>
                    i === 0 ? { ...s, status: 'compensated', name: 'Order Cancelled' } : s
                )
            );
            addLogEvent('Order cancelled due to payment failure', 'error');

            setOrderResult({
                status: 'failed',
                message: 'Payment failed. Saga compensation executed successfully.',
                orderId: newOrderId,
            });
        } else {
            // Payment Success
            setSagaSteps((prev) =>
                prev.map((s, i) => (i === 2 ? { ...s, status: 'success', duration: 523 } : s))
            );
            addLogEvent('Payment captured successfully', 'success');

            // Step 4: Fulfill Order
            addLogEvent('Fulfilling order...', 'info');
            setSagaSteps((prev) =>
                prev.map((s, i) => (i === 3 ? { ...s, status: 'running' } : s))
            );
            await new Promise((r) => setTimeout(r, 500));
            setSagaSteps((prev) =>
                prev.map((s, i) => (i === 3 ? { ...s, status: 'success', duration: 156 } : s))
            );
            addLogEvent(`✅ Order ${newOrderId} fulfilled successfully!`, 'success');

            setOrderResult({
                status: 'success',
                message: 'Order processed successfully through all saga steps.',
                orderId: newOrderId,
            });
        }

        setIsCreating(false);
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Zap className="h-8 w-8 text-yellow-500" />
                    Chaos Testing
                </h1>
                <p className="text-zinc-400 mt-1">
                    Inject failures and observe how the saga pattern handles compensation
                </p>
            </div>

            {/* Info Banner */}
            <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-medium text-blue-400">Demo Feature</h3>
                            <p className="text-sm text-blue-300/80 mt-1">
                                This panel simulates order creation with configurable failure injection.
                                Enable &quot;Fail Next Payment&quot; to see the saga compensation pattern in action.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Failure Injection Panel */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                Failure Injection
                            </CardTitle>
                            <CardDescription>
                                Configure which failures to inject
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Fail Payment */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-white">Fail Next Payment</div>
                                    <div className="text-sm text-zinc-500">Simulates card_declined</div>
                                </div>
                                <Switch
                                    checked={config.failNextPayment}
                                    onCheckedChange={(checked) =>
                                        setConfig((c) => ({ ...c, failNextPayment: checked }))
                                    }
                                />
                            </div>

                            <Separator className="bg-zinc-800" />

                            {/* Delay Inventory */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-white">Delay Inventory</div>
                                        <div className="text-sm text-zinc-500">Add latency to inventory service</div>
                                    </div>
                                    <Switch
                                        checked={config.delayInventory}
                                        onCheckedChange={(checked) =>
                                            setConfig((c) => ({ ...c, delayInventory: checked }))
                                        }
                                    />
                                </div>
                                {config.delayInventory && (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={config.delayInventoryMs}
                                            onChange={(e) =>
                                                setConfig((c) => ({ ...c, delayInventoryMs: parseInt(e.target.value) || 0 }))
                                            }
                                            className="w-24 bg-zinc-800 border-zinc-700 text-white"
                                        />
                                        <span className="text-zinc-500 text-sm">ms</span>
                                    </div>
                                )}
                            </div>

                            <Separator className="bg-zinc-800" />

                            {/* Database Timeout */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-white">Database Timeout</div>
                                    <div className="text-sm text-zinc-500">Simulate DB connection issues</div>
                                </div>
                                <Switch
                                    checked={config.databaseTimeout}
                                    onCheckedChange={(checked) =>
                                        setConfig((c) => ({ ...c, databaseTimeout: checked }))
                                    }
                                    disabled
                                />
                            </div>

                            <Separator className="bg-zinc-800" />

                            {/* Network Partition */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-white">Network Partition</div>
                                    <div className="text-sm text-zinc-500">Simulate Kafka disconnection</div>
                                </div>
                                <Switch
                                    checked={config.networkPartition}
                                    onCheckedChange={(checked) =>
                                        setConfig((c) => ({ ...c, networkPartition: checked }))
                                    }
                                    disabled
                                />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Order Creator & Saga Visualization */}
                <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                    {/* Order Creator */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Create Test Order</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div>
                                    <label className="text-sm text-zinc-500">Customer ID</label>
                                    <Input
                                        value={customerId}
                                        onChange={(e) => setCustomerId(e.target.value)}
                                        className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-500">Product</label>
                                    <Input
                                        value={productId}
                                        onChange={(e) => setProductId(e.target.value)}
                                        className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-500">Quantity</label>
                                    <Input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                        className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={simulateOrderCreation}
                                disabled={isCreating}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isCreating ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Create Order & Run Saga
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Saga Visualization */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Saga Flow Visualization</CardTitle>
                            {orderId && (
                                <div className="text-sm text-zinc-500">
                                    Order ID: <code className="text-zinc-300">{orderId}</code>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-center items-center py-8 overflow-x-auto">
                                {sagaSteps.map((step, index) => (
                                    <SagaStepIndicator
                                        key={step.name}
                                        step={step}
                                        isLast={index === sagaSteps.length - 1}
                                    />
                                ))}
                            </div>

                            {/* Result Banner */}
                            <AnimatePresence>
                                {orderResult.status && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`mt-4 p-4 rounded-lg ${orderResult.status === 'success'
                                            ? 'bg-green-500/10 border border-green-500/20'
                                            : 'bg-red-500/10 border border-red-500/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {orderResult.status === 'success' ? (
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-500" />
                                            )}
                                            <span
                                                className={
                                                    orderResult.status === 'success' ? 'text-green-400' : 'text-red-400'
                                                }
                                            >
                                                {orderResult.message}
                                            </span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Event Log */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-white">Event Log</CardTitle>
                        <CardDescription>Real-time events during saga execution</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[200px]">
                            <div className="space-y-2 font-mono text-sm">
                                {eventLog.length === 0 ? (
                                    <div className="text-zinc-500 text-center py-8">
                                        Click &quot;Create Order & Run Saga&quot; to see events here
                                    </div>
                                ) : (
                                    eventLog.map((entry, i) => (
                                        <div
                                            key={i}
                                            className={`flex items-start gap-3 p-2 rounded ${entry.type === 'error'
                                                ? 'bg-red-500/5'
                                                : entry.type === 'warn'
                                                    ? 'bg-yellow-500/5'
                                                    : entry.type === 'success'
                                                        ? 'bg-green-500/5'
                                                        : 'bg-zinc-800/30'
                                                }`}
                                        >
                                            <span className="text-zinc-500 text-xs whitespace-nowrap">
                                                {format(entry.timestamp, 'HH:mm:ss.SSS')}
                                            </span>
                                            <span
                                                className={
                                                    entry.type === 'error'
                                                        ? 'text-red-400'
                                                        : entry.type === 'warn'
                                                            ? 'text-yellow-400'
                                                            : entry.type === 'success'
                                                                ? 'text-green-400'
                                                                : 'text-zinc-300'
                                                }
                                            >
                                                {entry.event}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
