import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';

/**
 * Middleware to protect routes and manage authentication
 *
 * This runs on every request to check authentication status
 * and redirect unauthenticated users to the login page.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/beta', '/api/beta-auth'];

  // Check if the current route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Create a response we can add cookies to (Edge-compatible)
  let response = NextResponse.next();

  // Optional beta gate: require simple shared credentials to access the app
  const betaEnabled = process.env.BETA_MODE !== 'false';
  if (betaEnabled) {
    const betaCookie = request.cookies.get('beta_auth')?.value;
    if (!betaCookie) {
      const betaUrl = new URL('/beta', request.url);
      betaUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(betaUrl);
    }
  }

  // Create Supabase client that works in Middleware (Edge runtime)
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Use request cookies in middleware
          return request.cookies.getAll();
        },
        setAll(cookies) {
          // Write any auth cookie updates to the response
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check authentication for protected routes
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    // User is not authenticated, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    response = NextResponse.redirect(loginUrl);
    return response;
  }

  // User is authenticated, allow the request to continue
  return response;
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
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
