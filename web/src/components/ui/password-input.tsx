"use client";

import { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

export const PasswordInput = forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <Input
                ref={ref}
                type={show ? "text" : "password"}
                className={className}
                {...props}
            />
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setShow((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
                {show ? (
                    <EyeOff className="h-4 w-4" />
                ) : (
                    <Eye className="h-4 w-4" />
                )}
            </button>
        </div>
    );
});

PasswordInput.displayName = "PasswordInput";
