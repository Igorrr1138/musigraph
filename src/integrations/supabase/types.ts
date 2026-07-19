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
          album_deezer_id: string | null
          album_mbid: string | null
          album_title: string
          artist_deezer_id: string | null
          artist_name: string | null
          cover_url: string | null
          id: string
          rated_at: string
          rating: number
          user_id: string
        }
        Insert: {
          album_deezer_id?: string | null
          album_mbid?: string | null
          album_title: string
          artist_deezer_id?: string | null
          artist_name?: string | null
          cover_url?: string | null
          id?: string
          rated_at?: string
          rating: number
          user_id: string
        }
        Update: {
          album_deezer_id?: string | null
          album_mbid?: string | null
          album_title?: string
          artist_deezer_id?: string | null
          artist_name?: string | null
          cover_url?: string | null
          id?: string
          rated_at?: string
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      album_reviews: {
        Row: {
          album_deezer_id: string
          created_at: string
          id: string
          review_tags: string[]
          review_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          album_deezer_id: string
          created_at?: string
          id?: string
          review_tags?: string[]
          review_text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          album_deezer_id?: string
          created_at?: string
          id?: string
          review_tags?: string[]
          review_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      criteria_preferences: {
        Row: {
          created_at: string
          criteria_order: string[]
          updated_at: string
          user_id: string
          visible_criteria: string[]
        }
        Insert: {
          created_at?: string
          criteria_order?: string[]
          updated_at?: string
          user_id: string
          visible_criteria?: string[]
        }
        Update: {
          created_at?: string
          criteria_order?: string[]
          updated_at?: string
          user_id?: string
          visible_criteria?: string[]
        }
        Relationships: []
      }
      music_cache: {
        Row: {
          artist_deezer_id: string
          cached_at: string
          data: Json
          mbid: string | null
          source: string
          updated_at: string
        }
        Insert: {
          artist_deezer_id: string
          cached_at?: string
          data: Json
          mbid?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          artist_deezer_id?: string
          cached_at?: string
          data?: Json
          mbid?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      playlist_tracks: {
        Row: {
          added_at: string
          album_deezer_id: string | null
          album_title: string | null
          artist_deezer_id: string | null
          artist_name: string | null
          cover_url: string | null
          duration_seconds: number | null
          id: string
          playlist_id: string
          position: number
          track_deezer_id: string
          track_title: string
          user_id: string
        }
        Insert: {
          added_at?: string
          album_deezer_id?: string | null
          album_title?: string | null
          artist_deezer_id?: string | null
          artist_name?: string | null
          cover_url?: string | null
          duration_seconds?: number | null
          id?: string
          playlist_id: string
          position?: number
          track_deezer_id: string
          track_title: string
          user_id: string
        }
        Update: {
          added_at?: string
          album_deezer_id?: string | null
          album_title?: string | null
          artist_deezer_id?: string | null
          artist_name?: string | null
          cover_url?: string | null
          duration_seconds?: number | null
          id?: string
          playlist_id?: string
          position?: number
          track_deezer_id?: string
          track_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          favorite_genres: string[]
          id: string
          is_pro: boolean | null
          onboarding_completed: boolean
          primary_provider: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          favorite_genres?: string[]
          id?: string
          is_pro?: boolean | null
          onboarding_completed?: boolean
          primary_provider?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          favorite_genres?: string[]
          id?: string
          is_pro?: boolean | null
          onboarding_completed?: boolean
          primary_provider?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      provider_accounts: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider_name: string
          provider_user_id: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider_name: string
          provider_user_id?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider_name?: string
          provider_user_id?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      track_criteria: {
        Row: {
          album_deezer_id: string | null
          created_at: string
          id: string
          scores: Json
          track_deezer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          album_deezer_id?: string | null
          created_at?: string
          id?: string
          scores?: Json
          track_deezer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          album_deezer_id?: string | null
          created_at?: string
          id?: string
          scores?: Json
          track_deezer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      track_lyrics: {
        Row: {
          created_at: string
          plain_text: string | null
          source: string | null
          synced: Json | null
          track_deezer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          plain_text?: string | null
          source?: string | null
          synced?: Json | null
          track_deezer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          plain_text?: string | null
          source?: string | null
          synced?: Json | null
          track_deezer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      track_metadata: {
        Row: {
          album_deezer_id: string | null
          created_at: string
          metadata: Json
          source: string | null
          title: string | null
          track_deezer_id: string
          updated_at: string
        }
        Insert: {
          album_deezer_id?: string | null
          created_at?: string
          metadata?: Json
          source?: string | null
          title?: string | null
          track_deezer_id: string
          updated_at?: string
        }
        Update: {
          album_deezer_id?: string | null
          created_at?: string
          metadata?: Json
          source?: string | null
          title?: string | null
          track_deezer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      track_ratings: {
        Row: {
          album_deezer_id: string | null
          album_mbid: string | null
          id: string
          rated_at: string
          rating: number
          track_deezer_id: string | null
          track_mbid: string | null
          track_position: number
          track_title: string
          user_id: string
        }
        Insert: {
          album_deezer_id?: string | null
          album_mbid?: string | null
          id?: string
          rated_at?: string
          rating: number
          track_deezer_id?: string | null
          track_mbid?: string | null
          track_position: number
          track_title: string
          user_id: string
        }
        Update: {
          album_deezer_id?: string | null
          album_mbid?: string | null
          id?: string
          rated_at?: string
          rating?: number
          track_deezer_id?: string | null
          track_mbid?: string | null
          track_position?: number
          track_title?: string
          user_id?: string
        }
        Relationships: []
      }
      track_reviews: {
        Row: {
          album_deezer_id: string | null
          created_at: string
          id: string
          review: string
          track_deezer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          album_deezer_id?: string | null
          created_at?: string
          id?: string
          review?: string
          track_deezer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          album_deezer_id?: string | null
          created_at?: string
          id?: string
          review?: string
          track_deezer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      community_album_averages: {
        Row: {
          album_deezer_id: string | null
          avg_rating: number | null
          rater_count: number | null
        }
        Relationships: []
      }
      community_track_averages: {
        Row: {
          album_deezer_id: string | null
          avg_rating: number | null
          rater_count: number | null
          track_position: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
