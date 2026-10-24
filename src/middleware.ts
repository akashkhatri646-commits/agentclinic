import { NextRequest, NextResponse } from "next/server"

export function middleware(req: NextRequest) {
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ??
    req.cookies.get("__Secure-authjs.session-token")?.value

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
}
