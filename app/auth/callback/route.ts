import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/login?error=verification_failed', requestUrl.origin));
    }

    if (data.user) {
      // Check if user has a household
      const { data: householdMember } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', data.user.id)
        .single();

      // If no household exists, create one
      if (!householdMember) {
        // Create a household for the new user
        const { data: household, error: householdError } = await supabase
          .from('households')
          .insert({
            name: `${data.user.email?.split('@')[0]}'s Family`,
          })
          .select()
          .single();

        if (householdError) {
          console.error('Error creating household:', householdError);
          return NextResponse.redirect(new URL('/login?error=household_creation_failed', requestUrl.origin));
        }

        // Add user as household member
        const { error: memberError } = await supabase
          .from('household_members')
          .insert({
            household_id: household.id,
            user_id: data.user.id,
            role: 'admin',
          });

        if (memberError) {
          console.error('Error adding user to household:', memberError);
          return NextResponse.redirect(new URL('/login?error=household_join_failed', requestUrl.origin));
        }
      }

      // Redirect to chat after successful verification and setup
      return NextResponse.redirect(new URL('/chat', requestUrl.origin));
    }
  }

  // If no code, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
