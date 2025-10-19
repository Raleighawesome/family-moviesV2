interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

interface ProviderChipsProps {
  providers: {
    flatrate?: Provider[];
    rent?: Provider[];
    buy?: Provider[];
  } | null;
  maxDisplay?: number;
}

/**
 * ProviderChips - Display streaming service availability
 *
 * Shows provider logos with priority: flatrate > rent > buy
 * Displays max N providers with "+X more" indicator
 */
export function ProviderChips({ providers, maxDisplay = 5 }: ProviderChipsProps) {
  if (!providers) {
    return (
      <div className="text-sm text-gray-500 italic">
        Not available to stream
      </div>
    );
  }

  // Combine providers with priority: flatrate first, then rent, then buy
  const allProviders: (Provider & { type: string })[] = [
    ...(providers.flatrate?.map(p => ({ ...p, type: 'Stream' })) || []),
    ...(providers.rent?.map(p => ({ ...p, type: 'Rent' })) || []),
    ...(providers.buy?.map(p => ({ ...p, type: 'Buy' })) || []),
  ];

  // Remove duplicates (same provider in multiple categories)
  const uniqueProviders = allProviders.filter(
    (provider, index, self) =>
      index === self.findIndex((p) => p.provider_id === provider.provider_id)
  );

  // Sort by display priority
  const sortedProviders = uniqueProviders.sort(
    (a, b) => a.display_priority - b.display_priority
  );

  if (sortedProviders.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        Not available to stream
      </div>
    );
  }

  const displayProviders = sortedProviders.slice(0, maxDisplay);
  const remainingCount = sortedProviders.length - maxDisplay;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {displayProviders.map((provider) => (
        <div
          key={provider.provider_id}
          className="group relative"
          title={`${provider.provider_name} (${provider.type})`}
        >
          {provider.logo_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
              alt={provider.provider_name}
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <div className="h-8 px-2 flex items-center bg-gray-200 text-gray-700 text-xs font-medium rounded">
              {provider.provider_name}
            </div>
          )}

          {/* Tooltip on hover */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {provider.provider_name} ({provider.type})
          </div>
        </div>
      ))}

      {remainingCount > 0 && (
        <span className="text-sm text-gray-600">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
