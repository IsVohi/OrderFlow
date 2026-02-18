'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    getSystemMetricsAction,
    // generateLatencyData,
    // generateFailureRateData,
    // getRecentLogs,
} from '@/app/actions/dashboard'; // Use server action
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    Clock,
    AlertTriangle,
    RefreshCw,
    Search,
} from 'lucide-react';
import { LogEntry, SystemMetrics } from '@/types';

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

// Log Level Badge
function LogLevelBadge({ level }: { level: LogEntry['level'] }) {
    const styles = {
        info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        warn: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        error: 'bg-red-500/10 text-red-500 border-red-500/20',
        debug: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    };

    return (
        <Badge variant="outline" className={`${styles[level]} font-mono text-xs`}>
            {level.toUpperCase()}
        </Badge>
    );
}

// Metric Card
function MetricCard({
    title,
    value,
    unit,
    description,
    trend,
}: {
    title: string;
    value: number;
    unit: string;
    description: string;
    trend?: 'good' | 'bad' | 'neutral';
}) {
    const trendColors = {
        good: 'text-green-500',
        bad: 'text-red-500',
        neutral: 'text-zinc-400',
    };

    return (
        <motion.div variants={itemVariants}>
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="pt-6">
                    <div className="text-sm text-zinc-400">{title}</div>
                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold text-white">{value}</span>
                        <span className="text-zinc-500">{unit}</span>
                    </div>
                    <div className={`text-sm mt-1 ${trendColors[trend || 'neutral']}`}>
                        {description}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

// Custom Tooltip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
                <p className="text-xs text-zinc-400">
                    {format(new Date(label), 'MMM d, HH:mm')}
                </p>
                <p className="text-sm font-semibold text-white">{payload[0].value}</p>
            </div>
        );
    }
    return null;
}

import { useAuth, getStoredToken } from '@/lib/auth';

// ...

