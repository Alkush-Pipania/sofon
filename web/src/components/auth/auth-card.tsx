"use client";

import Link from "next/link";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface AuthCardProps {
    title: string;
    description: string;
    children: React.ReactNode;
    footer: {
        text: string;
        linkText: string;
        linkHref: string;
    };
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
    return (
        <Card className="border-none shadow-none">
            <CardHeader className="items-center gap-1">
                <CardTitle className="text-2xl font-bold tracking-tight">
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>

            <CardContent>{children}</CardContent>

            <CardFooter className="justify-center">
                <p className="text-sm text-muted-foreground">
                    {footer.text}{" "}
                    <Link
                        href={footer.linkHref}
                        className="font-medium text-[#3B8CF0] hover:underline"
                    >
                        {footer.linkText}
                    </Link>
                </p>
            </CardFooter>
        </Card>
    );
}
