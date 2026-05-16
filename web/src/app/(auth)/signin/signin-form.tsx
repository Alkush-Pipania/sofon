"use client";

import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { get, post, tokenStore } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";

interface LoginForm {
    email: string;
    password: string;
}

interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        user_id: string;
        access_token: string;
    };
}

interface SetupStatusResponse {
    success: boolean;
    data: { registrations_enabled: boolean };
}

export function SignInForm() {
    const router = useRouter();
    const [apiError, setApiError] = useState<string | null>(null);
    const [registrationsEnabled, setRegistrationsEnabled] = useState(false);

    useEffect(() => {
        get<SetupStatusResponse>(ENDPOINTS.AUTH.SETUP_STATUS)
            .then((res) => setRegistrationsEnabled(res.data.registrations_enabled))
            .catch(() => setRegistrationsEnabled(false));
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>();

    const onSubmit = async (data: LoginForm) => {
        setApiError(null);
        try {
            const res = await post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, data);
            tokenStore.set(res.data.access_token);
            router.push("/monitors");
        } catch (err) {
            setApiError(parseApiError(err, "Invalid email or password."));
        }
    };

    return (
        <div className="flex flex-col gap-8">

            {/* Heading */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                    Sign in to continue to your workspace.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

                {/* API error */}
                {apiError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                        {apiError}
                    </div>
                )}

                {/* Email */}
                <div className="flex flex-col gap-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                        Email
                    </Label>
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
                    <Label htmlFor="password" className="text-sm font-medium">
                        Password
                    </Label>
                    <PasswordInput
                        id="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-10"
                        {...register("password", { required: "Password is required" })}
                    />
                    {errors.password && (
                        <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-1 h-10 w-full bg-white text-black hover:bg-white/90 font-semibold gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Signing in…
                        </>
                    ) : (
                        <>
                            Sign In
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

            {/* Footer */}
            {registrationsEnabled ? (
                <p className="text-center text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
                        Create one
                    </Link>
                </p>
            ) : (
                <p className="text-center text-xs text-muted-foreground">
                    Registration is disabled. Contact your administrator.
                </p>
            )}
        </div>
    );
}
