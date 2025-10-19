import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /auth/logout
 * Signs out the user and redirects to login
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();

  // Sign out the user
  await supabase.auth.signOut();

  // Redirect to login page
  return NextResponse.redirect(`${requestUrl.origin}/login`, {
    status: 302,
  });
}
