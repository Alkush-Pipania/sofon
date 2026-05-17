import { BellRing, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface PluginDef {
    type: string;
    name: string;
    description: string;
    longDescription: string;
    icon: LucideIcon;
    category: string;
}

export const PLUGIN_REGISTRY: PluginDef[] = [
    {
        type: "resend",
        name: "Resend Email",
        description: "Send incident alert emails via the Resend API.",
        longDescription:
            "Resend is a developer-first email API. When a monitor goes down, Sofon sends an alert email to all configured recipients. When the monitor recovers, a recovery email is automatically dispatched.",
        icon: Mail,
        category: "Email",
    },
    {
        type: "zenduty",
        name: "Zenduty",
        description: "Create and auto-resolve Zenduty incidents when monitors go down.",
        longDescription:
            "Zenduty is an incident management platform. Sofon creates a Zenduty incident via the Generic Integration webhook when a monitor fails, and automatically resolves it when the monitor recovers.",
        icon: BellRing,
        category: "Incident Management",
    },
];
