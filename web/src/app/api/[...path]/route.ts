import { NextRequest, NextResponse } from "next/server";

// Read at server startup — never baked at build time.
const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
    const url = `${API_BASE}/api/${path.join("/")}${req.nextUrl.search}`;

    const headers = new Headers(req.headers);
    headers.delete("host"); // don't forward the browser's Host header

    const init: RequestInit & { duplex?: string } = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = req.body;
        init.duplex = "half"; // required for streaming request bodies
    }

    const upstream = await fetch(url, init);

    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
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
