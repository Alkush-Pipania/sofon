import { NextRequest, NextResponse } from "next/server";

const TOKEN_KEY = "sofon_token";

// Routes that require the user to be authenticated
const PRIVATE_PREFIXES = [
    "/monitors",
    "/incidents",
    "/team",
    "/profile",
];

// Routes that authenticated users should not be able to visit
const AUTH_PREFIXES = [
    "/signin",
    "/register",
    "/invite",
];

export function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get(TOKEN_KEY)?.value ?? null;
    const isAuthed = Boolean(token);

    // ── Unauthenticated user hitting a private route ──────────────────────────
    if (!isAuthed && PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
        const url = req.nextUrl.clone();
        url.pathname = "/signin";
        return NextResponse.redirect(url);
    }

    // ── Authenticated user hitting an auth route ──────────────────────────────
    if (isAuthed && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
        const url = req.nextUrl.clone();
        url.pathname = "/monitors";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // Run on all routes except Next.js internals and static files
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|api/).*)",
    ],
};
