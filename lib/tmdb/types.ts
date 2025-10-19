// TMDB API Response Types

export interface TMDBSearchResult {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  adult: boolean;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
}

export interface TMDBMovieDetails extends TMDBMovie {
  runtime: number | null;
  genres: TMDBGenre[];
  production_companies: TMDBCompany[];
  production_countries: TMDBCountry[];
  spoken_languages: TMDBLanguage[];
  status: string;
  tagline: string | null;
  budget: number;
  revenue: number;
  imdb_id: string | null;
  homepage: string | null;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBCountry {
  iso_3166_1: string;
  name: string;
}

export interface TMDBLanguage {
  iso_639_1: string;
  name: string;
  english_name: string;
}

export interface TMDBReleaseDatesResponse {
  id: number;
  results: TMDBReleaseDateResult[];
}

export interface TMDBReleaseDateResult {
  iso_3166_1: string;
  release_dates: TMDBReleaseDate[];
}

export interface TMDBReleaseDate {
  certification: string;
  iso_639_1: string;
  release_date: string;
  type: number;
  note: string;
}

export interface TMDBKeywordsResponse {
  id: number;
  keywords: TMDBKeyword[];
}

export interface TMDBKeyword {
  id: number;
  name: string;
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: {
    [country: string]: TMDBCountryProviders;
  };
}

export interface TMDBCountryProviders {
  link: string;
  flatrate?: TMDBProvider[];
  rent?: TMDBProvider[];
  buy?: TMDBProvider[];
}

export interface TMDBProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TMDBCreditsResponse {
  id: number;
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBCastMember {
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  cast_id: number;
  character: string;
  credit_id: string;
  order: number;
}

export interface TMDBCrewMember {
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  credit_id: string;
  department: string;
  job: string;
}
