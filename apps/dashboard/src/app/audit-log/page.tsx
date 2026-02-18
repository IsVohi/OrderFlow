'use client';

import { useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search, Shield, Activity, Settings, RefreshCw } from 'lucide-react';
// import { mockAuditLog } from '@/lib/mock-data/audit'; // Removed mock data
import type { AuditAction } from '@/lib/types/audit';

// Define empty logs or fetch from API if available
const mockAuditLog: any[] = [];

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

/**
 * Action badge styles
 */
function ActionBadge({ action }: { action: AuditAction }) {
    const styles: Record<string, string> = {
        CHAOS_ENABLED: 'bg-red-500/10 text-red-500 border-red-500/20',
        CHAOS_DISABLED: 'bg-green-500/10 text-green-500 border-green-500/20',
        CHAOS_CONFIG_CHANGED: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        DLQ_MESSAGE_REPLAYED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        DLQ_MESSAGE_DISCARDED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        SERVICE_RESTARTED: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        CONFIG_CHANGED: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    };

    const labels: Record<string, string> = {
        CHAOS_ENABLED: 'Chaos Enabled',
        CHAOS_DISABLED: 'Chaos Disabled',
        CHAOS_CONFIG_CHANGED: 'Config Changed',
        DLQ_MESSAGE_REPLAYED: 'DLQ Replayed',
        DLQ_MESSAGE_DISCARDED: 'DLQ Discarded',
        SERVICE_RESTARTED: 'Service Restart',
        CONFIG_CHANGED: 'Config Changed',
    };

    return (
        <Badge variant="outline" className={styles[action] || styles.CONFIG_CHANGED}>
            {labels[action] || action}
        </Badge>
    );
}

export default function AuditLogPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');

    const filteredLogs = mockAuditLog.filter((entry) => {
        const matchesSearch =
            entry.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.target.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            entry.target.id.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesAction = actionFilter === 'all' || entry.action === actionFilter;

        return matchesSearch && matchesAction;
    });

    // Stats
    const chaosActions = 0;
    const dlqActions = 0;
    const uniqueAdmins = 0;

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Audit Log</h1>
                <p className="text-zinc-400 mt-1">
                    Track administrative actions for accountability and debugging
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Shield className="h-6 w-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Total Actions</p>
                                    <p className="text-2xl font-bold text-white">{mockAuditLog.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                                    <Activity className="h-6 w-6 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Chaos Actions</p>
                                    <p className="text-2xl font-bold text-white">{chaosActions}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                    <RefreshCw className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">DLQ Actions</p>
                                    <p className="text-2xl font-bold text-white">{dlqActions}</p>
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
                                    <Settings className="h-6 w-6 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Unique Admins</p>
                                    <p className="text-2xl font-bold text-white">{uniqueAdmins}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Audit Table */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white">Recent Actions</CardTitle>
                                <CardDescription>
                                    {filteredLogs.length} entries
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Select
                                    value={actionFilter}
                                    onValueChange={setActionFilter}
                                >
                                    <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-white">
                                        <SelectValue placeholder="Filter by action" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-800 border-zinc-700">
                                        <SelectItem value="all" className="text-white">All Actions</SelectItem>
                                        <SelectItem value="CHAOS_ENABLED" className="text-white">Chaos Enabled</SelectItem>
                                        <SelectItem value="CHAOS_DISABLED" className="text-white">Chaos Disabled</SelectItem>
                                        <SelectItem value="CHAOS_CONFIG_CHANGED" className="text-white">Config Changed</SelectItem>
                                        <SelectItem value="DLQ_MESSAGE_REPLAYED" className="text-white">DLQ Replayed</SelectItem>
                                        <SelectItem value="DLQ_MESSAGE_DISCARDED" className="text-white">DLQ Discarded</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input
                                        placeholder="Search by admin or target..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400">Timestamp</TableHead>
                                    <TableHead className="text-zinc-400">Admin</TableHead>
                                    <TableHead className="text-zinc-400">Action</TableHead>
                                    <TableHead className="text-zinc-400">Target</TableHead>
                                    <TableHead className="text-zinc-400">Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.map((entry) => (
                                    <TableRow
                                        key={entry.id}
                                        className="border-zinc-800 hover:bg-zinc-800/50"
                                    >
                                        <TableCell className="text-zinc-400 text-sm">
                                            {format(entry.timestamp, 'MMM d, HH:mm:ss')}
                                        </TableCell>
                                        <TableCell className="text-white">
                                            {entry.adminEmail}
                                        </TableCell>
                                        <TableCell>
                                            <ActionBadge action={entry.action} />
                                        </TableCell>
                                        <TableCell className="text-white">
                                            <div>
                                                <span className="font-medium">{entry.target.name || entry.target.id}</span>
                                                <span className="text-xs text-zinc-500 ml-2">({entry.target.type})</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-zinc-500 text-sm font-mono">
                                            {entry.metadata ? JSON.stringify(entry.metadata) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
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
                            <Shield className="h-5 w-5 text-zinc-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-zinc-300">Audit Log Purpose</h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    This log tracks <strong className="text-zinc-300">operational actions only</strong>.
                                    Admins cannot mutate business data (orders, inventory) to preserve saga integrity.
                                    Actions tracked: chaos testing toggles, DLQ message handling, configuration changes.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
