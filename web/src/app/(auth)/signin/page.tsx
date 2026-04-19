import { redirect } from "next/navigation";
import { SignInForm } from "./signin-form";

async function getRegistrationsEnabled(): Promise<boolean> {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/api/v1/users/setup-status`,
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
