import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveProxyNavigation } from "@/lib/auth/proxy-navigation";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // The page-level notFound() streams a 200 soft-404; refuse dev tools before rendering.
  if (process.env.NODE_ENV === "production" && /^\/dev(\/|$)/.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const decision = resolveProxyNavigation({
    pathname,
    search,
    hasSessionCookie: request.cookies.has(SESSION_COOKIE_NAME),
  });

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
