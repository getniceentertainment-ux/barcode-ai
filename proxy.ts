import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  
  // 🚨 FIXED: Using the compiler's requested Server Client
  const supabase = createServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const url = req.nextUrl.pathname;

  // 1. QUARANTINE THE DEV PORTAL (Nobody gets in)
  if (url.startsWith('/dev-portal') || url.startsWith('/api/dev')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // 2. THE MASTER KEY (Only YOU get into the Admin Node)
  if (url.startsWith('/admin-node')) {
    // 🚨 IMPORTANT: Make sure your actual admin email is right here
    const isMasterAdmin = session?.user?.email === 'YOUR_EMAIL@DOMAIN.COM'; 
    
    if (!session || !isMasterAdmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return res;
}

// 3. THE RADAR
export const config = {
  matcher: ['/admin-node/:path*', '/dev-portal/:path*', '/api/dev/:path*'],
};