"use client";

import { forwardRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FieldError } from "react-hook-form";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: FieldError;
    isPassword?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
    ({ label, error, isPassword, id, ...props }, ref) => {
        const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
        const InputComponent = isPassword ? PasswordInput : Input;

        return (
            <div className="flex flex-col gap-2">
                <Label htmlFor={inputId}>{label}</Label>
                <InputComponent ref={ref} id={inputId} {...props} />
                {error && (
                    <p className="text-sm text-destructive">{error.message}</p>
                )}
            </div>
        );
    }
);

FormField.displayName = "FormField";
