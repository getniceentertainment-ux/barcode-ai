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

  // We only run the database check if someone is actively trying to pick the lock
  if (isRestrictedRoute) {
    // 1. Get the secure Auth User ID from the session
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/', req.url)); // Not logged in
    }

    // 2. Cross-reference the database 'profiles' table using that ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    // 🚨 THE MASTER KEY
    const MASTER_EMAIL = 'getnice.entertainment@gmail.com'.toLowerCase(); 
    const profileEmail = profile?.email?.toLowerCase();
    
    // 3. The Final Boss Check
    const isMasterAdmin = profileEmail === MASTER_EMAIL;

    if (!isMasterAdmin) {
      // You aren't the boss. Get out.
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // The door is open.
  return res;
}

export const config = {
  matcher: ['/admin-node/:path*', '/dev-portal/:path*', '/api/dev/:path*'],
};