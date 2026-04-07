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
  const isRestrictedRoute = url.startsWith('/admin-node') || url.startsWith('/dev-portal') || url.startsWith('/api/dev');

  if (isRestrictedRoute) {
    // 1. Securely ping Supabase Auth to verify the token (No database queries)
    const { data: { user }, error } = await supabase.auth.getUser();

    // If there is an auth error or no user, kick to homepage
    if (error || !user) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // 🚨 THE MASTER KEY
    // Type your exact login email here, strictly in lowercase
    const MASTER_EMAIL = 'getnice.entertainment@gmail.com'; 
    
    // 2. Read the email directly from the secure Auth token payload
    const authEmail = user.email?.toLowerCase();

    // 3. The Final Boss Check
    if (authEmail !== MASTER_EMAIL) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // The door is open.
  return res;
}

export const config = {
  matcher: ['/admin-node/:path*', '/dev-portal/:path*', '/api/dev/:path*'],
};