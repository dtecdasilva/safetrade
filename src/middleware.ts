import { NextRequest, NextResponse } from "next/server";

/**
 * pickup.zolahq.com serves the Pickup pages (src/app/pickup) from this same
 * project: pickup.zolahq.com/app shows /pickup/app. API calls and files are
 * left alone. Everything else is Zola.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const isPickup = host.startsWith("pickup.");
  const { pathname } = req.nextUrl;

  // Pickup installs as its own app: its own manifest and browser-tab icon
  if (pathname === "/manifest.webmanifest" || pathname === "/favicon.ico") {
    if (!isPickup) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/favicon.ico" ? "/pickup/favicon.ico" : "/pickup/manifest.webmanifest";
    return NextResponse.rewrite(url);
  }

  if (isPickup && !pathname.startsWith("/pickup")) {
    const url = req.nextUrl.clone();
    url.pathname = `/pickup${pathname === "/" ? "" : pathname}`;
    const headers = new Headers(req.headers);
    headers.set("x-zola-site", "pickup");
    return NextResponse.rewrite(url, { request: { headers } });
  }
  if (pathname.startsWith("/pickup")) {
    const headers = new Headers(req.headers);
    headers.set("x-zola-site", "pickup");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: not API routes, Next.js files, or anything with a file extension
  matcher: ["/((?!api|_next|.*\\..*).*)", "/manifest.webmanifest", "/favicon.ico"],
};
