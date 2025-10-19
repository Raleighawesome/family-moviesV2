import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/streaming-services
 * Returns a list of unique streaming service provider names available in the database
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household to determine region
    const { data: householdMember } = await supabase
      .from('household_members')
      .select('household_id, households(region)')
      .eq('user_id', user.id)
      .single();

    if (!householdMember) {
      return NextResponse.json({ error: 'No household found' }, { status: 404 });
    }

    const region = (householdMember.households as any)?.region || 'US';

    // Fetch all movie providers for the household's region
    const { data: providers, error } = await supabase
      .from('movie_providers')
      .select('providers')
      .eq('region', region);

    if (error) {
      console.error('Error fetching streaming services:', error);
      return NextResponse.json(
        { error: 'Failed to fetch streaming services' },
        { status: 500 }
      );
    }

    // Extract unique providers with logos from all provider records
    const providerMap = new Map<string, { name: string; logo_path: string | null }>();

    providers?.forEach((record) => {
      const providerData = record.providers as {
        flatrate?: Array<{ provider_name: string; provider_id?: number; logo_path?: string }>;
        rent?: Array<{ provider_name: string; provider_id?: number; logo_path?: string }>;
        buy?: Array<{ provider_name: string; provider_id?: number; logo_path?: string }>;
      };

      // Collect flatrate (streaming) providers with logos
      providerData.flatrate?.forEach((p) => {
        if (p.provider_name && !providerMap.has(p.provider_name)) {
          providerMap.set(p.provider_name, {
            name: p.provider_name,
            logo_path: p.logo_path || null,
          });
        }
      });

      // Optionally include rent/buy providers too
      // providerData.rent?.forEach((p) => {
      //   if (p.provider_name && !providerMap.has(p.provider_name)) {
      //     providerMap.set(p.provider_name, {
      //       name: p.provider_name,
      //       logo_path: p.logo_path || null,
      //     });
      //   }
      // });
    });

    // Convert to sorted array
    const sortedProviders = Array.from(providerMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      region,
      providers: sortedProviders,
      count: sortedProviders.length,
    });
  } catch (error) {
    console.error('Streaming services API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
