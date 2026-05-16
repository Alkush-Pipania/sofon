import Image from "next/image";

export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex min-h-screen">

            {/* ── Left panel ─────────────────────────────────────────── */}
            <div className="relative hidden lg:flex lg:w-[60%] flex-col items-center justify-center overflow-hidden bg-black border-r border-white/[0.06]">

                {/* Sphere — fills most of the panel, blends into black bg */}
                <div className="select-none">
                    <Image
                        src="/sofon.png"
                        alt="Sofon"
                        width={620}
                        height={620}
                        priority
                        className="opacity-[0.92] drop-shadow-[0_0_80px_rgba(255,255,255,0.08)]"
                    />
                </div>

            </div>

            {/* ── Right panel ────────────────────────────────────────── */}
            <div className="flex flex-1 items-center justify-center bg-background px-8 py-12">
                <div className="w-full max-w-[380px]">
                    {children}
                </div>
            </div>

        </div>
    );
}
