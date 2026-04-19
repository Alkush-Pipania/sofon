import { redirect } from "next/navigation";
import { InviteForm } from "./invite-form";
import { serverApiBase } from "@/lib/server-api";

interface InviteData {
    email: string;
    role: string;
    team_name: string;
    expires_at: string;
}

async function getInvite(token: string): Promise<InviteData | null> {
    try {
        const res = await fetch(
            `${serverApiBase()}/api/v1/team/invitations/${token}`,
            { cache: "no-store" },
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data ?? null;
    } catch {
        return null;
    }
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = await getInvite(token);

    if (!invite) {
        redirect("/signin");
    }

    return <InviteForm token={token} invite={invite} />;
}
