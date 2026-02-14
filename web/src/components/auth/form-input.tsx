"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export function FormField({ label, id, error, ...props }: FormFieldProps) {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>{label}</Label>
            <Input id={inputId} {...props} />
            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}
