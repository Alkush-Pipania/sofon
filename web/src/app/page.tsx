import { redirect } from "next/navigation";
import { serverApiBase } from "@/lib/server-api";

export const dynamic = "force-dynamic";

async function getSetupStatus(): Promise<{ registrationsEnabled: boolean }> {
    try {
        const res = await fetch(
            `${serverApiBase()}/api/v1/users/setup-status`,
            { cache: "no-store" },
        );
        const json = await res.json();
        return { registrationsEnabled: json?.data?.registrations_enabled ?? false };
    } catch {
        return { registrationsEnabled: false };
    }
}

export default async function Home() {
    const { registrationsEnabled } = await getSetupStatus();
    if (registrationsEnabled) {
        redirect("/register");
    }
    redirect("/signin");
}
