"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-input";
import { SubmitButton } from "@/components/auth/submit-button";
import { Badge } from "@/components/ui/badge";
import { post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { parseApiError } from "@/lib/api-error";

interface InviteData {
    email: string;
    role: string;
    team_name: string;
    expires_at: string;
}

interface AcceptForm {
    name: string;
    password: string;
}

const roleBadgeClass: Record<string, string> = {
    owner:  "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
    admin:  "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    member: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
};

export function InviteForm({ token, invite }: { token: string; invite: InviteData }) {
    const router = useRouter();
    const [apiError, setApiError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AcceptForm>();

    const onSubmit = async (data: AcceptForm) => {
        setApiError(null);
        try {
            await post(ENDPOINTS.TEAM.ACCEPT_INVITATION, { token, name: data.name, password: data.password });
            setSuccess(true);
            setTimeout(() => router.push("/signin"), 2000);
        } catch (err) {
            setApiError(parseApiError(err, "Failed to accept invitation."));
        }
    };

    if (success) {
        return (
            <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center gap-4 pt-10 pb-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <h2 className="text-xl font-bold tracking-tight">You're in!</h2>
                    <p className="text-center text-sm text-muted-foreground">
                        Your account has been created. Redirecting to sign in…
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <AuthCard
            title={`Join ${invite.team_name}`}
            description={`You've been invited as`}
            footerNode={
                <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link href="/signin" className="font-medium text-[#3B8CF0] hover:underline">
                        Sign In
                    </Link>
                </p>
            }
        >
            <div className="flex flex-col gap-5">
                {/* Invite context */}
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{invite.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <Badge variant="outline" className={`capitalize ${roleBadgeClass[invite.role] ?? ""}`}>
                            {invite.role}
                        </Badge>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                    {apiError && <p className="text-center text-sm text-destructive">{apiError}</p>}

                    <FormField
                        label="Your name"
                        type="text"
                        placeholder="Enter your full name..."
                        error={errors.name}
                        {...register("name", { required: "Name is required" })}
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

                    <SubmitButton pending={isSubmitting} loadingText="Setting up account...">
                        Accept invitation
                    </SubmitButton>
                </form>
            </div>
        </AuthCard>
    );
}
