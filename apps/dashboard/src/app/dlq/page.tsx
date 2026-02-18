'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertTriangle,
    RefreshCw,
    Trash2,
    Eye,
    Inbox,
    CheckCircle,
    XCircle,
} from 'lucide-react';
// import { mockDLQMessages, getDLQStats } from '@/lib/mock-data/audit'; // Removed mock data
import type { DLQStatus } from '@/lib/types/audit';

const mockDLQMessages: any[] = [];
const getDLQStats = () => ({
    totalMessages: 0,
    pendingMessages: 0,
    replayedMessages: 0,
    discardedMessages: 0
});

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
 * DLQ Status badge
 */
function StatusBadge({ status }: { status: DLQStatus }) {
    const styles: Record<DLQStatus, string> = {
        PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        REPLAYED: 'bg-green-500/10 text-green-500 border-green-500/20',
        DISCARDED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    };

    return (
        <Badge variant="outline" className={styles[status]}>
            {status}
        </Badge>
    );
}

export default function DeadLetterQueuePage() {
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const stats = getDLQStats();

    const pendingMessages = mockDLQMessages.filter((m) => m.status === 'PENDING');
    const processedMessages = mockDLQMessages.filter((m) => m.status !== 'PENDING');

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">Dead Letter Queue</h1>
                <p className="text-zinc-400 mt-1">
                    Monitor and manage failed Kafka messages
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Inbox className="h-6 w-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Total Messages</p>
                                    <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
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
                                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Pending</p>
                                    <p className="text-2xl font-bold text-white">{stats.pendingMessages}</p>
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
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Replayed</p>
                                    <p className="text-2xl font-bold text-white">{stats.replayedMessages}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-zinc-500/10 flex items-center justify-center">
                                    <XCircle className="h-6 w-6 text-zinc-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Discarded</p>
                                    <p className="text-2xl font-bold text-white">{stats.discardedMessages}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Pending Messages */}
            {pendingMessages.length > 0 && (
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-white flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                        Pending Messages
                                    </CardTitle>
                                    <CardDescription>
                                        {pendingMessages.length} messages require attention
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-800 hover:bg-transparent">
                                        <TableHead className="text-zinc-400">Topic</TableHead>
                                        <TableHead className="text-zinc-400">Event Type</TableHead>
                                        <TableHead className="text-zinc-400">Failure Reason</TableHead>
                                        <TableHead className="text-zinc-400">Retries</TableHead>
                                        <TableHead className="text-zinc-400">First Failed</TableHead>
                                        <TableHead className="text-zinc-400">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingMessages.map((msg) => (
                                        <TableRow
                                            key={msg.id}
                                            className="border-zinc-800 hover:bg-zinc-800/50"
                                        >
                                            <TableCell className="font-mono text-sm text-blue-400">
                                                {msg.originalTopic}
                                            </TableCell>
                                            <TableCell className="text-white">
                                                {(msg.value as { eventType?: string }).eventType || 'Unknown'}
                                            </TableCell>
                                            <TableCell className="text-red-400 text-sm">
                                                {msg.failureReason}
                                            </TableCell>
                                            <TableCell className="text-white font-medium">
                                                {msg.failureCount}
                                            </TableCell>
                                            <TableCell className="text-zinc-500 text-sm">
                                                {format(msg.firstFailedAt, 'MMM d, HH:mm')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-zinc-400 hover:text-white"
                                                        onClick={() => setSelectedMessage(msg.id)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-400 hover:text-blue-300"
                                                        title="Replay message"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300"
                                                        title="Discard message"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Selected Message Preview */}
            {selectedMessage && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                >
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white">Message Payload</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedMessage(null)}
                                    className="text-zinc-400"
                                >
                                    Close
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto">
                                {JSON.stringify(
                                    mockDLQMessages.find((m) => m.id === selectedMessage)?.value,
                                    null,
                                    2
                                )}
                            </pre>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Processed Messages */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-white">Processed Messages</CardTitle>
                        <CardDescription>
                            Previously handled DLQ messages
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-400">Topic</TableHead>
                                    <TableHead className="text-zinc-400">Event Type</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-zinc-400">Processed By</TableHead>
                                    <TableHead className="text-zinc-400">Processed At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedMessages.map((msg) => (
                                    <TableRow
                                        key={msg.id}
                                        className="border-zinc-800 hover:bg-zinc-800/50"
                                    >
                                        <TableCell className="font-mono text-sm text-zinc-400">
                                            {msg.originalTopic}
                                        </TableCell>
                                        <TableCell className="text-white">
                                            {(msg.value as { eventType?: string }).eventType || 'Unknown'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={msg.status} />
                                        </TableCell>
                                        <TableCell className="text-zinc-400">
                                            {msg.replayedBy || '-'}
                                        </TableCell>
                                        <TableCell className="text-zinc-500 text-sm">
                                            {msg.replayedAt ? format(msg.replayedAt, 'MMM d, HH:mm') : '-'}
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
                            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-zinc-300">Dead Letter Queue Design</h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    Messages land in DLQ after exceeding retry limits (default: 3).
                                    <strong className="text-zinc-300 ml-1">Replay</strong> re-publishes to original topic.
                                    <strong className="text-zinc-300 ml-1">Discard</strong> marks as handled without retry.
                                    All actions are logged in the Audit Log.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
