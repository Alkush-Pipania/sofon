import type { Metadata } from "next";
import { PLUGIN_REGISTRY } from "../registry";
export { default } from "./content";

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
    const { type } = await params;
    const def = PLUGIN_REGISTRY.find((p) => p.type === type);
    return {
        title: def ? `${def.name} Plugin` : "Plugin",
        description: def?.description,
    };
}
