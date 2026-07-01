import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserProfile {
  favorite_genres: string[];
  onboarding_completed: boolean;
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('favorite_genres, onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return {
        favorite_genres: (data?.favorite_genres as string[] | null) ?? [],
        onboarding_completed: !!data?.onboarding_completed,
      };
    },
    enabled: !!user && !authLoading,
    staleTime: 60 * 1000,
  });

  return {
    profile: query.data ?? null,
    loading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
}
