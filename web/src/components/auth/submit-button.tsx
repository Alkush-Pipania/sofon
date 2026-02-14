"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes } from "react";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    pending?: boolean;
}

export function SubmitButton({
    children,
    pending = false,
    disabled,
    ...props
}: SubmitButtonProps) {
    return (
        <Button
            type="submit"
            size="lg"
            disabled={disabled || pending}
            className="w-full cursor-pointer bg-[#3B8CF0] text-base font-semibold hover:bg-[#2D7BE0] active:scale-[0.98]"
            {...props}
        >
            {pending ? (
                <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                </span>
            ) : (
                children
            )}
        </Button>
    );
}
