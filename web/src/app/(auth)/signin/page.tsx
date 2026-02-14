"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
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
import { tokenStore } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { AxiosError } from "axios";

interface SignInState {
    error?: string;
}

interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        user_id: string;
        access_token: string;
    };
}

export default function SignInPage() {
    const router = useRouter();

    async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            const res = await post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, {
                email,
                password,
            });

            tokenStore.set(res.data.access_token);
            router.push("/monitors");
            return {};
        } catch (err) {
            if (err instanceof AxiosError) {
                const msg = err.response?.data?.message || err.response?.data?.error;
                return { error: msg || "Invalid email or password." };
            }
            return { error: "Something went wrong. Please try again." };
        }
    }

    const [state, action, pending] = useActionState(signInAction, {});

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="items-center gap-1">
                <CardTitle className="text-2xl font-bold tracking-tight">
                    Sign in to Sofon
                </CardTitle>
                <CardDescription>
                    Monitor your services. Stay ahead of downtime.
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form action={action} className="flex flex-col gap-5">
                    {state.error && (
                        <p className="text-center text-sm text-destructive">{state.error}</p>
                    )}

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
                        placeholder="Enter your password..."
                        required
                    />

                    <SubmitButton pending={pending}>Sign In</SubmitButton>
                </form>
            </CardContent>

            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <Link
                        href="/register"
                        className="font-medium text-[#3B8CF0] hover:underline"
                    >
                        Register
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}
