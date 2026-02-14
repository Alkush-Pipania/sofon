"use client";

import { useActionState } from "react";
import Link from "next/link";
import { FormField } from "@/components/auth/form-input";
import { SubmitButton } from "@/components/auth/submit-button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { AxiosError } from "axios";
import { CheckCircle2 } from "lucide-react";

interface RegisterState {
    error?: string;
    success?: boolean;
}

interface RegisterResponse {
    success: boolean;
    message: string;
    data: {
        user_id: string;
    };
}

export default function RegisterPage() {
    async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            await post<RegisterResponse>(ENDPOINTS.AUTH.REGISTER, {
                name,
                email,
                password,
            });

            return { success: true };
        } catch (err) {
            if (err instanceof AxiosError) {
                const msg = err.response?.data?.message || err.response?.data?.error;
                return { error: msg || "Registration failed. Please try again." };
            }
            return { error: "Something went wrong. Please try again." };
        }
    }

    const [state, action, pending] = useActionState(registerAction, {});

    if (state.success) {
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
        <Card className="border-none shadow-none">
            <CardHeader className="items-center gap-1">
                <CardTitle className="text-2xl font-bold tracking-tight">
                    Create your account
                </CardTitle>
                <CardDescription>
                    Start monitoring your services in minutes.
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form action={action} className="flex flex-col gap-5">
                    {state.error && (
                        <p className="text-center text-sm text-destructive">{state.error}</p>
                    )}

                    <FormField
                        label="Name"
                        type="text"
                        name="name"
                        placeholder="Enter your full name..."
                        required
                    />

                    <FormField
                        label="Email"
                        type="email"
                        name="email"
                        placeholder="Enter your email address..."
                        required
                    />

                    <FormField
                        label="Password"
                        type="password"
                        name="password"
                        placeholder="Create a password..."
                        required
                        minLength={8}
                    />

                    <SubmitButton pending={pending}>Create Account</SubmitButton>
                </form>
            </CardContent>

            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                        href="/signin"
                        className="font-medium text-[#3B8CF0] hover:underline"
                    >
                        Sign In
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}
