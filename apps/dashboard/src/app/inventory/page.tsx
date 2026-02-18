'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
    Search,
    Package,
    AlertTriangle,
    Plus,
    Warehouse,
    RefreshCw,
} from 'lucide-react';
import { useAuth, getStoredToken } from '@/lib/auth'; // Updated import
import { createProductAction, getInventoryAction } from '../actions/inventory'; // Updated import
import { Product } from '@/types'; // Import type
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';


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

function StockBadge({ totalStock, availableStock }: { totalStock: number; availableStock: number }) {
    if (totalStock === 0 || availableStock === 0) {
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Out of Stock</Badge>;
    }
    if (availableStock < 10) {
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Low Stock</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">In Stock</Badge>;
}

export default function InventoryPage() {
    const { user } = useAuth();
    const [inventory, setInventory] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', sku: '', quantity: '', price: '', description: '' });
    const [dialogOpen, setDialogOpen] = useState(false);

    const fetchInventory = async () => {
        const token = getStoredToken();
        if (!token) return;

        setLoading(true);
        try {
            const data = await getInventoryAction(token);
            setInventory(data);
        } catch (error) {
            console.error('Failed to fetch inventory', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, [user]);

    const handleAddProduct = async () => {
        if (!user) return;

        const token = getStoredToken();
        if (!token) {
            console.error("No token found");
            return;
        }

        setIsAdding(true);
        try {
            await createProductAction({
                ...newProduct,
                price: Number(newProduct.price) || 0,
                quantity: Number(newProduct.quantity) || 0,
                sellerId: user.id,
            }, token);
            setDialogOpen(false);
            setNewProduct({ name: '', sku: '', quantity: '', price: '', description: '' });
            // Refresh inventory
            fetchInventory();
        } catch (error) {
            console.error('Failed to add product', error);
        } finally {
            setIsAdding(false);
        }
    };

    const filteredInventory = inventory.filter(
        (item) =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalProducts = inventory.length;
    const lowStockItems = inventory.filter(
        (item) => item.availableStock > 0 && item.availableStock < 10
    ).length;
    const outOfStock = inventory.filter((item) => item.availableStock === 0).length;
    const totalReserved = inventory.reduce((sum, item) => sum + (item.reservedStock || 0), 0);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Inventory</h1>
                    <p className="text-zinc-400 mt-1">Manage product stock and reservations</p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={fetchInventory} className="border-zinc-700 hover:bg-zinc-800 text-white">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Product
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                            <DialogHeader>
                                <DialogTitle>Add New Product</DialogTitle>
                                <DialogDescription>
                                    Add a new item to your inventory.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">Name</Label>
                                    <Input
                                        id="name"
                                        value={newProduct.name}
                                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                        className="col-span-3 bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="sku" className="text-right">SKU</Label>
                                    <Input
                                        id="sku"
                                        placeholder="Optional"
                                        value={newProduct.sku}
                                        onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                                        className="col-span-3 bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="price" className="text-right">Price</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        value={newProduct.price}
                                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                        className="col-span-3 bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="quantity" className="text-right">Total Stock</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        value={newProduct.quantity}
                                        onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                                        className="col-span-3 bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="description" className="text-right">Description</Label>
                                    <Input
                                        id="description"
                                        value={newProduct.description}
                                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                        className="col-span-3 bg-zinc-800 border-zinc-700"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-700 hover:bg-zinc-800 text-white">Cancel</Button>
                                <Button onClick={handleAddProduct} disabled={isAdding || !newProduct.name} className="bg-blue-600 hover:bg-blue-700">
                                    {isAdding ? 'Adding...' : 'Add Product'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>


            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Package className="h-6 w-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Total Products</p>
                                    <p className="text-2xl font-bold text-white">{totalProducts}</p>
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
                                    <p className="text-sm text-zinc-400">Low Stock</p>
                                    <p className="text-2xl font-bold text-white">{lowStockItems}</p>
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
                                    <Package className="h-6 w-6 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Out of Stock</p>
                                    <p className="text-2xl font-bold text-white">{outOfStock}</p>
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
                                    <Warehouse className="h-6 w-6 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Reserved</p>
                                    <p className="text-2xl font-bold text-white">{totalReserved}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Inventory Table */}
            <motion.div variants={itemVariants}>
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-white">Products</CardTitle>
                                <CardDescription>
                                    {filteredInventory.length} products found
                                </CardDescription>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                <Input
                                    placeholder="Search by name..."
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
                                    <TableHead className="text-zinc-400">Product</TableHead>
                                    <TableHead className="text-zinc-400">Price</TableHead>
                                    <TableHead className="text-zinc-400">Total Stock</TableHead>
                                    <TableHead className="text-zinc-400">Reserved</TableHead>
                                    <TableHead className="text-zinc-400">Available</TableHead>
                                    <TableHead className="text-zinc-400">Status</TableHead>
                                    <TableHead className="text-zinc-400">Last Updated</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-zinc-500 py-8">
                                            Loading inventory...
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!loading && filteredInventory.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-zinc-500 py-8">
                                            No products found. Add your first product!
                                        </TableCell>
                                    </TableRow>
                                )}
                                {filteredInventory.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                                    >
                                        <TableCell className="text-white font-medium">
                                            <div>{item.name}</div>
                                            <div className="text-xs text-zinc-500">{item.id}</div>
                                        </TableCell>
                                        <TableCell className="text-white">
                                            ${item.price.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-white">{item.totalStock}</TableCell>
                                        <TableCell className="text-zinc-400">{item.reservedStock}</TableCell>
                                        <TableCell className="text-white">
                                            {item.availableStock}
                                        </TableCell>
                                        <TableCell>
                                            <StockBadge
                                                totalStock={item.totalStock}
                                                availableStock={item.availableStock}
                                            />
                                        </TableCell>
                                        <TableCell className="text-zinc-500 text-sm">
                                            {item.updatedAt ? format(new Date(item.updatedAt), 'MMM d, HH:mm') : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
