'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    getSystemMetricsAction,
    getServiceHealthAction,
    getKafkaMetricsAction // Placeholder
} from '@/app/actions/dashboard';
import { listOrdersAction } from '@/app/actions/orders';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    Package,
    CheckCircle,
    XCircle,
    Activity,
    Clock,
    RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { format, subHours, startOfHour, isSameHour } from 'date-fns';
import { useAuth } from '@/lib/auth';
import { SystemMetrics, ServiceHealth, KafkaMetrics, Order } from '@/types';

// Animation variants for staggered children
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

// Stats Card Component
function StatCard({
    title,
    value,
    subValue,
    icon: Icon,
    trend,
    trendLabel,
}: {
    title: string;
    value: string | number;
    subValue?: string;
    icon: React.ElementType;
    trend?: 'up' | 'down' | 'neutral';
    trendLabel?: string;
}) {
    return (
        <motion.div variants={itemVariants}>
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-400">
                        {title}
                    </CardTitle>
                    <Icon className="h-4 w-4 text-zinc-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-white">{value}</div>
                    {subValue && (
                        <p className="text-xs text-zinc-500 mt-1">{subValue}</p>
                    )}
                    {trend && trendLabel && (
                        <p
                            className={`text-xs mt-2 ${trend === 'up'
                                ? 'text-green-500'
                                : trend === 'down'
                                    ? 'text-red-500'
                                    : 'text-zinc-500'
                                }`}
                        >
                            {trendLabel}
                        </p>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}

// Service Status Badge
function ServiceStatusBadge({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
    const variants = {
        healthy: 'bg-green-500/10 text-green-500 border-green-500/20',
        degraded: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        down: 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    return (
        <Badge variant="outline" className={variants[status]}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
}

// Custom Tooltip for Charts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
                <p className="text-xs text-zinc-400">
                    {format(new Date(label), 'MMM d, HH:mm')}
                </p>
                <p className="text-sm font-semibold text-white">
                    {payload[0].value.toLocaleString()}
                    {payload[0].dataKey === 'value' && payload[0].name === 'Failure Rate' && '%'}
                </p>
            </div>
        );
    }
    return null;
}

export default function DashboardPage() {
    const { user, token, isLoading: authLoading } = useAuth();

    // State for dashboard data
    const [metrics, setMetrics] = useState<SystemMetrics>({
        ordersProcessed: 0,
        successfulOrders: 0,
        failedOrders: 0,
        activeSagas: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        errorRate: 0,
        retryCount: 0
    });

    const [services, setServices] = useState<ServiceHealth[]>([]);

    const [kafka, setKafka] = useState<KafkaMetrics>({
        consumerLag: 0,
        messagesPerSecond: 0,
        partitions: 0,
        topics: 0
    });

    // Chart data state
    const [throughputData, setThroughputData] = useState<any[]>([]);
    const [failureRateData, setFailureRateData] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // 1. Fetch Metrics & Health
            const [sysMetrics, svcHealth, kMetrics] = await Promise.all([
                getSystemMetricsAction(token),
                getServiceHealthAction(),
                getKafkaMetricsAction(token)
            ]);

            setMetrics(sysMetrics);
            setServices(svcHealth);
            setKafka(kMetrics);

            // 2. Fetch recent orders to generate charts (last 100 orders)
            // This is a client-side approximation of time-series data
            const recentOrdersResult = await listOrdersAction({ limit: 100 }, token);
            const orders = recentOrdersResult.orders;

            // Generate last 24h buckets
            const now = new Date();
            const buckets: any[] = [];
            for (let i = 23; i >= 0; i--) {
                buckets.push({
                    timestamp: subHours(startOfHour(now), i).toISOString(),
                    count: 0,
                    failures: 0
                });
            }

            // Fill buckets
            orders.forEach((order: Order) => {
                const orderTime = new Date(order.createdAt);
                const bucket = buckets.find(b => isSameHour(new Date(b.timestamp), orderTime));
                if (bucket) {
                    bucket.count++;
                    if (order.status === 'FAILED') {
                        bucket.failures++;
                    }
                }
            });

            // Format for charts
            setThroughputData(buckets.map(b => ({
                timestamp: b.timestamp,
                value: b.count
            })));

            setFailureRateData(buckets.map(b => ({
                timestamp: b.timestamp,
                value: b.count > 0 ? parseFloat(((b.failures / b.count) * 100).toFixed(1)) : 0
            })));

        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!authLoading && token) {
            fetchData();
        }
    }, [fetchData, authLoading, token]);

    const successRate = metrics.ordersProcessed > 0
        ? ((metrics.successfulOrders / metrics.ordersProcessed) * 100).toFixed(1)
        : '0.0';

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-zinc-400 mt-1">
                    Real-time overview of the OrderFlow system
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Orders Processed"
                    value={loading ? '-' : metrics.ordersProcessed.toLocaleString()}
                    subValue="Total Orders"
                    icon={Package}
                    trend="up"
                    trendLabel="Live Data"
                />
                <StatCard
                    title="Successful Orders"
                    value={loading ? '-' : metrics.successfulOrders.toLocaleString()}
                    subValue={`${successRate}% success rate`}
                    icon={CheckCircle}
                    trend="up"
                    trendLabel="Live Data"
                />
                <StatCard
                    title="Failed Orders"
                    value={loading ? '-' : metrics.failedOrders}
                    subValue={`${metrics.errorRate}% error rate`}
                    icon={XCircle}
                    trend={metrics.errorRate > 5 ? "down" : "neutral"}
                    trendLabel="Live Data"
                />
                <StatCard
                    title="Active Sagas"
                    value={loading ? '-' : metrics.activeSagas}
                    subValue="In-progress orders"
                    icon={Activity}
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Throughput Chart */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Order Throughput</CardTitle>
                            <p className="text-sm text-zinc-500">Orders per hour (last 24h, based on recent 100)</p>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={throughputData}>
                                        <defs>
                                            <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <XAxis
                                            dataKey="timestamp"
                                            stroke="#71717a"
                                            tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis stroke="#71717a" tick={{ fontSize: 12 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            fill="url(#throughputGradient)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Failure Rate Chart */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Failure Rate</CardTitle>
                            <p className="text-sm text-zinc-500">Percentage of failed orders (last 24h)</p>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={failureRateData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <XAxis
                                            dataKey="timestamp"
                                            stroke="#71717a"
                                            tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis stroke="#71717a" tick={{ fontSize: 12 }} unit="%" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            name="Failure Rate"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* System Health & Kafka Metrics */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Latency Stats */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Latency Metrics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">Average</span>
                                <span className="text-white font-mono">{metrics.avgLatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">P95</span>
                                <span className="text-white font-mono">{metrics.p95LatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">P99</span>
                                <span className="text-white font-mono">{metrics.p99LatencyMs}ms</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Kafka Metrics */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Kafka Metrics
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">Consumer Lag</span>
                                <span className={`font-mono ${kafka.consumerLag > 100 ? 'text-yellow-500' : 'text-white'}`}>
                                    {kafka.consumerLag}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">Messages/sec</span>
                                <span className="text-white font-mono">{kafka.messagesPerSecond}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">Partitions</span>
                                <span className="text-white font-mono">{kafka.partitions}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">Retry Queue</span>
                                <span className="text-white font-mono">{metrics.retryCount}</span>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Service Health */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Service Health
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {services.length === 0 ? (
                                <div className="text-zinc-500 text-sm">Checking services...</div>
                            ) : (
                                services.map((service) => (
                                    <div
                                        key={service.name}
                                        className="flex justify-between items-center"
                                    >
                                        <span className="text-zinc-400 font-mono text-sm">
                                            {service.name}
                                        </span>
                                        <ServiceStatusBadge status={service.status} />
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
}
