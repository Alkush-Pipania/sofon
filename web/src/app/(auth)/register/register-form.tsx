"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

interface RegisterForm {
    name: string;
    email: string;
    password: string;
}

interface RegisterResponse {
    success: boolean;
    message: string;
    data: { user_id: string };
}

export function RegisterForm() {
    const [apiError, setApiError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterForm>();

    const onSubmit = async (data: RegisterForm) => {
        setApiError(null);
        try {
            await post<RegisterResponse>(ENDPOINTS.AUTH.REGISTER, data);
            setSuccess(true);
        } catch (err) {
            setApiError(parseApiError(err, "Registration failed."));
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center gap-4 py-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <div className="text-center">
                    <h2 className="text-xl font-bold tracking-tight">Account created!</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        Your admin account has been set up. Sign in to get started.
                    </p>
                </div>
                <Link
                    href="/signin"
                    className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-white px-6 text-sm font-semibold text-black hover:bg-white/90"
                >
                    Go to Sign In
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">

            {/* Heading */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
                <p className="text-sm text-muted-foreground">
                    Set up the administrator account for your Sofon instance.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

                {apiError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                        {apiError}
                    </div>
                )}

                {/* Name */}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                    <Input
                        id="name"
                        type="text"
                        placeholder="Your full name"
                        autoComplete="name"
                        className="h-10"
                        {...register("name", { required: "Name is required" })}
                    />
                    {errors.name && (
                        <p className="text-xs text-destructive">{errors.name.message}</p>
                    )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="h-10"
                        {...register("email", { required: "Email is required" })}
                    />
                    {errors.email && (
                        <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                </div>

                {/* Password */}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <PasswordInput
                        id="password"
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className="h-10"
                        {...register("password", {
                            required: "Password is required",
                            minLength: { value: 8, message: "Must be at least 8 characters" },
                        })}
                    />
                    {errors.password && (
                        <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-1 h-10 w-full bg-white text-black hover:bg-white/90 font-semibold gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating account…
                        </>
                    ) : (
                        <>
                            Create Account
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

        </div>
    );
}
