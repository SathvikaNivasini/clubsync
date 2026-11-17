import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const GUARDED = ["/sponsor", "/officer", "/student"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const guarded = GUARDED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && guarded) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  if (user) {
    const role = (user.user_metadata as { app_role?: string } | undefined)?.app_role;
    const home = role === "sponsor" ? "/sponsor" : role === "officer" ? "/officer" : "/student";
    if (guarded && role && !pathname.startsWith(home)) {
      const u = request.nextUrl.clone();
      u.pathname = home;
      u.search = "";
      return NextResponse.redirect(u);
    }
    if (pathname === "/login" && role) {
      const u = request.nextUrl.clone();
      u.pathname = home;
      u.search = "";
      return NextResponse.redirect(u);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