export default function ObservabilityPage() {
    const { user } = useAuth();
    // const identity = user ? { sub: user.id, role: user.role } : null;

    const [metrics, setMetrics] = useState<SystemMetrics>({
        ordersProcessed: 0,
        successfulOrders: 0,
        failedOrders: 0,
        activeSagas: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        errorRate: 0,
        retryCount: 0,
    });

    useEffect(() => {
        async function fetchMetrics() {
            const token = getStoredToken();
            if (token) {
                const data = await getSystemMetricsAction(token);
                setMetrics(data);
            }
        }
        fetchMetrics();
    }, [user]);

    // Logs
    const unfilteredLogs: LogEntry[] = []; // useMemo(() => getRecentLogs(identity), [identity]);

    const [logFilter, setLogFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [serviceFilter] = useState<string>('all');

    const latencyData: any[] = []; // useMemo(() => generateLatencyData(24), []);
    const failureRateData: any[] = []; // useMemo(() => generateFailureRateData(24, identity), [identity]);

    // Service distribution data
    const serviceDistribution: any[] = [
        { name: 'order', count: 0 },
        { name: 'inventory', count: 0 },
        { name: 'payment', count: 0 },
    ];

    // Filter logs
    const filteredLogs = useMemo(() => {
        return unfilteredLogs.filter((log) => {
            const matchesSearch =
                !logFilter ||
                log.message.toLowerCase().includes(logFilter.toLowerCase()) ||
                log.orderId?.toLowerCase().includes(logFilter.toLowerCase()) ||
                log.correlationId?.toLowerCase().includes(logFilter.toLowerCase());

            const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
            const matchesService =
                serviceFilter === 'all' || log.service === serviceFilter;

            return matchesSearch && matchesLevel && matchesService;
        });
    }, [unfilteredLogs, logFilter, levelFilter, serviceFilter]);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Observability</h1>
                <p className="text-zinc-400 mt-1">
                    Metrics, latency, and logs for the OrderFlow system
                </p>
            </div>

            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    title="Average Latency"
                    value={metrics.avgLatencyMs}
                    unit="ms"
                    description="P50 response time"
                    trend="good"
                />
                <MetricCard
                    title="P95 Latency"
                    value={metrics.p95LatencyMs}
                    unit="ms"
                    description="95th percentile"
                    trend="neutral"
                />
                <MetricCard
                    title="P99 Latency"
                    value={metrics.p99LatencyMs}
                    unit="ms"
                    description="99th percentile"
                    trend="bad"
                />
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Latency Over Time */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Latency Over Time
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={latencyData}>
                                        <defs>
                                            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <XAxis
                                            dataKey="timestamp"
                                            stroke="#71717a"
                                            tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis stroke="#71717a" tick={{ fontSize: 11 }} unit="ms" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#8b5cf6"
                                            fill="url(#latencyGradient)"
                                            strokeWidth={2}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Error Rate */}
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Error Rate
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={failureRateData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                        <XAxis
                                            dataKey="timestamp"
                                            stroke="#71717a"
                                            tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis stroke="#71717a" tick={{ fontSize: 11 }} unit="%" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
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

            {/* Service Distribution & Retry Stats */}
            <div className="grid gap-6 lg:grid-cols-3">
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Orders by Service</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={serviceDistribution} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                                        <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            stroke="#71717a"
                                            tick={{ fontSize: 11 }}
                                            width={60}
                                        />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants} className="lg:col-span-2">
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Retry Statistics
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <div className="text-2xl font-bold text-white">{metrics.retryCount}</div>
                                    <div className="text-sm text-zinc-500">Total Retries</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">89%</div>
                                    <div className="text-sm text-zinc-500">Retry Success Rate</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-white">2.3</div>
                                    <div className="text-sm text-zinc-500">Avg Attempts</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Log Viewer */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <CardTitle className="text-white">Log Viewer</CardTitle>
                            <div className="flex flex-wrap gap-2">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input
                                        placeholder="Search logs..."
                                        value={logFilter}
                                        onChange={(e) => setLogFilter(e.target.value)}
                                        className="pl-10 w-[200px] bg-zinc-800 border-zinc-700 text-white"
                                    />
                                </div>

                                {/* Level Filter */}
                                <Tabs value={levelFilter} onValueChange={setLevelFilter}>
                                    <TabsList className="bg-zinc-800">
                                        <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700 text-xs">
                                            All
                                        </TabsTrigger>
                                        <TabsTrigger value="error" className="data-[state=active]:bg-zinc-700 text-xs">
                                            Error
                                        </TabsTrigger>
                                        <TabsTrigger value="warn" className="data-[state=active]:bg-zinc-700 text-xs">
                                            Warn
                                        </TabsTrigger>
                                        <TabsTrigger value="info" className="data-[state=active]:bg-zinc-700 text-xs">
                                            Info
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-2 font-mono text-sm">
                                {filteredLogs.slice(0, 50).map((log) => (
                                    <div
                                        key={log.id}
                                        className={`p-3 rounded-lg border ${log.level === 'error'
                                            ? 'bg-red-500/5 border-red-500/20'
                                            : log.level === 'warn'
                                                ? 'bg-yellow-500/5 border-yellow-500/20'
                                                : 'bg-zinc-800/50 border-zinc-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-zinc-500 text-xs">
                                                {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                                            </span>
                                            <LogLevelBadge level={log.level} />
                                            <span className="text-zinc-500 text-xs">{log.service}</span>
                                            <span className="text-zinc-300 flex-1">{log.message}</span>
                                        </div>
                                        {(log.orderId || log.correlationId) && (
                                            <div className="mt-2 flex gap-4 text-xs">
                                                {log.orderId && (
                                                    <span>
                                                        <span className="text-zinc-500">orderId:</span>{' '}
                                                        <span className="text-blue-400">{log.orderId}</span>
                                                    </span>
                                                )}
                                                {log.correlationId && (
                                                    <span>
                                                        <span className="text-zinc-500">correlationId:</span>{' '}
                                                        <span className="text-purple-400">{log.correlationId}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
