import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveProxyNavigation } from "@/lib/auth/proxy-navigation";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const decision = resolveProxyNavigation({
    pathname,
    search,
    redirectParam: request.nextUrl.searchParams.get("redirect"),
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
