import { createClient } from '@/lib/supabase/server';
import type { GetStreamingInput, MovieToolContext } from './types';

export async function getStreaming(
  { tmdb_id }: GetStreamingInput,
  context: MovieToolContext
) {
  const supabase = await createClient();

  // Get household region (default to US)
  const { data: householdMember } = await supabase
    .from('household_members')
    .select('household_id, households(region)')
    .eq('user_id', context.userId)
    .single();

  const region = (householdMember?.households as any)?.region || 'US';

  // Fetch streaming providers from cache
  const { data: providerData, error } = await supabase
    .from('movie_providers')
    .select('providers')
    .eq('tmdb_id', tmdb_id)
    .eq('region', region)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: `Failed to fetch streaming information: ${error.message}`,
    };
  }

  if (!providerData) {
    return {
      success: true,
      message: 'Streaming information is not available for this movie.',
      providers: null,
    };
  }

  const providers = providerData.providers as {
    flatrate?: Array<{ provider_name: string }>;
    rent?: Array<{ provider_name: string }>;
    buy?: Array<{ provider_name: string }>;
  };

  // Format the response
  const available: string[] = [];

  if (providers.flatrate && providers.flatrate.length > 0) {
    const streamNames = providers.flatrate.map(p => p.provider_name).join(', ');
    available.push(`Stream on: ${streamNames}`);
  }

  if (providers.rent && providers.rent.length > 0) {
    const rentNames = providers.rent.map(p => p.provider_name).join(', ');
    available.push(`Rent on: ${rentNames}`);
  }

  if (providers.buy && providers.buy.length > 0) {
    const buyNames = providers.buy.map(p => p.provider_name).join(', ');
    available.push(`Buy on: ${buyNames}`);
  }

  if (available.length === 0) {
    return {
      success: true,
      message: 'This movie is not currently available on any streaming services.',
      providers: null,
    };
  }

  return {
    success: true,
    message: available.join(' | '),
    providers: {
      stream: providers.flatrate?.map(p => p.provider_name) || [],
      rent: providers.rent?.map(p => p.provider_name) || [],
      buy: providers.buy?.map(p => p.provider_name) || [],
    },
  };
}
