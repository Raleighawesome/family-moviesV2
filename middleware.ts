import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Middleware to protect routes and manage authentication
 *
 * This runs on every request to check authentication status
 * and redirect unauthenticated users to the login page.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/auth/callback'];

  // Check if the current route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    // User is not authenticated, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated, allow the request to continue
  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 *
 * We want to protect all routes except:
 * - Public routes (login, auth callback)
 * - Static files (_next/static, _next/image)
 * - Favicon and other assets
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
