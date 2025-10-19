export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      family_prefs: {
        Row: {
          allowed_ratings: string[]
          blocked_keywords: string[]
          household_id: string
          max_runtime: number
          preferred_streaming_services: string[] | null
          rewatch_exclusion_days: number | null
        }
        Insert: {
          allowed_ratings?: string[]
          blocked_keywords?: string[]
          household_id: string
          max_runtime?: number
          preferred_streaming_services?: string[] | null
          rewatch_exclusion_days?: number | null
        }
        Update: {
          allowed_ratings?: string[]
          blocked_keywords?: string[]
          household_id?: string
          max_runtime?: number
          preferred_streaming_services?: string[] | null
          rewatch_exclusion_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_prefs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      family_taste: {
        Row: {
          household_id: string
          taste: string | null
          updated_at: string
        }
        Insert: {
          household_id: string
          taste?: string | null
          updated_at?: string
        }
        Update: {
          household_id?: string
          taste?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_taste_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string
        }
        Relationships: []
      }
      list_items: {
        Row: {
          added_by: string | null
          created_at: string
          household_id: string
          id: number
          list_type: string
          tmdb_id: number
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          household_id: string
          id?: number
          list_type: string
          tmdb_id: number
        }
        Update: {
          added_by?: string | null
          created_at?: string
          household_id?: string
          id?: number
          list_type?: string
          tmdb_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_tmdb_id_fkey"
            columns: ["tmdb_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["tmdb_id"]
          },
        ]
      }
      movie_providers: {
        Row: {
          providers: Json
          region: string
          tmdb_id: number
          updated_at: string
        }
        Insert: {
          providers: Json
          region: string
          tmdb_id: number
          updated_at?: string
        }
        Update: {
          providers?: Json
          region?: string
          tmdb_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movie_providers_tmdb_id_fkey"
            columns: ["tmdb_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["tmdb_id"]
          },
        ]
      }
      movies: {
        Row: {
          embedding: string | null
          genres: string[]
          keywords: string[]
          last_fetched_at: string
          mpaa: string | null
          overview: string | null
          popularity: number | null
          poster_path: string | null
          runtime: number | null
          title: string
          tmdb_id: number
          year: number | null
        }
        Insert: {
          embedding?: string | null
          genres?: string[]
          keywords?: string[]
          last_fetched_at?: string
          mpaa?: string | null
          overview?: string | null
          popularity?: number | null
          poster_path?: string | null
          runtime?: number | null
          title: string
          tmdb_id: number
          year?: number | null
        }
        Update: {
          embedding?: string | null
          genres?: string[]
          keywords?: string[]
          last_fetched_at?: string
          mpaa?: string | null
          overview?: string | null
          popularity?: number | null
          poster_path?: string | null
          runtime?: number | null
          title?: string
          tmdb_id?: number
          year?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birth_year: number | null
          created_at: string
          display_name: string
          household_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          display_name: string
          household_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          display_name?: string
          household_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          household_id: string
          profile_id: string | null
          rated_at: string
          rating: number
          tmdb_id: number
        }
        Insert: {
          household_id: string
          profile_id?: string | null
          rated_at?: string
          rating: number
          tmdb_id: number
        }
        Update: {
          household_id?: string
          profile_id?: string | null
          rated_at?: string
          rating?: number
          tmdb_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_tmdb_id_fkey"
            columns: ["tmdb_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["tmdb_id"]
          },
        ]
      }
      watches: {
        Row: {
          household_id: string
          id: number
          notes: string | null
          profile_id: string | null
          rewatch: boolean
          tmdb_id: number
          watched_at: string
        }
        Insert: {
          household_id: string
          id?: number
          notes?: string | null
          profile_id?: string | null
          rewatch?: boolean
          tmdb_id: number
          watched_at?: string
        }
        Update: {
          household_id?: string
          id?: number
          notes?: string | null
          profile_id?: string | null
          rewatch?: boolean
          tmdb_id?: number
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watches_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watches_tmdb_id_fkey"
            columns: ["tmdb_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["tmdb_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_member: {
        Args: { h: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      recommend_for_household: {
        Args: { p_household_id: string; p_limit?: number }
        Returns: {
          distance: number
          genres: string[]
          mpaa: string
          poster_path: string
          runtime: number
          title: string
          tmdb_id: number
          year: number
        }[]
      }
      refresh_family_taste: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      user_households: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

