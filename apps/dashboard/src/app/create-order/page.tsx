'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Package, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { createOrderAction } from '../actions/orders';
import { getInventoryAction } from '../actions/inventory';
import { useAuth } from '@/lib/auth';
import { Product } from '@/types';

/**
 * Order creation schema
 * Seller is now inferred from the selected product.
 */
const createOrderSchema = z.object({
    productId: z.string().min(1, 'Product is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1').max(100, 'Maximum 100 items'),
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    country: z.string().min(1, 'Country is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
});

type CreateOrderFormData = z.infer<typeof createOrderSchema>;

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

export default function CreateOrderPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    const { user, token } = useAuth(); // Ensure useAuth provides token

    useEffect(() => {
        async function loadProducts() {
            if (token) {
                try {
                    const data = await getInventoryAction(token);
                    setProducts(data);
                } catch (err) {
                    console.error('Failed to load products', err);
                } finally {
                    setIsLoadingProducts(false);
                }
            } else {
                setIsLoadingProducts(false);
            }
        }
        loadProducts();
    }, [token]);

    // Filter only available products for the dropdown
    const availableProducts = products.filter(p => p.availableStock > 0);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<CreateOrderFormData>({
        resolver: zodResolver(createOrderSchema),
        defaultValues: {
            quantity: 1,
            country: 'United States',
        },
    });

    const selectedProductId = watch('productId');
    const quantity = watch('quantity');
    const selectedProduct = availableProducts.find((p) => p.id === selectedProductId);
    const totalAmount = selectedProduct ? selectedProduct.price * (quantity || 1) : 0;


    const onSubmit = async (data: CreateOrderFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            if (!user || !token) throw new Error('You must be logged in to create an order');

            const selectedProduct = availableProducts.find(p => p.id === data.productId);
            if (!selectedProduct) throw new Error('Product not found or unavailable');

            // Infer sellerId from the product itself
            const sellerId = selectedProduct.sellerId;
            if (!sellerId) throw new Error('Product has no seller assigned');

            const result = await createOrderAction({
                productId: data.productId,
                productName: selectedProduct.name,
                productPrice: selectedProduct.price,
                quantity: data.quantity,
                sellerId: sellerId, // Auto-assigned
                customerId: user.id || 'guest',
                address: {
                    street: data.street,
                    city: data.city,
                    country: data.country,
                    postalCode: data.postalCode,
                }
            }, token);

            setCreatedOrderId(result.orderId);
            setSuccess(true);

            // Redirect to order detail after a brief delay
            setTimeout(() => {
                router.push(`/orders/${result.orderId}`);
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create order');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-2xl mx-auto space-y-8"
        >
            {/* Page Header */}
            <motion.div variants={itemVariants}>
                <h1 className="text-3xl font-bold text-white">Create Order</h1>
                <p className="text-zinc-400 mt-1">
                    Initiate a new distributed order transaction
                </p>
            </motion.div>

            {/* Info Banner */}
            <motion.div variants={itemVariants}>
                <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                            <Package className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-blue-400">Saga Transaction</h3>
                                <p className="text-sm text-blue-300/80 mt-1">
                                    Creating an order triggers a distributed saga: Order → Inventory Reservation → Payment Capture → Fulfillment.
                                    You can observe each step in real-time on the order detail page.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Success State */}
            {success && createdOrderId && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <Card className="bg-green-500/10 border-green-500/20">
                        <CardContent className="pt-6 pb-6">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-green-400">Order Created</h3>
                                    <p className="text-sm text-zinc-400 mt-1">
                                        Order <code className="text-green-300">{createdOrderId}</code> has been created.
                                    </p>
                                    <p className="text-sm text-zinc-500 mt-2">
                                        Redirecting to order detail...
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Order Form */}
            {!success && (
                <motion.div variants={itemVariants}>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Order Details</CardTitle>
                            <CardDescription>
                                Specify the product, quantity, and delivery information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Error Banner */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
                                    >
                                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                        {error}
                                    </motion.div>
                                )}

                                {/* Product Selection */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="productId" className="text-zinc-300">
                                            Product
                                        </Label>
                                        <Select
                                            onValueChange={(value) => setValue('productId', value)}
                                            disabled={isSubmitting || isLoadingProducts}
                                        >
                                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                                                <SelectValue placeholder={isLoadingProducts ? "Loading..." : "Select product"} />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-800 border-zinc-700">
                                                {availableProducts.map((product) => (
                                                    <SelectItem
                                                        key={product.id}
                                                        value={product.id}
                                                        className="text-white hover:bg-zinc-700"
                                                    >
                                                        {product.name} - ${product.price} ({product.availableStock} avail)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.productId && (
                                            <p className="text-sm text-red-400">{errors.productId.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="quantity" className="text-zinc-300">
                                            Quantity
                                        </Label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min={1}
                                            max={selectedProduct ? selectedProduct.availableStock : 100}
                                            {...register('quantity', { valueAsNumber: true })}
                                            className="bg-zinc-800 border-zinc-700 text-white"
                                            disabled={isSubmitting}
                                        />
                                        {errors.quantity && (
                                            <p className="text-sm text-red-400">{errors.quantity.message}</p>
                                        )}
                                    </div>
                                </div>

                                <Separator className="bg-zinc-800" />

                                {/* Shipping Address */}
                                <div>
                                    <h3 className="text-sm font-medium text-zinc-300 mb-4">Shipping Address</h3>
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="street" className="text-zinc-400 text-sm">
                                                Street Address
                                            </Label>
                                            <Input
                                                id="street"
                                                placeholder="123 Main St"
                                                {...register('street')}
                                                className="bg-zinc-800 border-zinc-700 text-white"
                                                disabled={isSubmitting}
                                            />
                                            {errors.street && (
                                                <p className="text-sm text-red-400">{errors.street.message}</p>
                                            )}
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="city" className="text-zinc-400 text-sm">
                                                    City
                                                </Label>
                                                <Input
                                                    id="city"
                                                    placeholder="San Francisco"
                                                    {...register('city')}
                                                    className="bg-zinc-800 border-zinc-700 text-white"
                                                    disabled={isSubmitting}
                                                />
                                                {errors.city && (
                                                    <p className="text-sm text-red-400">{errors.city.message}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="country" className="text-zinc-400 text-sm">
                                                    Country
                                                </Label>
                                                <Input
                                                    id="country"
                                                    placeholder="United States"
                                                    {...register('country')}
                                                    className="bg-zinc-800 border-zinc-700 text-white"
                                                    disabled={isSubmitting}
                                                />
                                                {errors.country && (
                                                    <p className="text-sm text-red-400">{errors.country.message}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="postalCode" className="text-zinc-400 text-sm">
                                                    Postal Code
                                                </Label>
                                                <Input
                                                    id="postalCode"
                                                    placeholder="94102"
                                                    {...register('postalCode')}
                                                    className="bg-zinc-800 border-zinc-700 text-white"
                                                    disabled={isSubmitting}
                                                />
                                                {errors.postalCode && (
                                                    <p className="text-sm text-red-400">{errors.postalCode.message}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="bg-zinc-800" />

                                {/* Order Summary */}
                                {selectedProduct && (
                                    <div className="bg-zinc-800/50 rounded-lg p-4">
                                        <h3 className="text-sm font-medium text-zinc-300 mb-3">Order Summary</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">{selectedProduct.name}</span>
                                                <span className="text-white">${selectedProduct.price}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Seller</span>
                                                <span className="text-zinc-400 text-xs">{selectedProduct.sellerId}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400">Quantity</span>
                                                <span className="text-white">× {quantity || 1}</span>
                                            </div>
                                            <Separator className="bg-zinc-700" />
                                            <div className="flex justify-between font-medium">
                                                <span className="text-zinc-300">Total</span>
                                                <span className="text-white">${totalAmount.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <Button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    disabled={isLoadingProducts || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Creating Order...
                                        </>
                                    ) : (
                                        <>
                                            <Package className="h-4 w-4 mr-2" />
                                            Create Order
                                        </>
                                    )}
                                </Button>

                                <p className="text-xs text-zinc-500 text-center">
                                    This will initiate a distributed saga transaction
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    );
}
