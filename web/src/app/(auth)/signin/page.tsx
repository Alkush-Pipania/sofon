import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "./signin-form";
import { serverApiBase } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Sign In",
    description: "Sign in to your Sofon account to manage your uptime monitors.",
};

async function getRegistrationsEnabled(): Promise<boolean> {
    try {
        const res = await fetch(
            `${serverApiBase()}/api/v1/users/setup-status`,
            { cache: "no-store" },
        );
        const json = await res.json();
        return json?.data?.registrations_enabled ?? false;
    } catch {
        return false;
    }
}

export default async function SignInPage() {
    const registrationsEnabled = await getRegistrationsEnabled();
    if (registrationsEnabled) {
        redirect("/register");
    }
    return <SignInForm />;
}
