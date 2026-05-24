import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/settings")) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const basicPassword = parseBasicPassword(authorization);

  if (bearerToken === secret || basicPassword === secret) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/board?settings=locked", request.url));
}

export const config = {
  matcher: ["/settings/:path*"]
};

function parseBasicPassword(authorization: string | null) {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  const decoded = atob(authorization.slice("Basic ".length));
  return decoded.split(":").slice(1).join(":");
}


