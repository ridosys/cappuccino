import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PRIVATE_PREFIXES = ["/dashboard", "/caisse", "/choose"];

function isPrivate(pathname: string) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // /caisse and /choose live outside /dashboard but are still private,
  // authenticated areas — per-page permission checks run in their
  // layouts/pages (the edge runtime can't do the DB permission read).
  if (isPrivate(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // A logged-in user hitting /login goes to the post-login chooser.
  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/choose", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/caisse",
    "/caisse/:path*",
    "/choose",
    "/login",
  ],
};
