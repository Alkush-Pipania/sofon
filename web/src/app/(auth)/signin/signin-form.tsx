"use client";

import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { get, post, tokenStore } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";

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
    const [registrationsEnabled, setRegistrationsEnabled] = useState<boolean>(false);

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

    const footer = registrationsEnabled ? (
        <p className="text-sm text-muted-foreground">
            {"Don't have an account?"}{" "}
            <Link href="/register" className="font-medium text-[#3B8CF0] hover:underline">
                Register
            </Link>
        </p>
    ) : (
        <p className="text-sm text-muted-foreground">
            Registration is disabled. Please contact the administrator.
        </p>
    );

    return (
        <AuthCard
            title="Sign in to Sofon"
            description="Monitor your services. Stay ahead of downtime."
            footerNode={footer}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                {apiError && (
                    <p className="text-center text-sm text-destructive">{apiError}</p>
                )}

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
                    placeholder="Enter your password..."
                    error={errors.password}
                    {...register("password", { required: "Password is required" })}
                />

                <SubmitButton pending={isSubmitting} loadingText="Signing in...">
                    Sign In
                </SubmitButton>
            </form>
        </AuthCard>
    );
}
