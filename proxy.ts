import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function proxy(req: NextRequest) {
  // 1. Initialize the response object
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  // 2. The Modern Next.js 16 Supabase SSR Client (Requires 3 Arguments)
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

  // 3. Securely fetch the session from the Edge
  const { data: { session } } = await supabase.auth.getSession();

  const url = req.nextUrl.pathname;

  // 4. QUARANTINE THE DEV PORTAL (Nobody gets in)
  if (url.startsWith('/dev-portal') || url.startsWith('/api/dev')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // 5. THE MASTER KEY (Only YOU get into the Admin Node)
  if (url.startsWith('/admin-node')) {
    // 🚨 IMPORTANT: Make sure your actual admin email is exactly right here
    const isMasterAdmin = session?.user?.email === 'YOUR_EMAIL@DOMAIN.COM'; 
    
    if (!session || !isMasterAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

// 6. THE RADAR
export const config = {
  matcher: ['/admin-node/:path*', '/dev-portal/:path*', '/api/dev/:path*'],
};