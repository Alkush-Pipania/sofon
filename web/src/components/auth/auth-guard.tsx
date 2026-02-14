"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/service/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (!tokenStore.get()) {
            router.replace("/signin");
        } else {
            setChecked(true);
        }
    }, [router]);

    if (!checked) return null;

    return <>{children}</>;
}
