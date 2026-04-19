import { NextRequest, NextResponse } from "next/server";
import { serverApiBase } from "@/lib/server-api";

// Hop-by-hop and transport-encoding headers must not be forwarded:
// Node's fetch auto-decodes gzip but keeps content-encoding/length, so the
// browser would try to gunzip plaintext and fail.
const HOP_BY_HOP = new Set([
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
]);

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
    const url = `${serverApiBase()}/api/${path.join("/")}${req.nextUrl.search}`;

    const headers = new Headers(req.headers);
    headers.delete("host");

    const init: RequestInit & { duplex?: string } = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = req.body;
        init.duplex = "half";
    }

    let upstream: Response;
    try {
        upstream = await fetch(url, init);
    } catch (err) {
        console.error("[proxy] upstream fetch failed:", url, err);
        return NextResponse.json(
            { success: false, message: "Upstream API unreachable" },
            { status: 502 },
        );
    }

    const respHeaders = new Headers(upstream.headers);
    for (const h of HOP_BY_HOP) respHeaders.delete(h);

    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
    });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
    return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
    return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
    return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
    return proxy(req, (await ctx.params).path);
}
