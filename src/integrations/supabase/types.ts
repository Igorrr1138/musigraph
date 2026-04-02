export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      album_ratings: {
        Row: {
          album_mbid: string
          album_title: string
          artist_name: string | null
          cover_url: string | null
          id: string
          rated_at: string
          rating: number
          user_id: string
        }
        Insert: {
          album_mbid: string
          album_title: string
          artist_name?: string | null
          cover_url?: string | null
          id?: string
          rated_at?: string
          rating: number
          user_id: string
        }
        Update: {
          album_mbid?: string
          album_title?: string
          artist_name?: string | null
          cover_url?: string | null
          id?: string
          rated_at?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      albums_cache: {
        Row: {
          artist_mbid: string | null
          artist_name: string | null
          cached_at: string
          cover_url: string | null
          id: string
          mbid: string
          release_date: string | null
          title: string
          track_count: number | null
        }
        Insert: {
          artist_mbid?: string | null
          artist_name?: string | null
          cached_at?: string
          cover_url?: string | null
          id?: string
          mbid: string
          release_date?: string | null
          title: string
          track_count?: number | null
        }
        Update: {
          artist_mbid?: string | null
          artist_name?: string | null
          cached_at?: string
          cover_url?: string | null
          id?: string
          mbid?: string
          release_date?: string | null
          title?: string
          track_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "albums_cache_artist_mbid_fkey"
            columns: ["artist_mbid"]
            isOneToOne: false
            referencedRelation: "artists_cache"
            referencedColumns: ["mbid"]
          },
        ]
      }
      artists_cache: {
        Row: {
          cached_at: string
          country: string | null
          description: string | null
          disambiguation: string | null
          id: string
          image_url: string | null
          life_span_begin: string | null
          life_span_end: string | null
          mbid: string
          name: string
        }
        Insert: {
          cached_at?: string
          country?: string | null
          description?: string | null
          disambiguation?: string | null
          id?: string
          image_url?: string | null
          life_span_begin?: string | null
          life_span_end?: string | null
          mbid: string
          name: string
        }
        Update: {
          cached_at?: string
          country?: string | null
          description?: string | null
          disambiguation?: string | null
          id?: string
          image_url?: string | null
          life_span_begin?: string | null
          life_span_end?: string | null
          mbid?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      track_ratings: {
        Row: {
          album_mbid: string
          id: string
          rated_at: string
          rating: number
          track_mbid: string | null
          track_position: number
          track_title: string
          user_id: string
        }
        Insert: {
          album_mbid: string
          id?: string
          rated_at?: string
          rating: number
          track_mbid?: string | null
          track_position: number
          track_title: string
          user_id: string
        }
        Update: {
          album_mbid?: string
          id?: string
          rated_at?: string
          rating?: number
          track_mbid?: string | null
          track_position?: number
          track_title?: string
          user_id?: string
        }
        Relationships: []
      }
      tracks_cache: {
        Row: {
          album_mbid: string | null
          cached_at: string
          duration_ms: number | null
          id: string
          mbid: string | null
          position: number | null
          title: string
        }
        Insert: {
          album_mbid?: string | null
          cached_at?: string
          duration_ms?: number | null
          id?: string
          mbid?: string | null
          position?: number | null
          title: string
        }
        Update: {
          album_mbid?: string | null
          cached_at?: string
          duration_ms?: number | null
          id?: string
          mbid?: string | null
          position?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_cache_album_mbid_fkey"
            columns: ["album_mbid"]
            isOneToOne: false
            referencedRelation: "albums_cache"
            referencedColumns: ["mbid"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_community_album_averages: {
        Args: never
        Returns: {
          album_mbid: string
          avg_rating: number
          rater_count: number
        }[]
      }
      get_community_track_averages: {
        Args: { p_album_mbid: string }
        Returns: {
          avg_rating: number
          rater_count: number
          track_position: number
        }[]
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
  public: {
    Enums: {},
  },
} as const
