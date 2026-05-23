import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/settings")) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || (process.env.NODE_ENV === "development" && secret === "replace-me")) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const basicPassword = parseBasicPassword(authorization);

  if (bearerToken === secret || basicPassword === secret) {
    return NextResponse.next();
  }

  return new NextResponse("Admin authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Vimicx Board Settings"' }
  });
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
