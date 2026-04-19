import { redirect } from "next/navigation";
import { SignInForm } from "./signin-form";
import { serverApiBase } from "@/lib/server-api";

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
