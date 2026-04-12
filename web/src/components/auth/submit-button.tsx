"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SubmitButtonProps {
    pending?: boolean;
    loadingText?: string;
    children: React.ReactNode;
}

export function SubmitButton({ pending = false, loadingText = "Loading...", children }: SubmitButtonProps) {
    return (
        <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="w-full cursor-pointer bg-[#3B8CF0] text-base font-semibold hover:bg-[#2D7BE0] active:scale-[0.98]"
        >
            {pending ? (
                <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {loadingText}
                </span>
            ) : (
                children
            )}
        </Button>
    );
}
