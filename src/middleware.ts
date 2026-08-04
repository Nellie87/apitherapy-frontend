import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase env vars in middleware");
      return NextResponse.next();
    }

    const response = NextResponse.next({
      request,
    });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    const isRoot = pathname === "/";
    const isAuthPage = pathname === "/login";
    const isDashboardRoute = pathname.startsWith("/dashboard");

    if (isRoot) {
      const url = request.nextUrl.clone();
      url.pathname = user
        ? "/dashboard/summarydashboard"
        : "/login";
      return NextResponse.redirect(url);
    }

    if (!user && isDashboardRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (user && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/summarydashboard";
      return NextResponse.redirect(url);
    }

    return response;
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};