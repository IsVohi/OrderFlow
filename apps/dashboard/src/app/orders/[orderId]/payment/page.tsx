'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth';
import { updateOrderStatusAction } from '@/app/actions/orders';
import {
    ArrowLeft,
    CreditCard,
    Lock,
    CheckCircle,
    Loader2,
} from 'lucide-react';

export default function PaymentPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.orderId as string;
    const { toast } = useToast();
    const { token } = useAuth();

    const [processing, setProcessing] = useState(false);
    const [paymentData, setPaymentData] = useState({
        cardNumber: '',
        cardName: '',
        expiry: '',
        cvv: '',
    });

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast({
                title: 'Error',
                description: 'Not authenticated',
                variant: 'destructive',
            });
            return;
        }

        // Basic validation
        if (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiry || !paymentData.cvv) {
            toast({
                title: 'Error',
                description: 'Please fill in all payment details',
                variant: 'destructive',
            });
            return;
        }

        setProcessing(true);

        try {
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Call the pay action
            await updateOrderStatusAction(orderId, 'pay', token);

            toast({
                title: 'Payment Successful!',
                description: 'Your order has been paid successfully',
            });

            // Redirect back to order detail page
            setTimeout(() => {
                router.push(`/orders/${orderId}`);
            }, 1000);
        } catch (error) {
            toast({
                title: 'Payment Failed',
                description: 'Could not process payment. Please try again.',
                variant: 'destructive',
            });
            setProcessing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 max-w-2xl mx-auto"
        >
            {/* Back Button */}
            <Link href={`/orders/${orderId}`}>
                <Button variant="ghost" className="text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Order
                </Button>
            </Link>

            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Payment</h1>
                <p className="text-zinc-400">Complete your order payment</p>
                <p className="text-sm text-zinc-500 mt-1">Order ID: {orderId}</p>
            </div>

            {/* Payment Form */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Secure Payment
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePayment} className="space-y-6">
                        {/* Card Number */}
                        <div className="space-y-2">
                            <Label htmlFor="cardNumber" className="text-zinc-300">
                                Card Number
                            </Label>
                            <Input
                                id="cardNumber"
                                placeholder="1234 5678 9012 3456"
                                maxLength={19}
                                value={paymentData.cardNumber}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\s/g, '');
                                    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                                    setPaymentData({ ...paymentData, cardNumber: formatted });
                                }}
                                disabled={processing}
                                className="bg-zinc-800 border-zinc-700 text-white"
                            />
                        </div>

                        {/* Card Name */}
                        <div className="space-y-2">
                            <Label htmlFor="cardName" className="text-zinc-300">
                                Cardholder Name
                            </Label>
                            <Input
                                id="cardName"
                                placeholder="JOHN DOE"
                                value={paymentData.cardName}
                                onChange={(e) =>
                                    setPaymentData({ ...paymentData, cardName: e.target.value.toUpperCase() })
                                }
                                disabled={processing}
                                className="bg-zinc-800 border-zinc-700 text-white"
                            />
                        </div>

                        {/* Expiry & CVV */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="expiry" className="text-zinc-300">
                                    Expiry Date
                                </Label>
                                <Input
                                    id="expiry"
                                    placeholder="MM/YY"
                                    maxLength={5}
                                    value={paymentData.expiry}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/\D/g, '');
                                        if (value.length >= 2) {
                                            value = value.slice(0, 2) + '/' + value.slice(2, 4);
                                        }
                                        setPaymentData({ ...paymentData, expiry: value });
                                    }}
                                    disabled={processing}
                                    className="bg-zinc-800 border-zinc-700 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cvv" className="text-zinc-300">
                                    CVV
                                </Label>
                                <Input
                                    id="cvv"
                                    placeholder="123"
                                    maxLength={3}
                                    value={paymentData.cvv}
                                    onChange={(e) =>
                                        setPaymentData({ ...paymentData, cvv: e.target.value.replace(/\D/g, '') })
                                    }
                                    disabled={processing}
                                    className="bg-zinc-800 border-zinc-700 text-white"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                            size="lg"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Processing Payment...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="mr-2 h-5 w-5" />
                                    Pay Now
                                </>
                            )}
                        </Button>

                        {/* Info */}
                        <div className="flex items-center gap-2 text-xs text-zinc-500 justify-center">
                            <CheckCircle className="h-4 w-4" />
                            <p>This is a mock payment system for demonstration purposes</p>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Security Notice */}
            <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                        <Lock className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-blue-500">Secure Payment</h3>
                            <p className="text-sm text-blue-400 mt-1">
                                Your payment information is encrypted and secure. This is a demonstration system.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
