'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Package, Loader2, AlertCircle, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth, signupSchema, SignupFormData } from '@/lib/auth';

/**
 * Password strength requirements
 */
const passwordRequirements = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Contains lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Contains number', test: (p: string) => /\d/.test(p) },
];

/**
 * Role descriptions for user guidance
 */
const roleDescriptions = {
    USER: 'View and manage your orders',
    SELLER: 'Manage inventory and products',
    ADMIN: 'Full system access and monitoring',
};

export default function SignupPage() {
    const { signup } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
            role: undefined,
        },
    });

    const password = watch('password');
    const selectedRole = watch('role');

    // Calculate password strength
    const passwordStrength = useMemo(() => {
        if (!password) return [];
        return passwordRequirements.map((req) => ({
            ...req,
            passed: req.test(password),
        }));
    }, [password]);

    const onSubmit = async (data: SignupFormData) => {
        setError(null);
        setIsSubmitting(true);

        try {
            await signup(data);
            // Redirect is handled by the auth context
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Signup failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
                        <Package className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-2xl font-semibold text-white">OrderFlow</span>
                </div>

                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl text-white">Create account</CardTitle>
                        <CardDescription>
                            Get started with OrderFlow
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                            {/* Email Field */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-zinc-300">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@company.com"
                                    {...register('email')}
                                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-blue-500"
                                    disabled={isSubmitting}
                                />
                                {errors.email && (
                                    <p className="text-sm text-red-400">{errors.email.message}</p>
                                )}
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-zinc-300">
                                    Password
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    {...register('password')}
                                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-blue-500"
                                    disabled={isSubmitting}
                                />
                                {errors.password && (
                                    <p className="text-sm text-red-400">{errors.password.message}</p>
                                )}

                                {/* Password Strength Indicators */}
                                {password && (
                                    <div className="space-y-1 mt-2">
                                        {passwordStrength.map((req, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-2 text-xs ${req.passed ? 'text-green-500' : 'text-zinc-500'
                                                    }`}
                                            >
                                                {req.passed ? (
                                                    <Check className="h-3 w-3" />
                                                ) : (
                                                    <X className="h-3 w-3" />
                                                )}
                                                {req.label}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password Field */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-zinc-300">
                                    Confirm Password
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    {...register('confirmPassword')}
                                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-blue-500"
                                    disabled={isSubmitting}
                                />
                                {errors.confirmPassword && (
                                    <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            {/* Role Selection */}
                            <div className="space-y-3">
                                <Label className="text-zinc-300">Role</Label>
                                <RadioGroup
                                    value={selectedRole}
                                    onValueChange={(value) => setValue('role', value as 'USER' | 'SELLER' | 'ADMIN')}
                                    className="space-y-2"
                                >
                                    {(['USER', 'SELLER', 'ADMIN'] as const).map((role) => (
                                        <div
                                            key={role}
                                            className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${selectedRole === role
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                                                }`}
                                            onClick={() => setValue('role', role)}
                                        >
                                            <RadioGroupItem
                                                value={role}
                                                id={role}
                                                className="border-zinc-600 text-blue-500"
                                            />
                                            <div className="flex-1">
                                                <Label
                                                    htmlFor={role}
                                                    className="text-white font-medium cursor-pointer"
                                                >
                                                    {role.charAt(0) + role.slice(1).toLowerCase()}
                                                </Label>
                                                <p className="text-xs text-zinc-500">
                                                    {roleDescriptions[role]}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </RadioGroup>
                                {errors.role && (
                                    <p className="text-sm text-red-400">{errors.role.message}</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating account...
                                    </>
                                ) : (
                                    'Create account'
                                )}
                            </Button>
                        </form>

                        {/* Sign In Link */}
                        <p className="mt-6 text-center text-sm text-zinc-500">
                            Already have an account?{' '}
                            <Link href="/login" className="text-blue-400 hover:text-blue-300">
                                Sign in
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
