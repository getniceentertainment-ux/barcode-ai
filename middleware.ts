import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const url = req.nextUrl.pathname;

  // 1. QUARANTINE THE DEV PORTAL (Nobody gets in)
  // This completely blocks the frontend UI and the backend API key generator
  if (url.startsWith('/dev-portal') || url.startsWith('/api/dev')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // 2. THE MASTER KEY (Only YOU get into the Admin Node)
  if (url.startsWith('/admin-node')) {
    // Replace this with the exact email address you use to log into Bar-Code.ai
    const isMasterAdmin = session?.user?.email === 'YOUR_EMAIL@DOMAIN.COM'; 
    
    // If they aren't logged in, or if they aren't you, instantly kick them out
    if (!session || !isMasterAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

// 3. THE RADAR
// This tells the middleware exactly which URLs to watch out for
export const config = {
  matcher: ['/admin-node/:path*', '/dev-portal/:path*', '/api/dev/:path*'],
};