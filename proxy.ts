import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res = NextResponse.next({ request: { headers: req.headers } });
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const url = req.nextUrl.pathname;
  
  // 🚨 SURGICAL FIX 1: The Proxy now ONLY guards the backend API.
  // It completely ignores /admin-node and /dev-portal, letting React handle them.
  const isRestrictedRoute = url.startsWith('/api/dev');

  if (isRestrictedRoute) {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const MASTER_EMAIL = 'getnice.entertainment@gmail.com'; 
    const authEmail = user.email?.toLowerCase();

    if (authEmail !== MASTER_EMAIL) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return res;
}

// 🚨 SURGICAL FIX 2: Reactivate the Radar
export const config = {
  // We turn the Edge Proxy back on, but ONLY point it at your API endpoints.
  matcher: ['/api/dev/:path*'], 
};