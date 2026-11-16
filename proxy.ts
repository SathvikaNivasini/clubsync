import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { roleFromMetadata } from "./lib/auth";

const MEMBER_PREFIXES = ["/dashboard", "/availability", "/calendar", "/notifications", "/join", "/account"];
const LEADER_PREFIXES = ["/leader"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there are no sessions to guard; the pages themselves
  // render a setup notice instead of failing here.
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the access token cookie when it is close to expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const needsMember = matches(pathname, MEMBER_PREFIXES);
  const needsLeader = matches(pathname, LEADER_PREFIXES);

  if (!user && (needsMember || needsLeader)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", `${pathname}${search}`);
    if (needsLeader) login.searchParams.set("role", "leader");
    return NextResponse.redirect(login);
  }

  if (user) {
    const role = roleFromMetadata(user.user_metadata);
    if (needsLeader && role === "member") {
      const home = request.nextUrl.clone();
      home.pathname = "/dashboard";
      home.search = "";
      return NextResponse.redirect(home);
    }
    if (needsMember && role === "leader") {
      const home = request.nextUrl.clone();
      home.pathname = "/leader";
      home.search = "";
      return NextResponse.redirect(home);
    }
    if ((pathname === "/login" || pathname === "/register") && role) {
      const home = request.nextUrl.clone();
      home.pathname = role === "leader" ? "/leader" : "/dashboard";
      home.search = "";
      return NextResponse.redirect(home);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, the service worker and the icons —
     * matching those would needlessly run auth on every image request.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)",
  ],
};
