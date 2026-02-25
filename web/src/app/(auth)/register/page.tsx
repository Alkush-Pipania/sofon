"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";

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

export default function RegisterPage() {
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
            <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center gap-4 pt-10 pb-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <h2 className="text-xl font-bold tracking-tight">Account created!</h2>
                    <p className="text-center text-sm text-muted-foreground">
                        Your account has been registered successfully. Please sign in to continue.
                    </p>
                    <Link
                        href="/signin"
                        className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-[#3B8CF0] px-6 text-sm font-semibold text-white hover:bg-[#2D7BE0]"
                    >
                        Go to Sign In
                    </Link>
                </CardContent>
            </Card>
        );
    }

    return (
        <AuthCard
            title="Create your account"
            description="Start monitoring your services in minutes."
            footer={{ text: "Already have an account?", linkText: "Sign In", linkHref: "/signin" }}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                {apiError && (
                    <p className="text-center text-sm text-destructive">{apiError}</p>
                )}

                <FormField
                    label="Name"
                    type="text"
                    placeholder="Enter your full name..."
                    error={errors.name}
                    {...register("name", { required: "Name is required" })}
                />

                <FormField
                    label="Email"
                    type="email"
                    placeholder="Enter your email address..."
                    error={errors.email}
                    {...register("email", { required: "Email is required" })}
                />

                <FormField
                    label="Password"
                    isPassword
                    placeholder="Create a password..."
                    error={errors.password}
                    {...register("password", {
                        required: "Password is required",
                        minLength: { value: 8, message: "Must be at least 8 characters" },
                    })}
                />

                <SubmitButton pending={isSubmitting} loadingText="Creating account...">
                    Create Account
                </SubmitButton>
            </form>
        </AuthCard>
    );
}
