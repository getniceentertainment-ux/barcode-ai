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
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          req.cookies.set({ name, value: '', ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const url = req.nextUrl.pathname;

  // 🚨 THE MASTER KEY: Insert the email you use to log into Bar-Code.ai right here!
  // Example: 'founder@getnice.com'
  const isMasterAdmin = session?.user?.email === 'getnice.entertainment@gmail.com'; 

  // 1. THE VAULT DOOR (Protects Admin Node, Dev Portal, and Dev API)
  if (url.startsWith('/admin-node') || url.startsWith('/dev-portal') || url.startsWith('/api/dev')) {
    
    // 2. THE BOUNCER CHECK
    // If they aren't logged in, OR their email doesn't match the Master Key exactly...
    if (!session || !isMasterAdmin) {
      // Kick them safely to the homepage (avoids the Artist Alias trap)
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // If you are the boss, the Bouncer steps aside and lets the request through
  return res;
}

export const config = {
  matcher: ['/admin-node/:path*', '/dev-portal/:path*', '/api/dev/:path*'],
};